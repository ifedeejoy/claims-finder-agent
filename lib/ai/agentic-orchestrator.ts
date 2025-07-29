/* eslint-disable @typescript-eslint/no-explicit-any */

import { geminiService } from './gemini'
import { exaService } from './exa'
import { db } from '@/lib/supabase/operations'
import { ExaCollector } from '@/lib/collectors/exa-collector'
import { FtcCollector } from '@/lib/collectors/ftc-collector'
import { SecCollector } from '@/lib/collectors/sec-collector'
import type { CollectorResult } from '@/types'

/**
 * Orchestrates intelligent claim collection across multiple sources.
 * Makes decisions about strategy and prioritization based on performance metrics.
 */
export class AgenticOrchestrator {
  private performanceHistory: Map<string, number[]> = new Map()
  private sourceEffectiveness: Map<string, { successRate: number, avgQuality: number }> = new Map()
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
    const strategy = await this.selectOptimalStrategy()
    const prioritizedSources = await this.prioritizeSources()
    const results: CollectorResult[] = []
    const collectorsRun: string[] = []

    for (const source of prioritizedSources) {
      if (await this.shouldRunCollector(source)) {
        collectorsRun.push(source.name)

        const result = await this.runOptimizedCollector(source)
        results.push(result)

        // Learn from results
        await this.updatePerformanceMetrics(source.name, result)
      }
    }

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
      const result = await geminiService.generateContent(strategyPrompt)
      const response = JSON.parse(result.response.text())
      return { name: response.strategy, reasoning: response.reasoning }
    } catch {
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
      const result = await geminiService.generateContent(discoveryPrompt)
      const domains = JSON.parse(result.response.text())

      // Validate each discovered source
      const validatedSources: string[] = []
      for (const domain of domains) {
        if (await this.validateNewSource(domain)) {
          validatedSources.push(domain)
        }
      }

      return validatedSources
    } catch {
      return []
    }
  }

  /**
   * AI-driven search query optimization
   */
  async optimizeSearchQueries(currentQueries: string[]): Promise<string[]> {
    const recentCases = await db.getActiveCases(50, 0)

    const optimizationPrompt = `Analyze recent successful legal case discoveries and optimize search queries:

Current Queries:
${currentQueries.join('\n')}

Recent Successful Cases:
${recentCases.slice(0, 10).map(c => `- ${c.title}: ${c.category}`).join('\n')}

Based on patterns in successful cases, generate 8-12 optimized search queries that would find similar opportunities. Focus on:
- Effective legal terminology
- Consumer-focused language
- Settlement and refund keywords
- Government agency terminology

Return JSON array: ["optimized query 1", "optimized query 2", ...]`

    try {
      const result = await geminiService.generateContent(optimizationPrompt)
      return JSON.parse(result.response.text())
    } catch {
      return currentQueries // Fallback to existing queries
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
        const result = await geminiService.generateContent(qualityPrompt)
        const assessment = JSON.parse(result.response.text())

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
    // AI-driven source prioritization based on performance
    const sources = await db.getActiveSources()
    const priorities: Array<{ name: string, priority: number }> = []

    for (const source of sources) {
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

  private async shouldRunCollector(source: { name: string, priority: number }): Promise<boolean> {
    // AI decision based on multiple factors
    const currentHour = new Date().getHours()
    const isBusinessHours = currentHour >= 9 && currentHour <= 17

    // Higher priority sources run more often
    if (source.priority > 0.8) return true
    if (source.priority > 0.6 && isBusinessHours) return true
    if (source.priority > 0.4 && Math.random() > 0.5) return true

    return false
  }

  private async runOptimizedCollector(source: { name: string }): Promise<CollectorResult> {
    // Run actual collectors based on source name
    try {
      switch (source.name.toLowerCase()) {
        case 'exa web search':
          return await this.collectors.exa.collect()
        case 'ftc press releases':
          return await this.collectors.ftc.collect()
        case 'sec edgar filings':
          return await this.collectors.sec.collect()
        default:
          // Try to match by source type
          if (source.name.includes('exa') || source.name.includes('web')) {
            return await this.collectors.exa.collect()
          } else if (source.name.includes('ftc')) {
            return await this.collectors.ftc.collect()
          } else if (source.name.includes('sec')) {
            return await this.collectors.sec.collect()
          }

          // Fallback
          return {
            sourceName: source.name,
            casesFound: 0,
            casesProcessed: 0,
            errors: [`Unknown collector type for source: ${source.name}`],
            duration: 0
          }
      }
    } catch (error) {
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
      const testSearch = await exaService.searchSpecificDomains(
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
