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

// Routes
app.post('/api/collectors/run', async (req, res) => {
  try {
    const { type = 'all' } = req.body

    const job = await collectorQueue.add({
      type,
      startedAt: new Date().toISOString()
    }, {
      removeOnComplete: false,
      removeOnFail: false
    })

    logger.info(`Created collector job: ${type}`, { jobId: job.id })

    res.json({
      success: true,
      data: {
        jobId: job.id,
        message: `Collector job ${type} started`,
        status: 'pending'
      }
    })
  } catch (error) {
    logger.error('Failed to create job:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create job'
    })
  }
})

app.get('/api/collectors/jobs/:jobId', async (req, res) => {
  try {
    const job = await collectorQueue.getJob(req.params.jobId)

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      })
    }

    const state = await job.getState()
    const progress = job.progress()

    res.json({
      success: true,
      data: {
        id: job.id,
        type: job.data.type,
        status: state,
        progress,
        startTime: job.timestamp,
        endTime: job.finishedOn,
        duration: job.finishedOn && job.timestamp ?
          (job.finishedOn - job.timestamp) / 1000 :
          undefined,
        result: job.returnvalue,
        error: job.failedReason
      }
    })
  } catch (error) {
    logger.error('Failed to get job:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    })
  }
})

app.get('/api/collectors/jobs', async (req, res) => {
  try {
    const jobs = await collectorQueue.getJobs(['completed', 'failed', 'active', 'waiting', 'delayed'], 0, 50)

    const jobsData = await Promise.all(jobs.map(async (job) => {
      const state = await job.getState()
      return {
        id: job.id,
        type: job.data.type,
        status: state,
        startTime: job.timestamp,
        endTime: job.finishedOn,
        casesFound: job.returnvalue?.totalCasesFound,
        casesProcessed: job.returnvalue?.totalCasesProcessed,
        strategy: job.returnvalue?.strategy,
        reasoning: job.returnvalue?.reasoning,
        error: job.failedReason
      }
    }))

    res.json({
      success: true,
      data: jobsData
    })
  } catch (error) {
    logger.error('Failed to list jobs:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to list jobs'
    })
  }
})

app.get('/api/health', async (req, res) => {
  try {
    // Check Redis connection
    await collectorQueue.isReady()

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      redis: 'connected'
    })
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      redis: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Bull Dashboard
app.use('/admin/queues', serverAdapter.getRouter())

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
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