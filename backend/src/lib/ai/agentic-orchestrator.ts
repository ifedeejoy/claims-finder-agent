/* eslint-disable @typescript-eslint/no-explicit-any */

import { geminiService } from './gemini'
import { getExaService } from './exa'
import { db } from '../supabase/operations'
import { ExaCollector } from '../collectors/exa-collector'
import { FtcCollector } from '../collectors/ftc-collector'
import { SecCollector } from '../collectors/sec-collector'
import { logger } from '../logger'
import type { CollectorResult } from '../../types'
import type { ExtractedCase } from '../../types'

// Shared query store for collectors to access
export const orchestratorQueryStore = {
  queries: {
    seasonal: [] as string[],
    trending: [] as string[],
    regulatory: [] as string[],
    emerging: [] as string[],
    companies: [] as string[]
  },
  getAllQueries(): string[] {
    return [
      ...this.queries.seasonal,
      ...this.queries.trending,
      ...this.queries.regulatory,
      ...this.queries.emerging,
      ...this.queries.companies
    ]
  },
  clear(): void {
    this.queries = {
      seasonal: [],
      trending: [],
      regulatory: [],
      emerging: [],
      companies: []
    }
  }
}

/**
 * Orchestrates intelligent claim collection across multiple sources.
 * Makes decisions about strategy and prioritization based on performance metrics.
 */
export class AgenticOrchestrator {
  private performanceHistory: Map<string, number[]> = new Map()
  private sourceEffectiveness: Map<string, { successRate: number, avgQuality: number }> = new Map()
  private queryPerformance: Map<string, { hitRate: number, avgQuality: number }> = new Map()
  private generatedQueries: {
    seasonal: string[]
    trending: string[]
    regulatory: string[]
    emerging: string[]
    companies: string[]
  } = {
      seasonal: [],
      trending: [],
      regulatory: [],
      emerging: [],
      companies: []
    }
  private collectors: {
    exa: ExaCollector
    ftc: FtcCollector
    sec: SecCollector
  }

  constructor() {
    this.collectors = {
      exa: new ExaCollector(),
      ftc: new FtcCollector(),
      sec: new SecCollector()
    }
  }


  async runCollection(): Promise<{
    strategy: string
    collectorsRun: string[]
    reasoning: string
    results: CollectorResult[]
  }> {
    logger.info('Starting AI-guided collection process')

    const strategy = await this.selectOptimalStrategy()
    logger.info(`Selected strategy: ${strategy.name} - ${strategy.reasoning}`)

    const prioritizedSources = await this.prioritizeSources()
    const results: CollectorResult[] = []
    const collectorsRun: string[] = []

    // Generate optimized queries for this run
    await this.updateQueryBank()

    // If no queries generated, force generation of base queries
    if (this.getTotalQueryCount() === 0) {
      logger.info('No queries found, generating base queries')
      await this.generateBaseQueries()
    }

    for (const source of prioritizedSources) {
      if (await this.shouldRunCollector(source, strategy.name)) {
        collectorsRun.push(source.name)
        logger.info(`Running collector: ${source.name} (priority: ${source.priority.toFixed(2)})`)

        const result = await this.runOptimizedCollector(source)
        results.push(result)

        // Learn from results
        await this.updatePerformanceMetrics(source.name, result)

        // Track which queries performed well
        await this.analyzeQueryPerformance(source.name, result)

        // If we found companies, look up their CIK numbers for SEC filings
        if (result.casesFound > 0 && source.name.includes('Exa')) {
          await this.extractCompaniesAndFindCIKs(result)
        }
      }
    }

    // If no collectors ran or no cases found, force at least one collector
    if (collectorsRun.length === 0 || results.reduce((sum, r) => sum + r.casesFound, 0) === 0) {
      logger.info('No cases found, forcing Exa collector run with expanded queries')
      const exaResult = await this.collectors.exa.collect() // Remove queries parameter
      results.push(exaResult)
      collectorsRun.push('Exa Web Search (forced)')

      if (exaResult.casesFound > 0) {
        await this.extractCompaniesAndFindCIKs(exaResult)
      }
    }

    // Run case update tracking for high-value cases
    await this.trackCaseUpdates()

    logger.info(`Collection complete. Ran ${collectorsRun.length} collectors, found ${results.reduce((sum, r) => sum + r.casesFound, 0)} total cases`)
    logger.info(`AI Strategy: ${strategy.name} - ${strategy.reasoning}`)

    return {
      strategy: strategy.name,
      collectorsRun,
      reasoning: strategy.reasoning,
      results
    }
  }

