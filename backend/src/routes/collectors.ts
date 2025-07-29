/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express'
import { CollectorJobData } from '../queues/collector-queue'
import { logger } from '../lib/logger'

const router = Router()

// Define monitoring schedules
const MONITORING_SCHEDULES: Record<string, { cron: string; description: string }> = {
  newsFeeds: { cron: '*/15 * * * *', description: 'Every 15 minutes - News & emerging opportunities' },
  secFilings: { cron: '0 * * * *', description: 'Every hour - SEC EDGAR filings' },
  ftcAnnouncements: { cron: '0 */2 * * *', description: 'Every 2 hours - FTC & regulatory updates' },
  deepAnalysis: { cron: '0 9 * * *', description: 'Daily at 9 AM - Deep pattern analysis' },
  weekendScan: { cron: '0 10 * * SAT,SUN', description: 'Weekend scan for missed opportunities' }
}

// Start continuous monitoring
router.post('/monitor/start', async (req, res) => {
  try {
    const { collectorQueue } = req.app.locals.queues
    const { schedules = Object.keys(MONITORING_SCHEDULES) } = req.body

    const scheduledJobs = []

    for (const schedule of schedules) {
      if (MONITORING_SCHEDULES[schedule]) {
        const jobOptions = {
          repeat: {
            cron: MONITORING_SCHEDULES[schedule].cron,
            tz: req.body.timezone || 'America/New_York'
          },
          removeOnComplete: { count: 10 },
          removeOnFail: { count: 5 }
        }

        const job = await collectorQueue.add(
          `monitor-${schedule}`,
          {
            type: 'continuous',
            schedule,
            monitoringType: schedule,
            timezone: req.body.timezone
          } as CollectorJobData,
          jobOptions
        )

        scheduledJobs.push({
          id: job.id,
          schedule,
          description: MONITORING_SCHEDULES[schedule].description
        })

        logger.info(`Started monitoring job: ${schedule}`, {
          jobId: job.id,
          cron: MONITORING_SCHEDULES[schedule].cron
        })
      }
    }

    res.json({
      success: true,
      message: 'Continuous monitoring started',
      scheduledJobs
    })
  } catch (error) {
    logger.error('Failed to start monitoring', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start monitoring'
    })
  }
})

// Stop continuous monitoring
router.post('/monitor/stop', async (req, res) => {
  try {
    const { collectorQueue } = req.app.locals.queues
    const { schedules = Object.keys(MONITORING_SCHEDULES) } = req.body

    let removedCount = 0

    for (const schedule of schedules) {
      const repeatableJobs = await collectorQueue.getRepeatableJobs()
      const jobsToRemove = repeatableJobs.filter((job: any) => job.name === `monitor-${schedule}`)

      for (const job of jobsToRemove) {
        await collectorQueue.removeRepeatableByKey(job.key)
        removedCount++
      }
    }

    logger.info(`Stopped ${removedCount} monitoring jobs`)

    res.json({
      success: true,
      message: `Stopped ${removedCount} monitoring jobs`
    })
  } catch (error) {
    logger.error('Failed to stop monitoring', error)
    res.status(500).json({
      success: false,
      error: 'Failed to stop monitoring'
    })
  }
})

// Get monitoring status
router.get('/monitor/status', async (req, res) => {
  try {
    // Debug log
    logger.info('req.app.locals keys:', Object.keys(req.app.locals || {}))
    logger.info('req.app.locals.queues:', req.app.locals.queues)

    if (!req.app.locals.queues || !req.app.locals.queues.collectorQueue) {
      return res.status(500).json({
        success: false,
        error: 'Queue not initialized',
        details: 'req.app.locals.queues is undefined or missing collectorQueue',
        appLocalsKeys: Object.keys(req.app.locals || {})
      })
    }

    const { collectorQueue } = req.app.locals.queues

    // Get repeatable jobs from Bull
    const repeatableJobs = await collectorQueue.getRepeatableJobs ?
      await collectorQueue.getRepeatableJobs() : []

    const activeMonitors = repeatableJobs
      .filter((job: any) => job.name && job.name.startsWith('monitor-'))
      .map((job: any) => ({
        name: job.name.replace('monitor-', ''),
        cron: job.cron,
        timezone: job.tz,
        nextRun: job.next ? new Date(job.next) : null,
        description: MONITORING_SCHEDULES[job.name.replace('monitor-', '')]?.description
      }))

    res.json({
      success: true,
      data: {
        active: activeMonitors.length > 0,
        monitors: activeMonitors
      }
    })
  } catch (error) {
    logger.error('Failed to get monitoring status', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring status',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Queue collector job (existing endpoint)
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

// Enhanced job status with performance metrics
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

    // Extract performance metrics from result
    const result = job.returnvalue || {}
    const performanceMetrics = {
      casesFound: result.totalCasesFound || 0,
      casesProcessed: result.totalCasesProcessed || 0,
      sourcesChecked: result.collectorsRun?.length || 0,
      strategy: result.strategy || 'unknown',
      duration: job.finishedOn && job.processedOn ?
        job.finishedOn - job.processedOn : null
    }

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
        failedReason: job.failedReason,
        performanceMetrics
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

// Get active jobs (existing endpoint with enhancements)
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
        active: active.map((job: any) => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp
        })),
        waiting: waiting.map((job: any) => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp
        })),
        completed: completed.slice(0, 10).map((job: any) => ({
          id: job.id,
          type: job.data.type,
          createdAt: job.timestamp,
          finishedAt: job.finishedOn
        })),
        failed: failed.slice(0, 10).map((job: any) => ({
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

// Get system performance metrics
router.get('/metrics', async (req, res) => {
  try {
    const { collectorQueue } = req.app.locals.queues

    const [completed, failed] = await Promise.all([
      collectorQueue.getCompleted(100),
      collectorQueue.getFailed(100)
    ])

    // Calculate metrics
    const totalCasesFound = completed.reduce((sum: number, job: any) =>
      sum + (job.returnvalue?.totalCasesFound || 0), 0
    )

    const avgDuration = completed
      .filter((job: any) => job.finishedOn && job.processedOn)
      .reduce((sum: number, job: any, _: number, arr: any[]) =>
        sum + (job.finishedOn - job.processedOn) / arr.length, 0
      )

    const successRate = completed.length / (completed.length + failed.length) || 0

    res.json({
      success: true,
      data: {
        totalJobs: completed.length + failed.length,
        successRate: (successRate * 100).toFixed(2) + '%',
        totalCasesFound,
        avgJobDuration: Math.round(avgDuration / 1000) + 's',
        last24Hours: {
          completed: completed.filter((job: any) =>
            job.finishedOn > Date.now() - 24 * 60 * 60 * 1000
          ).length,
          failed: failed.filter((job: any) =>
            job.finishedOn > Date.now() - 24 * 60 * 60 * 1000
          ).length
        }
      }
    })
  } catch (error) {
    logger.error('Failed to get metrics', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get metrics'
    })
  }
})

export default router 