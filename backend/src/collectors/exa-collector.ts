import { BaseCollector } from './base-collector'
import { getExaService, getDefaultConfigs } from '@/lib/ai/exa'
import type { CollectorResult, ExaCollectorConfig } from '@/types'
import { CollectorError } from '@/types'

export class ExaCollector extends BaseCollector {
  private config: ExaCollectorConfig

  constructor(config?: Partial<ExaCollectorConfig>) {
    super('Exa Web Search', 'exa')

    // Merge default config with provided config
    const defaultConfig = getDefaultConfigs()
    this.config = {
      queries: [
        ...defaultConfig.classAction.queries,
        ...defaultConfig.ftcSettlements.queries,
        ...defaultConfig.dataBreaches.queries
      ],
      numResults: 50,
      dateFilter: '7d',
      excludeDomains: [
        'reddit.com',
        'twitter.com',
        'facebook.com',
        'linkedin.com',
        'youtube.com'
      ],
      ...config
    }
  }

  async collect(): Promise<CollectorResult> {
    const startTime = Date.now()
    let casesFound = 0
    let casesProcessed = 0
    const errors: string[] = []

    try {
      this.log('Starting Exa collection with config:', 'info')
      this.log(`Queries: ${this.config.queries.length}`, 'info')
      this.log(`Results per query: ${this.config.numResults}`, 'info')

      // Get or create source
      const sourceId = await this.getOrCreateSource()

      // Search for legal opportunities with enhanced pagination
      const exaService = getExaService()
      const searchResults = await exaService.searchLegalOpportunities('classAction')
      casesFound = searchResults.length

      this.log(`Found ${casesFound} potential legal opportunities`, 'info')

      // Process each result
      for (const result of searchResults) {
        try {
          await this.processSearchResult({
            url: result.url,
            title: (result.metadata.title as string) || 'Untitled',
            content: result.content
          }, sourceId)
          casesProcessed++

          // Rate limiting between processing
          await this.delay(500)
        } catch (error) {
          const errorMsg = `Failed to process ${result.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          this.log(errorMsg, 'warn')
        }
      }

      this.log(`Successfully processed ${casesProcessed}/${casesFound} cases`, 'info')

    } catch (error) {
      const errorMsg = `Collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  private async processSearchResult(
    result: { url: string; title: string; content: string },
    sourceId: string
  ): Promise<void> {
    try {
      // Clean and validate content
      const cleanedContent = this.cleanContent(result.content)

      if (cleanedContent.length < 100) {
        throw new CollectorError(
          'Content too short to be meaningful',
          this.sourceName,
          'parsing'
        )
      }

      // Extract case details
      const extractedCase = await this.processContent(
        cleanedContent,
        result.url,
        sourceId
      )

      if (!extractedCase) {
        this.log(`No legal opportunity found in ${result.url}`, 'info')
        return
      }

      // Use the source URL as claim URL if none extracted
      if (!extractedCase.claimUrl) {
        extractedCase.claimUrl = result.url
      }

      // Save to database
      await this.saveCase(extractedCase, sourceId, result.url)

      this.log(`Successfully processed case: ${extractedCase.title}`, 'info')

    } catch (error) {
      throw new CollectorError(
        `Search result processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'parsing'
      )
    }
  }

  /**
   * Run collection for specific domains only
   */
  async collectFromDomains(domains: string[], query = 'class action settlement consumer claims'): Promise<CollectorResult> {
    const startTime = Date.now()
    let casesFound = 0
    let casesProcessed = 0
    const errors: string[] = []

    try {
      this.log(`Starting domain-specific collection for: ${domains.join(', ')}`, 'info')

      const sourceId = await this.getOrCreateSource()
      const exaService = getExaService()
      const searchResults = await exaService.searchSpecificDomains(query, domains, 30)
      casesFound = searchResults.length

      for (const result of searchResults) {
        try {
          await this.processSearchResult({
            url: result.url,
            title: result.title,
            content: result.text || ''
          }, sourceId)
          casesProcessed++
          await this.delay(1000) // Longer delay for domain-specific searches
        } catch (error) {
          const errorMsg = `Failed to process ${result.url}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          this.log(errorMsg, 'warn')
        }
      }

    } catch (error) {
      const errorMsg = `Domain collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      this.log(errorMsg, 'error')
    }

    const duration = Date.now() - startTime

    return {
      sourceName: `${this.sourceName} (${domains.join(', ')})`,
      casesFound,
      casesProcessed,
      errors,
      duration
    }
  }
}