  /**
   * AI selects optimal collection strategy based on historical performance
   */
  private async selectOptimalStrategy(): Promise<{ name: string, reasoning: string }> {
    const recentPerformance = await this.getRecentPerformanceMetrics()
    const currentTime = new Date()
    const dayOfWeek = currentTime.getDay()
    const hourOfDay = currentTime.getHours()

    const strategyPrompt = `Based on the following data, determine the optimal legal opportunity collection strategy:

Recent Performance Metrics:
${JSON.stringify(recentPerformance, null, 2)}

Current Context:
- Day of week: ${dayOfWeek} (0=Sunday, 6=Saturday)  
- Hour of day: ${hourOfDay}
- Time: ${currentTime.toISOString()}

Historical patterns show:
- FTC releases announcements typically on weekdays 9-5 EST
- SEC filings often submitted after market close (4pm EST)
- Class action sites update throughout the week
- Legal news sites update during business hours

Decide on strategy and provide reasoning:
1. "aggressive" - Run all collectors with high frequency
2. "targeted" - Focus on high-performing sources
3. "exploratory" - Try new search terms and sources
4. "maintenance" - Light collection, focus on data quality

Return JSON: {"strategy": "targeted", "reasoning": "..."}`

    try {
      const response = await geminiService.generateJSON(strategyPrompt)
      return { name: response.strategy, reasoning: response.reasoning }
    } catch (error) {
      logger.error('AI strategy selection failed', error)
      return {
        name: "targeted",
        reasoning: "AI strategy selection failed, defaulting to targeted approach"
      }
    }
  }


  async discoverSources(): Promise<string[]> {
    const discoveryPrompt = `You are an AI agent tasked with finding new sources of legal opportunities for U.S. consumers.

Current known sources:
- classaction.org
- topclassactions.com  
- ftc.gov
- sec.gov

Your task: Identify 5-10 additional authoritative sources that would contain:
- Class action settlements
- Consumer refund programs
- Government enforcement actions
- Corporate legal settlements
- Consumer protection announcements

Return a JSON array of domains only: ["example.com", "another.gov"]`

    try {
      const domains = await geminiService.generateJSON(discoveryPrompt)

      // Validate each discovered source
      const validatedSources: string[] = []
      for (const domain of domains) {
        if (await this.validateNewSource(domain)) {
          validatedSources.push(domain)
          logger.info(`Discovered new valid source: ${domain}`)
        }
      }

      return validatedSources
    } catch (error) {
      logger.error('Source discovery failed', error)
      return []
    }
  }

