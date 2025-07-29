import express from 'express'
import cors from 'cors'
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

// In-memory job tracking (simple implementation)
interface JobInfo {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startTime: Date
  endTime?: Date
  result?: {
    strategy?: string
    reasoning?: string
    collectorsRun?: string[]
    results: CollectorResult[]
    totalCasesFound: number
    totalCasesProcessed: number
    errors: string[]
  }
  error?: string
}

const runningJobs = new Map<string, JobInfo>()

// Helper function to run collector
async function runCollector(type: string): Promise<JobInfo['result']> {
  let results: CollectorResult[] = []
  let strategy: string | undefined
  let reasoning: string | undefined
  let collectorsRun: string[] | undefined

  if (type === 'all') {
    // Use AI-guided orchestrator
    logger.info('Using AI-guided orchestrator for collection')
    const orchestratorResult = await agenticOrchestrator.runCollection()

    results = orchestratorResult.results
    strategy = orchestratorResult.strategy
    reasoning = orchestratorResult.reasoning
    collectorsRun = orchestratorResult.collectorsRun

    logger.info(`AI Strategy: ${strategy} - ${reasoning}`)
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

    const result = await collector.collect()
    results = [result]
    collectorsRun = [type]
  }

  return {
    strategy,
    reasoning,
    collectorsRun,
    results,
    totalCasesFound: results.reduce((sum, r) => sum + r.casesFound, 0),
    totalCasesProcessed: results.reduce((sum, r) => sum + r.casesProcessed, 0),
    errors: results.flatMap(r => r.errors)
  }
}

// Routes
app.post('/api/collectors/run', async (req, res) => {
  const { type = 'all' } = req.body
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const job: JobInfo = {
    id: jobId,
    type,
    status: 'pending',
    startTime: new Date()
  }

  runningJobs.set(jobId, job)

  // Run collector in background
  setImmediate(async () => {
    try {
      job.status = 'running'
      logger.info(`Starting collector job: ${type}`, { jobId })

      const result = await runCollector(type)

      job.status = 'completed'
      job.endTime = new Date()
      job.result = result

      logger.info(`Collector job completed: ${type}`, {
        jobId,
        casesFound: job.result?.totalCasesFound || 0,
        duration: job.endTime ? `${(job.endTime.getTime() - job.startTime.getTime()) / 1000}s` : '0s'
      })
    } catch (error) {
      job.status = 'failed'
      job.endTime = new Date()
      job.error = error instanceof Error ? error.message : 'Unknown error'

      logger.error(`Collector job failed: ${type}`, { jobId, error })
    }
  })

  res.json({
    success: true,
    data: {
      jobId,
      message: `Collector job ${type} started`,
      status: 'pending'
    }
  })
})

app.get('/api/collectors/jobs/:jobId', (req, res) => {
  const job = runningJobs.get(req.params.jobId)

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    })
  }

  res.json({
    success: true,
    data: {
      id: job.id,
      type: job.type,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      duration: job.endTime ?
        (job.endTime.getTime() - job.startTime.getTime()) / 1000 :
        undefined,
      result: job.result,
      error: job.error
    }
  })
})

app.get('/api/collectors/jobs', (req, res) => {
  const jobs = Array.from(runningJobs.values())
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, 50) // Return last 50 jobs

  res.json({
    success: true,
    data: jobs.map(job => ({
      id: job.id,
      type: job.type,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      casesFound: job.result?.totalCasesFound,
      casesProcessed: job.result?.totalCasesProcessed,
      strategy: job.result?.strategy,
      reasoning: job.result?.reasoning,
      error: job.error
    }))
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
})

// Start server
app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`)
  logger.info('AI-guided orchestrator initialized')
})

// Cleanup old jobs every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000
  let cleaned = 0

  for (const [jobId, job] of runningJobs.entries()) {
    if (job.startTime.getTime() < oneHourAgo && job.status !== 'running') {
      runningJobs.delete(jobId)
      cleaned++
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} old jobs`)
  }
}, 60 * 60 * 1000) 