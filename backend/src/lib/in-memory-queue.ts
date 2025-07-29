import { EventEmitter } from 'events'
import { logger } from './logger'

export interface Job<T = unknown> {
  id: string
  data: T
  progress: (progress: number) => Promise<void>
  finishedOn?: number
  remove: () => Promise<void>
  returnvalue?: unknown
  failedReason?: string
}

export class InMemoryQueue<T = unknown> extends EventEmitter {
  private jobs: Map<string, Job<T>> = new Map()
  private processor?: (job: Job<T>) => Promise<unknown>
  private processing = false
  private jobCounter = 0

  constructor(public name: string) {
    super()
    logger.info(`InMemoryQueue: Created queue ${name}`)
  }

  async add(data: T): Promise<Job<T>> {
    const jobId = `${this.name}-${++this.jobCounter}`
    const job: Job<T> = {
      id: jobId,
      data,
      progress: async (progress: number) => {
        logger.info(`Job ${jobId} progress: ${progress}%`)
      },
      remove: async () => {
        this.jobs.delete(jobId)
      }
    }

    this.jobs.set(jobId, job)
    logger.info(`InMemoryQueue: Added job ${jobId} to queue ${this.name}`)

    // Process job in next tick to simulate async behavior
    setImmediate(() => this.processNext())

    return job
  }

  process(processor: (job: Job<T>) => Promise<unknown>) {
    this.processor = processor
    logger.info(`InMemoryQueue: Processor registered for queue ${this.name}`)
  }

  private async processNext() {
    if (this.processing || !this.processor) return

    const pendingJobs = Array.from(this.jobs.values()).filter(
      job => !job.finishedOn && !job.failedReason
    )

    if (pendingJobs.length === 0) return

    this.processing = true
    const job = pendingJobs[0]

    try {
      logger.info(`InMemoryQueue: Processing job ${job.id}`)
      const result = await this.processor(job)
      job.returnvalue = result
      job.finishedOn = Date.now()
      this.emit('completed', job, result)
      logger.info(`InMemoryQueue: Job ${job.id} completed successfully`)
    } catch (error) {
      job.failedReason = error instanceof Error ? error.message : String(error)
      this.emit('failed', job, error)
      logger.error(`InMemoryQueue: Job ${job.id} failed`, error)
    } finally {
      this.processing = false
      // Process next job if available
      if (pendingJobs.length > 1) {
        setImmediate(() => this.processNext())
      }
    }
  }

  async getJobs(statuses: string[], start = 0, end = -1): Promise<Job<T>[]> {
    const allJobs = Array.from(this.jobs.values())
    const filteredJobs = allJobs.filter(job => {
      if (statuses.includes('completed') && job.finishedOn && !job.failedReason) return true
      if (statuses.includes('failed') && job.failedReason) return true
      if (statuses.includes('active') && !job.finishedOn && !job.failedReason && this.processing) return true
      if (statuses.includes('waiting') && !job.finishedOn && !job.failedReason && !this.processing) return true
      return false
    })

    const endIndex = end === -1 ? filteredJobs.length : end + 1
    return filteredJobs.slice(start, endIndex)
  }

  async getJob(jobId: string): Promise<Job<T> | null> {
    return this.jobs.get(jobId) || null
  }

  async close(): Promise<void> {
    this.jobs.clear()
    this.removeAllListeners()
  }
}

export class InMemoryBullAdapter {
  constructor(public queue: InMemoryQueue) { }

  getName() { return this.queue.name }
  getJobs() { return this.queue.getJobs(['waiting', 'active', 'completed', 'failed']) }
  getJobCounts() {
    return Promise.resolve({
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0
    })
  }
} 