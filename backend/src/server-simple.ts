import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import Bull from 'bull'
import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { logger } from './lib/logger'
import { agenticOrchestrator } from './lib/ai/agentic-orchestrator'
import { ExaCollector } from './lib/collectors/exa-collector'
import { FtcCollector } from './lib/collectors/ftc-collector'
import { SecCollector } from './lib/collectors/sec-collector'
import collectorRoutes from './routes/collectors'
import healthRoutes from './routes/health'
import type { CollectorResult } from './types'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Create Bull queue with Redis configuration
const collectorQueue = process.env.REDIS_URL ?
  new Bull('collector-jobs', process.env.REDIS_URL) :
  new Bull('collector-jobs', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    }
  })

// Store queues in app locals IMMEDIATELY after creating them
app.locals.queues = { collectorQueue }

// Setup Bull Dashboard
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')
createBullBoard({
  queues: [new BullAdapter(collectorQueue)],
  serverAdapter
})

// Job result interface
interface JobResult {
  strategy?: string
  reasoning?: string
  collectorsRun?: string[]
  results: CollectorResult[]
  totalCasesFound: number
  totalCasesProcessed: number
  errors: string[]
}

// Process jobs
collectorQueue.process(async (job) => {
  const { type } = job.data

  try {
    await job.progress(10)

    let results: CollectorResult[] = []
    let strategy: string | undefined
    let reasoning: string | undefined
    let collectorsRun: string[] | undefined

    if (type === 'all') {
      // Use AI-guided orchestrator
      logger.info('Using AI-guided orchestrator for collection')
      await job.progress(30)

      const orchestratorResult = await agenticOrchestrator.runCollection()

      results = orchestratorResult.results
      strategy = orchestratorResult.strategy
      reasoning = orchestratorResult.reasoning
      collectorsRun = orchestratorResult.collectorsRun

      logger.info(`AI Strategy: ${strategy} - ${reasoning}`)
      await job.progress(90)
    } else {
      // Run individual collector
      let collector: ExaCollector | FtcCollector | SecCollector

      switch (type) {
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
          throw new Error(`Unknown collector type: ${type}`)
      }

      await job.progress(30)
      const result = await collector.collect()
      results = [result]
      collectorsRun = [type]
      await job.progress(90)
    }

    const jobResult: JobResult = {
      strategy,
      reasoning,
      collectorsRun,
      results,
      totalCasesFound: results.reduce((sum, r) => sum + r.casesFound, 0),
      totalCasesProcessed: results.reduce((sum, r) => sum + r.casesProcessed, 0),
      errors: results.flatMap(r => r.errors)
    }

    await job.progress(100)
    return jobResult
  } catch (error) {
    logger.error(`Collector job failed: ${type}`, { jobId: job.id, error })
    throw error
  }
})

// Mount the Bull Dashboard
app.use('/admin/queues', serverAdapter.getRouter())

// Mount collector routes - app.locals.queues is already set above
app.use('/api/collectors', collectorRoutes)

// Mount health routes
app.use('/api/health', healthRoutes)

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Server error:', err)
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  })
})

// Cleanup completed jobs periodically
setInterval(async () => {
  try {
    const jobs = await collectorQueue.getJobs(['completed'], 0, 100)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    let cleaned = 0

    for (const job of jobs) {
      if (job.finishedOn && job.finishedOn < oneHourAgo) {
        await job.remove()
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old completed jobs`)
    }
  } catch (error) {
    logger.error('Failed to clean up jobs:', error)
  }
}, 60 * 60 * 1000)

// Start server
app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`)
  logger.info(`Bull Dashboard available at http://localhost:${PORT}/admin/queues`)
  logger.info('AI-guided orchestrator initialized')
}) 