  /**
   * AI-driven search query optimization with learning
   */
  async optimizeSearchQueries(currentQueries: string[]): Promise<string[]> {
    // Get recent cases for learning
    let recentCases: any[] = []
    try {
      const dbCases = await db.getRecentCasesForDuplicateCheck(50 * 24) // Get last 50 days worth
      recentCases = dbCases
      if (recentCases.length > 0) {
        const caseSummary = recentCases
          .slice(0, 10)
          .map((c: any) => `- ${c.title} (${c.source})`).join('\n')

        logger.info(`Analyzing recent successful legal case discoveries:`)
        logger.info(caseSummary)
      }
    } catch (error) {
      logger.error('Failed to get recent cases for query optimization', error)
    }

    const queryMetrics = Object.fromEntries(this.queryPerformance)

    const optimizationPrompt = `Analyze recent successful legal case discoveries and optimize search queries:

Current Queries:
${currentQueries.join('\n')}

Recent Successful Cases:
${recentCases.slice(0, 10).map(c => `- ${c.title}: ${c.category}`).join('\n')}

Query Performance History:
${JSON.stringify(queryMetrics, null, 2)}

Based on patterns in successful cases, generate 8-12 optimized search queries that would find similar opportunities. Focus on:
- Specific legal terminology that appears in settlements
- Company names and industries with frequent cases
- Recent regulatory actions and enforcement trends
- Consumer complaint patterns
- Queries that historically perform well

Also generate 2-3 experimental queries to explore new areas.

Return JSON array: ["optimized query 1", "optimized query 2", ...]`

    try {
      const optimizedQueries = await geminiService.generateJSON(optimizationPrompt)

      // Track which queries are new
      optimizedQueries.forEach((query: string) => {
        if (!this.queryPerformance.has(query)) {
          this.queryPerformance.set(query, { hitRate: 0, avgQuality: 5 })
        }
      })

      return optimizedQueries
    } catch (error) {
      logger.error('Query optimization failed', error)
      return currentQueries // Fallback to existing queries
    }
  }

  /**
   * Generate dynamic queries based on current trends and past success
   */
  private async updateQueryBank(): Promise<void> {
    try {
      const trendingPrompt = `Based on current date ${new Date().toISOString()} and recent legal trends, generate search queries for:

1. Seasonal opportunities (tax season, holiday shopping, etc.)
2. Recent major data breaches or corporate scandals
3. New regulatory changes or enforcement actions
4. Emerging consumer protection issues
5. Major companies with recent legal issues

Consider:
- Current month/season for relevant settlements
- Major companies in the news
- Recent FTC/CFPB/SEC enforcement patterns
- Technology and privacy concerns

Return JSON: {
  "seasonal": ["query1", "query2"],
  "trending": ["query3", "query4"],
  "regulatory": ["query5", "query6"],
  "emerging": ["query7", "query8"],
  "companies": ["Apple class action", "Meta privacy settlement", "Amazon FTC"]
}`

      const trendingQueries = await geminiService.generateJSON(trendingPrompt)

      // Store these for use by collectors
      this.generatedQueries = trendingQueries
      orchestratorQueryStore.queries = trendingQueries // Share with collectors
      logger.info('Generated trending queries:', trendingQueries)

    } catch (error) {
      logger.error('Failed to update query bank', error)
      // Fall back to base queries
      await this.generateBaseQueries()
    }
  }

  /**
   * Generate base queries if none exist
   */
  private async generateBaseQueries(): Promise<void> {
    this.generatedQueries = {
      seasonal: ["tax refund settlement", "holiday shopping class action"],
      trending: ["data breach settlement 2025", "privacy violation class action"],
      regulatory: ["FTC enforcement action", "CFPB consumer refund"],
      emerging: ["AI privacy settlement", "cryptocurrency class action"],
      companies: ["Meta settlement", "Google class action", "Amazon FTC case", "Apple consumer lawsuit"]
    }
    orchestratorQueryStore.queries = this.generatedQueries // Share with collectors
    logger.info('Generated base queries:', this.generatedQueries)
  }

  /**
   * Get all queries as a flat array
   */
  private getAllQueries(): string[] {
    return [
      ...this.generatedQueries.seasonal,
      ...this.generatedQueries.trending,
      ...this.generatedQueries.regulatory,
      ...this.generatedQueries.emerging,
      ...this.generatedQueries.companies
    ]
  }

  /**
   * Get total number of queries
   */
  private getTotalQueryCount(): number {
    return this.getAllQueries().length
  }

