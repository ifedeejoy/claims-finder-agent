import { Job } from 'bull'
import { logger } from '../../lib/logger'
import { agenticOrchestrator } from '../../lib/ai/agentic-orchestrator'
import { ExaCollector } from '../../lib/collectors/exa-collector'
import { FtcCollector } from '../../lib/collectors/ftc-collector'
import { SecCollector } from '../../lib/collectors/sec-collector'
import type { CollectorResult } from '../../types'

export interface CollectorJobData {
  type: 'all' | 'exa' | 'ftc' | 'sec'
  config?: Record<string, unknown>
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
}

export async function processCollectorJob(job: Job<CollectorJobData>): Promise<CollectorJobResult> {
  const startTime = new Date()
  logger.info(`Starting collector job: ${job.data.type}`, { jobId: job.id })

  try {
    let results: CollectorResult[] = []
    let strategy: string | undefined
    let reasoning: string | undefined

    if (job.data.type === 'all') {
      // Use AI-guided orchestrator for intelligent collection
      logger.info('Using AI-guided orchestrator for collection')
      const orchestratorResult = await agenticOrchestrator.runCollection()

      results = orchestratorResult.results
      strategy = orchestratorResult.strategy
      reasoning = orchestratorResult.reasoning

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

      const result = await collector.collect()
      results = [result]
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
      duration
    }

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