import Exa from 'exa-js'
import type { ExtractedCase } from '@/types'
import { geminiService } from './gemini'
import { PlaywrightScraper } from '@/lib/collectors/playwright-scraper'

const exaClient = new Exa(process.env.EXA_API_KEY!)

interface ExaSearchResult {
  url: string
  title: string
  text?: string
  publishedDate?: string
  author?: string
  highlights?: string[]
  summary?: string
}

export class ExaService {
  private scraper?: PlaywrightScraper

  async searchLegalOpportunities(
    category: keyof typeof configs,
    startCrawlDate?: string
  ): Promise<Array<{ url: string; content: string; metadata: Record<string, unknown> }>> {
    const config = configs[category]
    const results: Array<{ url: string; content: string; metadata: Record<string, unknown> }> = []

    // Get optimized queries from our AI orchestrator if available
    const queries = await this.getOptimizedQueries(category, config.queries)

    try {
      for (const query of queries) {
        console.log(`🔍 Exa searching: "${query}" for ${category}`)

        const searchResponse = await exaClient.search(query, {
          numResults: config.numResults || 50,
          startCrawlDate: startCrawlDate || config.dateFilter,
          startPublishedDate: config.dateFilter,
          ...(config.includeDomains && { includeDomains: config.includeDomains }),
          ...(config.excludeDomains && { excludeDomains: config.excludeDomains }),
          useAutoprompt: true,
          type: 'auto'
        })

        // Get full content for each result
        if (searchResponse.results.length > 0) {
          console.log(`📄 Fetching content for ${searchResponse.results.length} results`)

          const contentResponse = await exaClient.getContents(
            searchResponse.results.map(r => r.id),
            {
              text: true,
              highlights: {
                query: query,
                numSentences: 3,
                highlightsPerUrl: 3
              },
              summary: true
            }
          )

          // Process each result with enhanced content extraction
          for (const result of contentResponse.results) {
            // Try to extract more content if needed
            let fullContent = result.text || ''
            const metadata: Record<string, unknown> = {
              title: result.title,
              url: result.url,
              publishedDate: result.publishedDate,
              author: result.author,
              highlights: result.highlights,
              summary: result.summary,
              extractedAt: new Date().toISOString()
            }

            // If content is limited, use Playwright to get full page
            if (fullContent.length < 500 && this.shouldDeepScrape(result.url)) {
              try {
                const deepContent = await this.deepScrapeContent(result.url)
                if (deepContent && deepContent.length > fullContent.length) {
                  fullContent = deepContent
                  metadata.deepScraped = true
                }
              } catch (error) {
                console.warn(`Deep scrape failed for ${result.url}:`, error)
              }
            }

            results.push({
              url: result.url,
              content: fullContent,
              metadata
            })
          }
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    } catch (error) {
      console.error(`Exa search failed for ${category}:`, error)
    }

    return results
  }

  async searchSpecificDomains(
    query: string,
    domains: string[],
    numResults = 10
  ): Promise<ExaSearchResult[]> {
    try {
      console.log(`🎯 Searching specific domains: ${domains.join(', ')}`)

      const searchResponse = await exaClient.search(query, {
        numResults,
        includeDomains: domains,
        useAutoprompt: true,
        type: 'auto'
      })

      if (searchResponse.results.length > 0) {
        const contentResponse = await exaClient.getContents(
          searchResponse.results.map(r => r.id),
          {
            text: true,
            highlights: { query, numSentences: 3 },
            summary: true
          }
        )

        return contentResponse.results.map(r => ({
          url: r.url,
          title: r.title || 'Untitled',
          text: r.text,
          publishedDate: r.publishedDate,
          author: r.author,
          highlights: r.highlights,
          summary: r.summary
        }))
      }

      return []
    } catch (error) {
      console.error('Domain-specific search failed:', error)
      return []
    }
  }

  /**
   * Get optimized queries using AI based on past successful cases
   */
  private async getOptimizedQueries(category: string, defaultQueries: string[]): Promise<string[]> {
    try {
      const prompt = `Based on successful ${category} legal cases, generate 5-8 highly specific search queries that would find similar opportunities. 
      
Default queries: ${defaultQueries.join(', ')}

Focus on:
- Specific legal terminology that appears in settlements
- Company names and industries with frequent cases
- Recent regulatory actions and enforcement trends
- Consumer complaint patterns

Return a JSON array of search queries.`

      const result = await geminiService.generateContent(prompt)
      const optimized = JSON.parse(result.response.text())

      // Combine default and optimized queries
      return [...new Set([...defaultQueries, ...optimized])].slice(0, 8)
    } catch {
      return defaultQueries
    }
  }

  /**
   * Determine if a URL should be deep scraped based on domain value
   */
  private shouldDeepScrape(url: string): boolean {
    const highValueDomains = [
      'classaction.org',
      'topclassactions.com',
      'bigclassaction.com',
      'consumeraffairs.com',
      'ftc.gov',
      'sec.gov',
      'justice.gov',
      'cpsc.gov',
      'fda.gov'
    ]

    return highValueDomains.some(domain => url.includes(domain))
  }

  /**
   * Deep scrape content using Playwright for JavaScript-heavy sites
   */
  private async deepScrapeContent(url: string): Promise<string | null> {
    try {
      // Use PlaywrightScraper's screenshot method to get content
      const scraper = new PlaywrightScraper()
      await scraper.initialize()

      console.log(`🌐 Deep scraping: ${url}`)

      // Use the scrapeWithScreenshot method and extract text
      const result = await scraper.scrapeWithScreenshot(url)

      await scraper.close()

      if (result.success && result.legalOpportunity) {
        // Combine all available text content
        const content = [
          result.legalOpportunity.title,
          result.legalOpportunity.description,
          result.legalOpportunity.eligibilityCriteria?.requirements?.join(' '),
          result.legalOpportunity.estimatedPayout,
          result.legalOpportunity.deadlineDate
        ].filter(Boolean).join(' ')

        return content
      }

      return null
    } catch (error) {
      console.error('Deep scrape error:', error)
      return null
    }
  }

  /**
   * Track articles and updates about existing cases
   */
  async trackCaseUpdates(caseTitle: string, caseUrl: string): Promise<ExaSearchResult[]> {
    const trackingQueries = [
      `"${caseTitle}" update settlement`,
      `"${caseTitle}" claim deadline extended`,
      `"${caseTitle}" payment status`,
      `"${caseTitle}" final approval`
    ]

    const results: ExaSearchResult[] = []

    for (const query of trackingQueries) {
      try {
        const searchResults = await this.searchLegalOpportunities('tracking', query)
        results.push(...searchResults.map(r => ({
          url: r.url,
          title: String(r.metadata.title || 'Update'),
          text: r.content,
          publishedDate: String(r.metadata.publishedDate || ''),
          highlights: r.metadata.highlights as string[] || [],
          summary: String(r.metadata.summary || '')
        })))
      } catch (error) {
        console.error(`Failed to track updates for ${caseTitle}:`, error)
      }
    }

    return results
  }

  /**
   * Discover new sources based on link analysis
   */
  async discoverNewSources(knownSources: string[]): Promise<string[]> {
    const discoveryQuery = 'class action settlement consumer refund legal claim'
    const potentialSources = new Set<string>()

    try {
      const searchResponse = await exaClient.search(discoveryQuery, {
        numResults: 100,
        useAutoprompt: true
      })

      // Extract unique domains
      searchResponse.results.forEach(result => {
        try {
          const url = new URL(result.url)
          const domain = url.hostname.replace('www.', '')

          // Only add if not in known sources and looks legitimate
          if (!knownSources.includes(domain) && this.isLegitimateSource(domain)) {
            potentialSources.add(domain)
          }
        } catch {
          // Invalid URL, skip
        }
      })

      // Verify sources contain legal content
      const verifiedSources: string[] = []
      for (const source of Array.from(potentialSources).slice(0, 10)) {
        const hasLegalContent = await this.verifyLegalSource(source)
        if (hasLegalContent) {
          verifiedSources.push(source)
        }
      }

      return verifiedSources
    } catch (error) {
      console.error('Source discovery failed:', error)
      return []
    }
  }

  private isLegitimateSource(domain: string): boolean {
    // Filter out obviously non-legal sites
    const excludePatterns = [
      'wikipedia.org',
      'youtube.com',
      'facebook.com',
      'twitter.com',
      'reddit.com',
      'amazon.com',
      'ebay.com'
    ]

    return !excludePatterns.some(pattern => domain.includes(pattern))
  }

  private async verifyLegalSource(domain: string): Promise<boolean> {
    try {
      const results = await this.searchSpecificDomains(
        'settlement OR "class action" OR refund OR claim',
        [domain],
        5
      )

      return results.length >= 2 // At least 2 legal-related pages
    } catch {
      return false
    }
  }

  async cleanup() {
    if (this.scraper) {
      await this.scraper.close()
      this.scraper = undefined
    }
  }
}

// Enhanced configurations with more search patterns
interface SearchConfig {
  queries: string[]
  numResults: number
  dateFilter: string
  includeDomains?: string[]
  excludeDomains?: string[]
}

const configs: Record<string, SearchConfig> = {
  classAction: {
    queries: [
      'class action settlement deadline 2024 claim',
      'consumer class action lawsuit payment available',
      '"settlement administrator" "submit claim" deadline',
      'class action "proof of purchase not required"',
      '"settlement fund" million dollars consumers',
      'data breach settlement claim compensation',
      'TCPA settlement text message claim',
      'product defect class action refund'
    ],
    numResults: 100,
    dateFilter: '-14d',
    includeDomains: [
      'classaction.org',
      'topclassactions.com',
      'lawyersandsettlements.com',
      'bigclassaction.com',
      'openclassactions.com',
      'girardsharp.com',
      'chimicles.com',
      'cohenmilstein.com'
    ],
    excludeDomains: ['reddit.com', 'facebook.com']
  },

  dataBreaches: {
    queries: [
      'data breach settlement claim filing',
      'identity theft protection settlement free',
      '"credit monitoring" breach settlement compensation',
      'healthcare data breach class action claim',
      'financial data breach settlement payment'
    ],
    numResults: 75,
    dateFilter: '-21d',
    includeDomains: [
      'databreach.com',
      'databreachtoday.com',
      'breachlevelindex.com',
      'idtheftcenter.org'
    ]
  },

  governmentActions: {
    queries: [
      'FTC consumer refund program',
      'CFPB enforcement action consumer relief',
      'state attorney general settlement claims',
      'SEC fair fund distribution',
      'DOJ consumer settlement administration'
    ],
    numResults: 50,
    dateFilter: '-30d',
    includeDomains: [
      'ftc.gov',
      'consumerfinance.gov',
      'sec.gov',
      'justice.gov',
      'naag.org'
    ]
  },

  productRecalls: {
    queries: [
      'product recall refund program',
      'CPSC recall remedy available',
      'FDA recall reimbursement consumer',
      'automotive recall compensation',
      'consumer product safety settlement'
    ],
    numResults: 50,
    dateFilter: '-30d',
    includeDomains: [
      'cpsc.gov',
      'fda.gov',
      'nhtsa.gov',
      'recalls.gov'
    ]
  },

  financialServices: {
    queries: [
      'bank overdraft fee settlement claim',
      'credit card interest rate settlement',
      'mortgage servicing settlement relief',
      'payday loan settlement refund',
      'investment fraud recovery fund'
    ],
    numResults: 75,
    dateFilter: '-14d',
    includeDomains: [
      'consumerfinance.gov',
      'finra.org',
      'bankrate.com',
      'nerdwallet.com'
    ]
  },

  tracking: {
    queries: [], // Will be filled dynamically
    numResults: 20,
    dateFilter: '-7d'
  }
}

export function getDefaultConfigs() {
  return configs
}

export const exaService = new ExaService()