  /**
   * Extract company names and find their CIK numbers
   */
  private async extractCompaniesAndFindCIKs(result: CollectorResult): Promise<void> {
    try {
      const companyPrompt = `Extract company names from these legal cases that might have SEC filings:

Cases found: ${result.casesFound}
Source: ${result.sourceName}

Look for:
- Publicly traded companies
- Large corporations  
- Companies likely to have SEC filings

Return JSON array of company names only: ["Company 1", "Company 2"]`

      const companies = await geminiService.generateJSON(companyPrompt)

      for (const company of companies.slice(0, 5)) { // Limit to 5 companies
        logger.info(`Looking up CIK for company: ${company}`)

        // Look up CIK number using Exa
        const cikInfo = await getExaService().lookupCompanyCIK(company)

        if (cikInfo) {
          logger.info(`Found CIK ${cikInfo.cik} for ${company}`)

          // Add company-specific queries for SEC collector with CIK
          this.generatedQueries.companies.push(`CIK ${cikInfo.cik} 8-K filing`)
          this.generatedQueries.companies.push(`CIK ${cikInfo.cik} securities litigation`)
          this.generatedQueries.companies.push(`"${company}" CIK ${cikInfo.cik} class action`)

          // Also search for recent SEC filings for this company
          const secFilings = await getExaService().searchCompanySECFilings(company, cikInfo.cik)

          if (secFilings.length > 0) {
            logger.info(`Found ${secFilings.length} SEC filings for ${company}`)

            // Extract any legal matters from the filings
            for (const filing of secFilings.slice(0, 3)) {
              if (filing.highlights && filing.highlights.some(h =>
                h.toLowerCase().includes('litigation') ||
                h.toLowerCase().includes('settlement') ||
                h.toLowerCase().includes('class action')
              )) {
                logger.info(`Found potential legal matter in ${company} filing: ${filing.url}`)

                // Process this as a potential case
                const extractedCase = await geminiService.extractCaseDetails(
                  filing.text || filing.summary || '',
                  filing.url
                )

                if (extractedCase) {
                  await this.processCase(
                    extractedCase,
                    'sec',
                    filing.url,
                    `SEC filing for ${company} (CIK: ${cikInfo.cik})`
                  )
                }
              }
            }
          }
        } else {
          // Still add company queries without CIK
          this.generatedQueries.companies.push(`"${company}" 8-K filing securities`)
          this.generatedQueries.companies.push(`"${company}" class action lawsuit`)
        }

        // Update the shared query store
        orchestratorQueryStore.queries = this.generatedQueries
      }
    } catch (error) {
      logger.error('Failed to extract companies and find CIKs', error)
    }
  }

  /**
   * Process a case found by the orchestrator
   */
  private async processCase(
    extractedCase: ExtractedCase,
    sourceType: string,
    sourceUrl: string,
    notes?: string
  ): Promise<boolean> {
    try {
      // Get or create source
      const sourceId = await this.getOrCreateSource(
        'AI Orchestrator Discovery',
        sourceType,
        sourceUrl
      )

      // Ensure claim URL is set
      if (!extractedCase.claimUrl) {
        extractedCase.claimUrl = sourceUrl
      }

      // Add notes to the case description if provided
      if (notes) {
        extractedCase.description = `${extractedCase.description}\n\nNote: ${notes}`
      }

      // Use upsertCase which handles duplicates internally
      await db.upsertCase(
        extractedCase,
        sourceId,
        extractedCase.claimUrl
      )

      logger.info(`Orchestrator discovered case: ${extractedCase.title}`)
      return true
    } catch (error) {
      logger.error('Failed to process orchestrator-discovered case', error)
      return false
    }
  }

  /**
   * Get or create a source in the database
   */
  private async getOrCreateSource(name: string, type: string, url: string): Promise<string> {
    try {
      const existing = await db.findSourceByName(name)
      if (existing) {
        return existing.id
      }

      const newSource = await db.createSource({
        name,
        type: type as 'exa' | 'sec' | 'ftc' | 'native',
        url,
        lastChecked: new Date(),
        isActive: true,
        config: {}
      })

      return newSource.id
    } catch (error) {
      logger.error(`Failed to get or create source: ${error}`)
      throw error
    }
  }

