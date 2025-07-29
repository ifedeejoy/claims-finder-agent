/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseCollector } from './base-collector'
import { getExaService, getDefaultConfigs } from '../ai/exa'
import { geminiService } from '../ai/gemini'
import type { CollectorResult, ExtractedCase } from '../../types'
import { logger } from '../logger'

export class ExaCollector extends BaseCollector {
  constructor() {
    super('Exa Web Search')
  }

  async collect(): Promise<CollectorResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let casesFound = 0
    let casesProcessed = 0

    try {
      await this.initializeScraper()

      // Collect from all configured categories
      const configs = getDefaultConfigs()
      const categories = Object.keys(configs).filter(cat => cat !== 'tracking')

      for (const category of categories) {
        try {
          logger.info(`Collecting ${category} opportunities...`)

          const searchResults = await getExaService().searchLegalOpportunities(
            category as keyof typeof configs
          )
          casesFound += searchResults.length

          for (const result of searchResults) {
            try {
              // Extract case details from full content
              const extractedCase = await geminiService.extractCaseDetails(
                result.content,
                result.url
              )

              if (extractedCase) {
                // Ensure claim URL is set
                if (!extractedCase.claimUrl) {
                  extractedCase.claimUrl = result.url
                }

                const processed = await this.processCase(
                  extractedCase,
                  'web_search',
                  result.url,
                  result.metadata.deepScraped === true ? `Deep scraped from ${result.url}` : undefined
                )

                if (processed) {
                  casesProcessed++
                  logger.info(`Processed case: ${extractedCase.title} from ${category}`)
                }
              }
            } catch (error) {
              const errorMsg = `Failed to process ${result.url}: ${error}`
              logger.error(errorMsg)
              errors.push(errorMsg)
            }
          }
        } catch (error) {
          const errorMsg = `Failed to collect ${category}: ${error}`
          logger.error(errorMsg)
          errors.push(errorMsg)
        }
      }

      // Also check for updates on existing cases
      await this.trackHighValueCaseUpdates()

    } catch (error) {
      const errorMsg = `Exa collection failed: ${error}`
      logger.error(errorMsg)
      errors.push(errorMsg)
    } finally {
      await this.closeScraper()
    }

    return this.createResult(casesFound, casesProcessed, errors, startTime)
  }

  async collectFromDomains(domains: string[], query?: string): Promise<CollectorResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let casesFound = 0
    let casesProcessed = 0

    const searchQuery = query || 'class action settlement claim deadline'

    try {
      await this.initializeScraper()

      const searchResults = await getExaService().searchSpecificDomains(
        searchQuery,
        domains
      )

      casesFound = searchResults.length

      for (const result of searchResults) {
        try {
          const extractedCase = await geminiService.extractCaseDetails(
            result.text || result.summary || '',
            result.url
          )

          if (extractedCase) {
            const processed = await this.processCase(
              extractedCase,
              'domain_search',
              result.url
            )

            if (processed) {
              casesProcessed++
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process ${result.url}: ${error}`
          logger.error(errorMsg)
          errors.push(errorMsg)
        }
      }
    } catch (error) {
      const errorMsg = `Domain collection failed: ${error}`
      logger.error(errorMsg)
      errors.push(errorMsg)
    } finally {
      await this.closeScraper()
    }

    return this.createResult(casesFound, casesProcessed, errors, startTime)
  }

  private async trackHighValueCaseUpdates(): Promise<void> {
    try {
      logger.info('Checking for updates on high-value cases...')

      // This would integrate with the supabase operations to get active cases
      // For now, we'll just log that we're doing this

      // In a real implementation:
      // const activeCases = await supabaseOps.getRecentCases(10)
      // for (const case of activeCases) {
      //   const updates = await exaService.trackCaseUpdates(case.title, case.url)
      //   // Process updates...
      // }

    } catch (error) {
      logger.error('Failed to track case updates:', error)
    }
  }
}
