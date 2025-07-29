import Bull from 'bull'
import { processCollectorJob } from './processors/collector-processor'
import { processWebhookJob } from './processors/webhook-processor'
import { logger } from '../lib/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export interface CollectorJobData {
  type: 'exa' | 'sec' | 'ftc' | 'all' | 'continuous'
  options?: {
    domains?: string[]
    query?: string
    numResults?: number
  }
  schedule?: string
  monitoringType?: string
  timezone?: string
}

export interface WebhookJobData {
  url: string
  event: 'collection.completed' | 'collection.failed'
  data: any
}

export function setupQueues() {
  // Collector queue for running collection jobs
  const collectorQueue = new Bull<CollectorJobData>('collector-jobs', REDIS_URL, {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: 100,
      removeOnFail: 50
    }
  })

  // Webhook queue for notifying the frontend
  const webhookQueue = new Bull<WebhookJobData>('webhook-jobs', REDIS_URL, {
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  })

  // Process collector jobs
  collectorQueue.process(5, processCollectorJob)

  // Process webhook jobs
  webhookQueue.process(10, processWebhookJob)

  // Event listeners
  collectorQueue.on('completed', (job, result) => {
    logger.info(`Collector job ${job.id} completed`, { type: job.data.type, result })

    // Queue webhook notification
    if (process.env.WEBHOOK_URL) {
      webhookQueue.add({
        url: process.env.WEBHOOK_URL,
        event: 'collection.completed',
        data: {
          jobId: job.id,
          type: job.data.type,
          result
        }
      })
    }
  })

  collectorQueue.on('failed', (job, err) => {
    logger.error(`Collector job ${job?.id} failed`, {
      type: job?.data.type,
      error: err.message
    })

    // Queue webhook notification for failure
    if (process.env.WEBHOOK_URL && job) {
      webhookQueue.add({
        url: process.env.WEBHOOK_URL,
        event: 'collection.failed',
        data: {
          jobId: job.id,
          type: job.data.type,
          error: err.message
        }
      })
    }
  })

  collectorQueue.on('stalled', (job) => {
    logger.warn(`Collector job ${job.id} stalled`, { type: job.data.type })
  })

  return {
    collectorQueue,
    webhookQueue
  }
} 