  /**
   * Track updates for existing high-value cases
   */
  private async trackCaseUpdates(): Promise<void> {
    try {
      const activeCases = await db.getRecentCasesForDuplicateCheck(20 * 24) // Get last 20 days worth
      const highValueCases = activeCases.filter((c: any) =>
        c.estimated_payout && parseInt(c.estimated_payout.replace(/\D/g, '')) > 100
      )

      for (const case_ of highValueCases.slice(0, 5)) {
        logger.info(`Tracking updates for case: ${case_.title}`)

        const updates = await getExaService().trackCaseUpdates(
          case_.title,
          case_.claimUrl || ''
        )

        if (updates.length > 0) {
          logger.info(`Found ${updates.length} updates for ${case_.title}`)
          // TODO: Process and store updates
        }
      }
    } catch (error) {
      logger.error('Case update tracking failed', error)
    }
  }

  /**
   * Analyze which queries led to successful discoveries
   */
  private async analyzeQueryPerformance(sourceName: string, result: CollectorResult): Promise<void> {
    // This would need to track which queries were used and their success
    // For now, we'll simulate this analysis
    if (result.casesProcessed > 0) {
      const successRate = result.casesProcessed / result.casesFound

      // Update query performance metrics
      // In a real implementation, we'd track which specific queries found cases
      logger.info(`Query performance for ${sourceName}: ${(successRate * 100).toFixed(1)}% success rate`)
    }
  }

  /**
   * Autonomous quality assessment and filtering
   */
  async assessCaseQuality(cases: Array<{
    title: string
    description: string
    estimatedPayout?: string
    deadlineDate?: string
    proofRequired: boolean
  }>): Promise<Array<{ case: any, quality: number, keep: boolean }>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assessments: Array<{ case: any, quality: number, keep: boolean }> = []

    for (const legalCase of cases) {
      const qualityPrompt = `Assess the quality and value of this legal opportunity for consumers:

Case: ${legalCase.title}
Description: ${legalCase.description}
Estimated Payout: ${legalCase.estimatedPayout || 'Unknown'}
Deadline: ${legalCase.deadlineDate || 'Unknown'}
Proof Required: ${legalCase.proofRequired}

Rate this case on a scale of 1-10 considering:
- Potential payout value
- Ease of claiming
- Likelihood of success  
- Time sensitivity
- Documentation requirements

Return JSON: {"quality": 8, "reasoning": "...", "keep": true}`

      try {
        const assessment = await geminiService.generateJSON(qualityPrompt)

        assessments.push({
          case: legalCase,
          quality: assessment.quality,
          keep: assessment.keep && assessment.quality >= 6
        })
      } catch {
        // If assessment fails, keep the case but mark as lower quality
        assessments.push({
          case: legalCase,
          quality: 5,
          keep: true
        })
      }
    }

