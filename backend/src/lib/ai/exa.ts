import Exa from 'exa-js'
import type { ExtractedCase } from '@/types'
import { geminiService } from './gemini'
import { PlaywrightScraper } from '@/lib/collectors/playwright-scraper'
import { orchestratorQueryStore } from './agentic-orchestrator'
import { logger } from '../logger'

let exaClient: Exa | null = null

const getExaClient = () => {
  if (!exaClient && process.env.EXA_API_KEY) {
    exaClient = new Exa(process.env.EXA_API_KEY)
  }
  if (!exaClient) {
    throw new Error('EXA_API_KEY is not configured')
  }
  return exaClient
}

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

  /**
   * Convert relative date string (e.g., "-14d") to ISO date string
   */
  private convertRelativeDateToISO(relativeDate: string): string {
    // Match patterns like "-14d" or "-7d"
    const match = relativeDate.match(/^-(\d+)d$/)
    if (!match) {
      // If not a relative date, return as-is
      return relativeDate
    }

    const daysAgo = parseInt(match[1])
    const date = new Date()
    date.setDate(date.getDate() - daysAgo)
    return date.toISOString().split('T')[0] // Return YYYY-MM-DD format
  }

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
        logger.info(`🔍 Exa searching: "${query}" for ${category}`)

        // Convert relative dates to ISO format
        const crawlDate = startCrawlDate ? this.convertRelativeDateToISO(startCrawlDate) :
          config.dateFilter ? this.convertRelativeDateToISO(config.dateFilter) :
            undefined
        const publishedDate = config.dateFilter ? this.convertRelativeDateToISO(config.dateFilter) : undefined

        const searchResponse = await getExaClient().search(query, {
          numResults: config.numResults || 50,
          ...(crawlDate && { startCrawlDate: crawlDate }),
          ...(publishedDate && { startPublishedDate: publishedDate }),
          // Only use includeDomains OR excludeDomains, not both
          ...(config.includeDomains ? { includeDomains: config.includeDomains } :
            config.excludeDomains ? { excludeDomains: config.excludeDomains } : {}),
          useAutoprompt: true,
          type: 'auto'
        })

        // Get full content for each result
        if (searchResponse.results.length > 0) {
          logger.info(`📄 Fetching content for ${searchResponse.results.length} results`)

          const contentResponse = await getExaClient().getContents(
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
                logger.warn(`Deep scrape failed for ${result.url}:`, error)
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
      logger.error(`Exa search failed for ${category}:`, error)
    }

    return results
  }

  async searchSpecificDomains(
    query: string,
    domains: string[],
    numResults = 10
  ): Promise<ExaSearchResult[]> {
    try {
      logger.info(`🎯 Searching specific domains: ${domains.join(', ')}`)

      const searchResponse = await getExaClient().search(query, {
        numResults,
        includeDomains: domains,
        useAutoprompt: true,
        type: 'auto'
      })

      if (searchResponse.results.length > 0) {
        const contentResponse = await getExaClient().getContents(
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
      logger.error('Domain-specific search failed:', error)
      return []
    }
  }

  /**
   * Get optimized queries using AI based on past successful cases
   */
  private async getOptimizedQueries(category: string, defaultQueries: string[]): Promise<string[]> {
    try {
      // First check if orchestrator has generated queries
      const orchestratorQueries = orchestratorQueryStore.getAllQueries()

      if (orchestratorQueries.length > 0) {
        logger.info(`Using ${orchestratorQueries.length} queries from orchestrator for ${category}`)

        // Filter queries relevant to this category
        let relevantQueries: string[] = []

        switch (category) {
          case 'classAction':
            relevantQueries = [...orchestratorQueries] // All queries relevant
            break
          case 'dataBreaches':
            relevantQueries = orchestratorQueries.filter(q =>
              q.toLowerCase().includes('data') ||
              q.toLowerCase().includes('breach') ||
              q.toLowerCase().includes('privacy')
            )
            break
          case 'governmentActions':
            relevantQueries = [
              ...orchestratorQueryStore.queries.regulatory,
              ...orchestratorQueryStore.queries.companies.filter(q =>
                q.toLowerCase().includes('ftc') ||
                q.toLowerCase().includes('sec') ||
                q.toLowerCase().includes('cfpb')
              )
            ]
            break
          case 'financialServices':
            relevantQueries = orchestratorQueries.filter(q =>
              q.toLowerCase().includes('bank') ||
              q.toLowerCase().includes('financial') ||
              q.toLowerCase().includes('credit')
            )
            break
          default:
            relevantQueries = orchestratorQueries
        }

        // If we have relevant queries, use them (but also include some defaults for coverage)
        if (relevantQueries.length > 0) {
          return [...new Set([...relevantQueries, ...defaultQueries.slice(0, 2)])].slice(0, 10)
        }
      }

      // Original optimization logic if no orchestrator queries
      const prompt = `Based on successful ${category} legal cases, generate 5-8 highly specific search queries that would find similar opportunities. 
      
Default queries: ${defaultQueries.join(', ')}

Focus on:
- Specific legal terminology that appears in settlements
- Company names and industries with frequent cases
- Recent regulatory actions and enforcement trends
- Consumer complaint patterns

Return a JSON array of search queries.`

      const optimized = await geminiService.generateJSON(prompt)

      // Combine default and optimized queries
      return [...new Set([...defaultQueries, ...optimized])].slice(0, 8)
    } catch (error) {
      logger.error(`Failed to optimize queries for ${category}:`, error)
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

      logger.info(`🌐 Deep scraping: ${url}`)

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
      logger.error('Deep scrape error:', error)
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
        logger.error(`Failed to track updates for ${caseTitle}:`, error)
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
      const searchResponse = await getExaClient().search(discoveryQuery, {
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
      logger.error('Source discovery failed:', error)
      return []
    }
  }

  /**
   * Look up CIK numbers for companies using SEC EDGAR search
   */
  async lookupCompanyCIK(companyName: string): Promise<{ company: string, cik: string } | null> {
    try {
      // Search for the company in SEC filings
      const searchQuery = `site:sec.gov/edgar "${companyName}" CIK`

      logger.info(`🔍 Looking up CIK for: ${companyName}`)

      const searchResponse = await getExaClient().search(searchQuery, {
        numResults: 5,
        useAutoprompt: false,
        type: 'keyword'
      })

      if (searchResponse.results.length > 0) {
        // Extract CIK from the results
        for (const result of searchResponse.results) {
          // CIK pattern is usually a 10-digit number (with leading zeros) or shorter
          const cikMatch = result.url.match(/CIK=(\d+)|cik=(\d+)|CIK-(\d+)/i) ||
            result.title?.match(/CIK[:\s]+(\d+)/i)

          if (cikMatch) {
            const cik = (cikMatch[1] || cikMatch[2] || cikMatch[3]).padStart(10, '0')
            logger.info(`✅ Found CIK for ${companyName}: ${cik}`)
            return { company: companyName, cik }
          }
        }
      }

      logger.info(`❌ No CIK found for ${companyName}`)
      return null
    } catch (error) {
      logger.error(`Failed to lookup CIK for ${companyName}:`, error)
      return null
    }
  }

  /**
   * Search for SEC filings for companies with CIK numbers
   */
  async searchCompanySECFilings(companyName: string, cik?: string): Promise<ExaSearchResult[]> {
    try {
      let searchQuery: string

      if (cik) {
        // Search using CIK for more accurate results
        searchQuery = `site:sec.gov/edgar CIK ${cik} (8-K OR 10-K OR 10-Q OR "class action" OR "litigation" OR "settlement")`
      } else {
        // Fallback to company name search
        searchQuery = `site:sec.gov/edgar "${companyName}" (8-K OR 10-K OR 10-Q OR "class action" OR "litigation" OR "settlement")`
      }

      logger.info(`📑 Searching SEC filings: ${searchQuery}`)

      const searchResponse = await getExaClient().search(searchQuery, {
        numResults: 10,
        startPublishedDate: '-90d', // Last 90 days
        useAutoprompt: false,
        type: 'keyword'
      })

      if (searchResponse.results.length > 0) {
        const contentResponse = await getExaClient().getContents(
          searchResponse.results.map(r => r.id),
          {
            text: true,
            highlights: {
              query: 'litigation OR settlement OR "class action" OR lawsuit',
              numSentences: 5
            },
            summary: true
          }
        )

        return contentResponse.results.map(r => ({
          url: r.url,
          title: r.title || `SEC Filing for ${companyName}`,
          text: r.text,
          publishedDate: r.publishedDate,
          author: r.author,
          highlights: r.highlights,
          summary: r.summary
        }))
      }

      return []
    } catch (error) {
      logger.error(`Failed to search SEC filings for ${companyName}:`, error)
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

let _exaService: ExaService | null = null

export function getExaService(): ExaService {
  if (!_exaService) {
    _exaService = new ExaService()
  }
  return _exaService
}
