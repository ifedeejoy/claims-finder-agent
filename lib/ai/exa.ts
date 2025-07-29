import Exa from 'exa-js'
import { CollectorError, type ExaCollectorConfig } from '@/types'

let exa: Exa | null = null

function initializeExa(): Exa {
  if (!exa) {
    const apiKey = process.env.EXA_API_KEY
    if (!apiKey) {
      throw new Error('EXA_API_KEY environment variable is required')
    }
    exa = new Exa(apiKey)
  }
  return exa
}

export interface ExaSearchResult {
  url: string
  title: string
  content: string
  publishedDate?: string
}

export class ExaService {
  async searchLegalOpportunities(config: ExaCollectorConfig): Promise<ExaSearchResult[]> {
    try {
      const results: ExaSearchResult[] = []
      const seenUrls = new Set<string>()

      // Process each query with pagination
      for (const query of config.queries) {
        const exaClient = initializeExa()

        // Start with initial search
        let searchResults = await exaClient.search(query, {
          type: 'neural',
          numResults: Math.min(config.numResults || 50, 100), // Max 100 per request
          includeDomains: config.includeDomains,
          excludeDomains: config.excludeDomains,
          useAutoprompt: true,
          startPublishedDate: this.getDateFilter(config.dateFilter)
        })

        // Process initial results
        await this.processSearchResults(searchResults, results, seenUrls)

        let totalFetched = searchResults.results.length
        const targetResults = config.numResults || 50

        while (totalFetched < targetResults && searchResults.autopromptString) {
          await this.delay(1000)
          searchResults = await exaClient.search(searchResults.autopromptString, {
            type: 'neural',
            numResults: Math.min(targetResults - totalFetched, 100),
            includeDomains: config.includeDomains,
            excludeDomains: config.excludeDomains,
            startPublishedDate: this.getDateFilter(config.dateFilter)
          })

          await this.processSearchResults(searchResults, results, seenUrls)
          totalFetched += searchResults.results.length

          if (searchResults.results.length === 0) break
        }

        await this.delay(1500)
      }

      return results
    } catch (error) {
      throw new CollectorError(
        `Exa search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'exa',
        'network'
      )
    }
  }

  private async processSearchResults(
    searchResult: { results: Array<{ url: string; title?: string; text?: string; publishedDate?: string }> },
    results: ExaSearchResult[],
    seenUrls: Set<string>
  ): Promise<void> {
    for (const result of searchResult.results) {
      if (seenUrls.has(result.url)) continue

      seenUrls.add(result.url)
      const content = result.text || ''

      if (content && content.length > 100) {
        results.push({
          url: result.url,
          title: result.title || 'Untitled',
          content: content,
          publishedDate: result.publishedDate
        })
      }
    }
  }

  async searchSpecificDomains(
    query: string,
    domains: string[],
    numResults = 50
  ): Promise<ExaSearchResult[]> {
    try {
      const exaClient = initializeExa()
      const results: ExaSearchResult[] = []
      const seenUrls = new Set<string>()

      // Use keyword search for domain-specific queries
      let searchResult = await exaClient.search(query, {
        type: 'keyword',
        numResults: Math.min(numResults, 100),
        includeDomains: domains,
        contents: {
          text: true
        }
      })

      await this.processSearchResults(searchResult, results, seenUrls)

      // Continue with pagination if needed
      let totalFetched = searchResult.results.length

      while (totalFetched < numResults && results.length < numResults) {
        await this.delay(1000)

        // Try different query variations for better coverage
        const queryVariations = [
          `${query} deadline claim`,
          `${query} eligible settlement`,
          `${query} file claim deadline`
        ]

        for (const variation of queryVariations) {
          if (results.length >= numResults) break

          searchResult = await exaClient.search(variation, {
            type: 'keyword',
            numResults: Math.min(numResults - results.length, 100),
            includeDomains: domains,
            contents: {
              text: true
            }
          })

          await this.processSearchResults(searchResult, results, seenUrls)
          await this.delay(500)
        }

        break // Exit after trying variations
      }

      return results
    } catch (error) {
      throw new CollectorError(
        `Domain-specific search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'exa',
        'network'
      )
    }
  }

  /**
   * Get fresh content for URLs that might have updated
   */
  async getFreshContent(urls: string[]): Promise<ExaSearchResult[]> {
    try {
      const exaClient = initializeExa()
      const contentResults = await exaClient.getContents(urls, {
        text: true,
        livecrawl: 'always' // Force fresh crawl
      })

      return contentResults.results
        .filter(result => result.text)
        .map(result => ({
          url: result.url,
          title: result.title || 'Untitled',
          content: result.text!
        }))
    } catch (error) {
      throw new CollectorError(
        `Fresh content retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'exa',
        'network'
      )
    }
  }

  /**
   * Get enhanced default search configurations with better queries
   */
  static getDefaultConfigs(): Record<string, ExaCollectorConfig> {
    return {
      classAction: {
        queries: [
          'class action settlement claim deadline 2025',
          'consumer class action lawsuit settlement open claims',
          'class action settlement fund distribution notice',
          'file claim class action settlement before deadline',
          'new class action settlements accepting claims'
        ],
        numResults: 100, // Increased for better coverage
        includeDomains: [
          'classaction.org',
          'topclassactions.com',
          'classactionrebates.com',
          'openclassactions.com',
          'bigclassaction.com'
        ],
        dateFilter: '14d' // Extended window
      },
      ftcSettlements: {
        queries: [
          'FTC settlement refund consumer eligible 2025',
          'Federal Trade Commission settlement checks available',
          'FTC consumer redress program claim deadline',
          'FTC enforcement settlement distribution',
          'consumer protection settlement FTC claim'
        ],
        numResults: 50,
        includeDomains: ['ftc.gov', 'consumer.ftc.gov', 'reportfraud.ftc.gov'],
        dateFilter: '30d'
      },
      dataBreaches: {
        queries: [
          'data breach settlement claim form available',
          'cybersecurity incident class action settlement 2025',
          'privacy violation settlement consumer compensation',
          'data breach notification settlement claims open',
          'identity theft settlement class action deadline'
        ],
        numResults: 75,
        dateFilter: '21d'
      },
      productDefects: {
        queries: [
          'product recall settlement claim consumer',
          'defective product class action settlement 2025',
          'consumer product safety settlement claims',
          'product liability settlement claim deadline',
          'recalled product settlement compensation'
        ],
        numResults: 75,
        dateFilter: '30d'
      },
      financialServices: {
        queries: [
          'bank overdraft fee settlement claims',
          'credit card settlement class action 2025',
          'mortgage servicing settlement consumer claims',
          'financial services class action settlement deadline',
          'banking fee settlement eligible consumers'
        ],
        numResults: 75,
        includeDomains: [
          'consumerfinance.gov',
          'classaction.org',
          'topclassactions.com'
        ],
        dateFilter: '30d'
      }
    }
  }

  private getDateFilter(filter?: string): string | undefined {
    if (!filter) return undefined

    const now = new Date()
    const daysMap: Record<string, number> = {
      '7d': 7,
      '14d': 14,
      '21d': 21,
      '30d': 30,
      '60d': 60,
      '90d': 90
    }

    const days = daysMap[filter]
    if (!days) return undefined

    const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))
    return startDate.toISOString().split('T')[0]
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const exaService = new ExaService()
