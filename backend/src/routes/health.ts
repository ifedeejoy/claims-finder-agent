import { Router } from 'express'
import Bull from 'bull'
import { logger } from '../lib/logger'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { collectorQueue } = req.app.locals.queues || {}

    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      redis: {
        connected: false,
        url: process.env.REDIS_URL ? 'configured' : 'not configured'
      },
      queue: {
        ready: false,
        jobCounts: null
      }
    }

    if (collectorQueue) {
      try {
        const jobCounts = await collectorQueue.getJobCounts()
        health.queue.ready = true
        health.queue.jobCounts = jobCounts
        health.redis.connected = true
      } catch (error) {
        logger.error('Redis health check failed:', error)
        health.redis.connected = false
      }
    }

    res.json(health)
  } catch (error) {
    logger.error('Health check error:', error)
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router 