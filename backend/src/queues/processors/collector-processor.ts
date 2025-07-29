import { Job } from 'bull'
import { logger } from '../../lib/logger'
import { agenticOrchestrator } from '../../lib/ai/agentic-orchestrator'
import { ExaCollector } from '../../lib/collectors/exa-collector'
import { FtcCollector } from '../../lib/collectors/ftc-collector'
import { SecCollector } from '../../lib/collectors/sec-collector'
import type { CollectorResult } from '../../types'

export interface CollectorJobData {
  type: 'all' | 'exa' | 'ftc' | 'sec' | 'continuous'
  config?: Record<string, unknown>
  monitoringType?: string
  timezone?: string
  schedule?: string
}

export interface CollectorJobResult {
  type: string
  strategy?: string
  reasoning?: string
  results: CollectorResult[]
  totalCasesFound: number
  totalCasesProcessed: number
  errors: string[]
  startTime: string
  endTime: string
  duration: number
  performanceMetrics?: {
    violationPatternsFound?: number
    emergingTrends?: string[]
    highValueOpportunities?: number
  }
}

export async function processCollectorJob(job: Job<CollectorJobData>): Promise<CollectorJobResult> {
  const startTime = new Date()
  logger.info(`Starting collector job: ${job.data.type}`, {
    jobId: job.id,
    monitoringType: job.data.monitoringType,
    timezone: job.data.timezone
  })

  try {
    let results: CollectorResult[] = []
    let strategy: string | undefined
    let reasoning: string | undefined
    let performanceMetrics: CollectorJobResult['performanceMetrics']

    // Update job progress
    await job.progress(10)

    if (job.data.type === 'all' || job.data.type === 'continuous') {
      // Use AI-guided orchestrator for intelligent collection
      logger.info('Using AI-guided orchestrator for collection')

      // Pass monitoring type and timezone to orchestrator
      const orchestratorResult = await agenticOrchestrator.runCollection({
        monitoringType: job.data.monitoringType,
        timezone: job.data.timezone,
        emergencyMode: job.data.monitoringType === 'emergency'
      })

      results = orchestratorResult.results
      strategy = orchestratorResult.strategy
      reasoning = orchestratorResult.reasoning

      // Handle different monitoring types
      if (job.data.monitoringType) {
        switch (job.data.monitoringType) {
          case 'newsFeeds':
            logger.info('Running news feed monitoring - checking for breaking opportunities')
            // Focus on recent news and emerging patterns
            break
          case 'secFilings':
            logger.info('Running SEC filing monitoring - checking for new filings with violation indicators')
            // Focus on SEC sources and company filings
            break
          case 'ftcAnnouncements':
            logger.info('Running FTC/regulatory monitoring - checking for new enforcement actions')
            // Focus on government sources
            break
          case 'deepAnalysis':
            logger.info('Running deep analysis - comprehensive pattern recognition across all sources')
            // Run comprehensive analysis
            performanceMetrics = {
              violationPatternsFound: results.reduce((sum, r) => sum + r.casesFound, 0),
              emergingTrends: ['data breaches', 'privacy violations'], // Would be extracted from results
              highValueOpportunities: results.filter(r => r.casesFound > 0).length
            }
            break
          case 'weekendScan':
            logger.info('Running weekend scan - checking for opportunities posted during off-hours')
            break
        }
      }

      await job.progress(50)
      logger.info(`AI Strategy: ${strategy} - ${reasoning}`)
    } else {
      // Run individual collector
      let collector: ExaCollector | FtcCollector | SecCollector

      switch (job.data.type) {
        case 'exa':
          collector = new ExaCollector()
          break
        case 'ftc':
          collector = new FtcCollector()
          break
        case 'sec':
          collector = new SecCollector()
          break
        default:
          throw new Error(`Unknown collector type: ${job.data.type}`)
      }

      await job.progress(20)
      const result = await collector.collect()
      results = [result]
      await job.progress(80)
    }

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    const jobResult: CollectorJobResult = {
      type: job.data.type,
      strategy,
      reasoning,
      results,
      totalCasesFound: results.reduce((sum, r) => sum + r.casesFound, 0),
      totalCasesProcessed: results.reduce((sum, r) => sum + r.casesProcessed, 0),
      errors: results.flatMap(r => r.errors),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      performanceMetrics
    }

    // Log performance metrics for continuous monitoring
    if (job.data.type === 'continuous') {
      logger.info(`Continuous monitoring job completed`, {
        jobId: job.id,
        monitoringType: job.data.monitoringType,
        casesFound: jobResult.totalCasesFound,
        duration: `${(duration / 1000).toFixed(2)}s`,
        nextRun: job.opts?.repeat ? 'Scheduled' : 'Not scheduled'
      })
    }

    await job.progress(100)

    logger.info(`Collector job completed: ${job.data.type}`, {
      jobId: job.id,
      casesFound: jobResult.totalCasesFound,
      casesProcessed: jobResult.totalCasesProcessed,
      duration: `${(duration / 1000).toFixed(2)}s`
    })

    return jobResult
  } catch (error) {
    logger.error(`Collector job failed: ${job.data.type}`, {
      jobId: job.id,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
} 