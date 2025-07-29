import { Router } from 'express'
import { logger } from '../lib/logger'

const router = Router()

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  })
})

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        rss: process.memoryUsage().rss / 1024 / 1024
      },
      services: {
        gemini: !!process.env.GEMINI_API_KEY,
        exa: !!process.env.EXA_API_KEY,
        supabase: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    }

    res.json(health)
  } catch (error) {
    logger.error('Health check failed', error)
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to get detailed health status'
    })
  }
})

export default router 