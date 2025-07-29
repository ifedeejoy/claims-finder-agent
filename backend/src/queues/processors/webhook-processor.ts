import { Job } from 'bull'
import { WebhookJobData } from '../collector-queue'
import { logger } from '../../lib/logger'

export async function processWebhookJob(job: Job<WebhookJobData>) {
  const { url, event, data } = job.data

  logger.info(`Processing webhook job ${job.id}`, { event, url })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': event,
        'X-Webhook-Timestamp': new Date().toISOString()
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data
      })
    })

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`)
    }

    const result = await response.json().catch(() => ({}))

    logger.info(`Webhook job ${job.id} completed`, {
      event,
      status: response.status
    })

    return result
  } catch (error) {
    logger.error(`Webhook job ${job.id} failed`, error)
    throw error
  }
} 