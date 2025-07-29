import { BaseCollector } from './base-collector'
import { CollectorError, type CollectorResult } from '@/types'
import * as cheerio from 'cheerio'

export class FtcCollector extends BaseCollector {
  private readonly baseUrl = 'https://www.ftc.gov'
  private readonly pressReleaseUrl = 'https://www.ftc.gov/news-events/news/press-releases'
  private readonly enforcementUrl = 'https://www.ftc.gov/legal-library/browse/cases-proceedings'

  constructor() {
    super('FTC Press Releases', 'ftc')
  }

  async collect(): Promise<CollectorResult> {
    const startTime = Date.now()
    let casesFound = 0
    let casesProcessed = 0
    const errors: string[] = []

    try {
      this.log('Starting FTC collection', 'info')

      const sourceId = await this.getOrCreateSource(this.baseUrl)

      // Collect from press releases
      const pressReleaseResults = await this.collectPressReleases()
      casesFound += pressReleaseResults.found

      // Process each press release
      for (const release of pressReleaseResults.releases) {
        try {
          await this.processPressRelease(release, sourceId)
          casesProcessed++
          await this.delay(1000) // Respectful crawling
        } catch (error) {
          const errorMsg = `Failed to process press release ${release.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          this.log(errorMsg, 'warn')
        }
      }

      this.log(`Successfully processed ${casesProcessed}/${casesFound} FTC cases`, 'info')

    } catch (error) {
      const errorMsg = `FTC collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      this.log(errorMsg, 'error')
    }

    const duration = Date.now() - startTime
    
    return {
      sourceName: this.sourceName,
      casesFound,
      casesProcessed,
      errors,
      duration
    }
  }

  private async collectPressReleases(): Promise<{
    found: number
    releases: Array<{ url: string; title: string; date: string; summary: string }>
  }> {
    try {
      this.log('Fetching FTC press releases...', 'info')

      const response = await fetch(this.pressReleaseUrl)
      if (!response.ok) {
        throw new CollectorError(
          `Failed to fetch press releases: ${response.status}`,
          this.sourceName,
          'network'
        )
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      const releases: Array<{ url: string; title: string; date: string; summary: string }> = []

      // Find press release listings - FTC uses specific selectors
      $('.views-row').each((_, element) => {
        const $element = $(element)
        
        const titleElement = $element.find('.field-title a')
        const dateElement = $element.find('.field-date')
        const summaryElement = $element.find('.field-summary')

        const title = titleElement.text().trim()
        const relativeUrl = titleElement.attr('href')
        const date = dateElement.text().trim()
        const summary = summaryElement.text().trim()

        // Only process recent releases with settlement/refund keywords
        if (title && relativeUrl && this.isRelevantRelease(title, summary)) {
          const fullUrl = relativeUrl.startsWith('http') 
            ? relativeUrl 
            : `${this.baseUrl}${relativeUrl}`

          releases.push({
            url: fullUrl,
            title,
            date,
            summary
          })
        }
      })

      // Limit to most recent releases
      const recentReleases = releases.slice(0, 20)
      
      this.log(`Found ${recentReleases.length} relevant press releases`, 'info')
      
      return {
        found: recentReleases.length,
        releases: recentReleases
      }

    } catch (error) {
      throw new CollectorError(
        `Press release collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'network'
      )
    }
  }

  private async processPressRelease(
    release: { url: string; title: string; date: string; summary: string },
    sourceId: string
  ): Promise<void> {
    try {
      this.log(`Processing: ${release.title}`, 'info')

      // Fetch full press release content
      const response = await fetch(release.url)
      if (!response.ok) {
        throw new CollectorError(
          `Failed to fetch press release content: ${response.status}`,
          this.sourceName,
          'network'
        )
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // Extract main content
      const contentSelectors = [
        '.field-body',
        '.field-content',
        '.press-release-body',
        'main .content',
        'article'
      ]

      let content = ''
      for (const selector of contentSelectors) {
        const element = $(selector)
        if (element.length > 0) {
          content = element.text().trim()
          break
        }
      }

      if (!content) {
        // Fallback to page text
        content = $('body').text().trim()
      }

      // Clean and validate content
      const cleanedContent = this.cleanContent(content)
      
      if (cleanedContent.length < 200) {
        throw new CollectorError(
          'Press release content too short',
          this.sourceName,
          'parsing'
        )
      }

      // Extract case details
      const extractedCase = await this.processContent(
        cleanedContent,
        release.url,
        sourceId
      )

      if (!extractedCase) {
        this.log(`No consumer opportunity found in: ${release.title}`, 'info')
        return
      }

      // Use press release URL as claim URL if none extracted
      if (!extractedCase.claimUrl) {
        extractedCase.claimUrl = release.url
      }

      // Save to database
      await this.saveCase(extractedCase, sourceId, release.url)
      
      this.log(`Successfully processed FTC case: ${extractedCase.title}`, 'info')

    } catch (error) {
      throw new CollectorError(
        `Press release processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'parsing'
      )
    }
  }

  private isRelevantRelease(title: string, summary: string): boolean {
    const keywords = [
      'settlement',
      'refund',
      'redress',
      'consumer',
      'fine',
      'penalty',
      'compensation',
      'relief',
      'restitution',
      'damages',
      'class action',
      'lawsuit'
    ]

    const text = (title + ' ' + summary).toLowerCase()
    return keywords.some(keyword => text.includes(keyword))
  }
}
