import { Router } from 'express'
import { CollectorJobData } from '../queues/collector-queue'
import { logger } from '../lib/logger'

const router = Router()

// Queue collector job
router.post('/run', async (req, res) => {
  try {
    const { type = 'all', options } = req.body

    // Validate collector type
    if (!['exa', 'sec', 'ftc', 'all'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collector type'
      })
    }

    // Get queue from app locals (set in server.ts)
    const { collectorQueue } = req.app.locals.queues

    // Add job to queue
    const job = await collectorQueue.add({
      type,
      options
    } as CollectorJobData)

    logger.info(`Queued collector job`, { jobId: job.id, type })

    res.json({
      success: true,
      data: {
        jobId: job.id,
        type,
        status: 'queued'
      }
    })
  } catch (error) {
    logger.error('Failed to queue collector job', error)
    res.status(500).json({
      success: false,
      error: 'Failed to queue collector job'
    })
  }
})

// Get job status
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params
    const { collectorQueue } = req.app.locals.queues

    const job = await collectorQueue.getJob(jobId)

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
        state,
        progress,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn,
        result: job.returnvalue,
        failedReason: job.failedReason
      }
    })
  } catch (error) {
    logger.error('Failed to get job status', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    })
  }
})

// Get active jobs
router.get('/jobs', async (req, res) => {
  try {
    const { collectorQueue } = req.app.locals.queues

    const [active, waiting, completed, failed] = await Promise.all([
      collectorQueue.getActive(),
      collectorQueue.getWaiting(),
      collectorQueue.getCompleted(),
      collectorQueue.getFailed()
    ])

    res.json({
      success: true,
      data: {
        active: active.map(job => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp
        })),
        waiting: waiting.map(job => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp
        })),
        completed: completed.slice(0, 10).map(job => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp,
          finishedAt: job.finishedOn
        })),
        failed: failed.slice(0, 10).map(job => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp,
          failedReason: job.failedReason
        }))
      }
    })
  } catch (error) {
    logger.error('Failed to get jobs', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get jobs'
    })
  }
})

export default router 