    return assessments
  }

  private async prioritizeSources(): Promise<Array<{ name: string, priority: number }>> {
    // Define known sources with their types
    const knownSources = [
      { name: 'Exa Web Search', type: 'exa', lastChecked: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // 2 hours ago
      { name: 'FTC Press Releases', type: 'ftc', lastChecked: new Date(Date.now() - 6 * 60 * 60 * 1000) }, // 6 hours ago
      { name: 'SEC EDGAR Filings', type: 'sec', lastChecked: new Date(Date.now() - 4 * 60 * 60 * 1000) } // 4 hours ago
    ]

    const priorities: Array<{ name: string, priority: number }> = []

    for (const source of knownSources) {
      const effectiveness = this.sourceEffectiveness.get(source.name) || { successRate: 0.5, avgQuality: 5 }
      const timeSinceLastRun = Date.now() - source.lastChecked.getTime()

      // AI calculates priority score
      const priority = effectiveness.successRate * 0.4 +
        (effectiveness.avgQuality / 10) * 0.3 +
        Math.min(timeSinceLastRun / (1000 * 60 * 60), 24) / 24 * 0.3

      priorities.push({ name: source.name, priority })
    }

    return priorities.sort((a, b) => b.priority - a.priority)
  }

  private async shouldRunCollector(source: { name: string, priority: number }, strategy: string): Promise<boolean> {
    // Much more aggressive approach based on strategy
    const currentHour = new Date().getHours()
    const isBusinessHours = currentHour >= 9 && currentHour <= 17

    // Always run if we have queries
    if (this.getTotalQueryCount() === 0) {
      return false // No queries to run with
    }

    switch (strategy) {
      case 'aggressive':
        return true // Always run all collectors

      case 'exploratory':
        return true // Run all to explore new opportunities

      case 'targeted':
        // Run high priority sources and at least one collector
        if (source.priority > 0.3) return true
        if (source.name.includes('Exa')) return true // Always run Exa as primary source
        return isBusinessHours && source.priority > 0.2

      case 'maintenance':
        // Still run key collectors but less frequently
        return source.priority > 0.5 || (source.name.includes('Exa') && Math.random() > 0.3)

      default:
        // Default to running if priority is reasonable
        return source.priority > 0.3 || source.name.includes('Exa')
    }
  }

  private async runOptimizedCollector(source: { name: string }): Promise<CollectorResult> {
    // Run actual collectors based on source name
    try {
      // Collectors will access queries from orchestratorQueryStore

      switch (source.name.toLowerCase()) {
        case 'exa web search':
          return await this.collectors.exa.collect() // Remove queries parameter

        case 'ftc press releases':
          return await this.collectors.ftc.collect()

        case 'sec edgar filings':
          return await this.collectors.sec.collect()

        default:
          // Try to match by source type
          if (source.name.includes('exa') || source.name.includes('web')) {
            return await this.collectors.exa.collect() // Remove queries parameter
          } else if (source.name.includes('ftc')) {
            return await this.collectors.ftc.collect()
          } else if (source.name.includes('sec')) {
            return await this.collectors.sec.collect()
          }

          // Fallback
          logger.warn(`Unknown collector type for source: ${source.name}`)
          return {
            sourceName: source.name,
            casesFound: 0,
            casesProcessed: 0,
            errors: [`Unknown collector type for source: ${source.name}`],
            duration: 0
          }
      }
    } catch (error) {
      logger.error(`Collector failed for source: ${source.name}`, error)
      return {
        sourceName: source.name,
        casesFound: 0,
        casesProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: 0
      }
    }
  }

  private async updatePerformanceMetrics(sourceName: string, result: CollectorResult): Promise<void> {
    const successRate = result.casesFound > 0 ? result.casesProcessed / result.casesFound : 0

    if (!this.performanceHistory.has(sourceName)) {
      this.performanceHistory.set(sourceName, [])
    }

    const history = this.performanceHistory.get(sourceName)!
    history.push(successRate)

    // Keep only last 20 runs
    if (history.length > 20) {
      history.shift()
    }

    // Update effectiveness metrics
    const avgSuccessRate = history.reduce((a, b) => a + b, 0) / history.length
    this.sourceEffectiveness.set(sourceName, {
      successRate: avgSuccessRate,
      avgQuality: 7 // Would be calculated from case quality assessments
    })

    logger.info(`Updated metrics for ${sourceName}: Success rate ${(avgSuccessRate * 100).toFixed(1)}%`)
  }

  private async getRecentPerformanceMetrics(): Promise<Record<string, {
    recentSuccessRate: number
    totalRuns: number
    trend: number
  }>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metrics: any = {}

    for (const [source, history] of this.performanceHistory) {
      metrics[source] = {
        recentSuccessRate: history.slice(-5).reduce((a, b) => a + b, 0) / Math.min(history.length, 5),
        totalRuns: history.length,
        trend: history.length >= 2 ? (history[history.length - 1] - history[history.length - 2]) : 0
      }
    }

    return metrics
  }

  private async validateNewSource(domain: string): Promise<boolean> {
    try {
      // Quick validation - check if domain is accessible and contains legal content
      const testSearch = await getExaService().searchSpecificDomains(
        "settlement OR class action",
        [domain],
        3
      )

      return testSearch.length > 0
    } catch {
      return false
    }
  }
}

export const agenticOrchestrator = new AgenticOrchestrator()
