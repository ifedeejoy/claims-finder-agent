import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createBullBoard } from '@bull-board/api'
import { BullAdapter } from '@bull-board/api/bullAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { setupQueues } from './queues/collector-queue'
import { initializeCronJobs } from './cron/scheduler'
import { logger } from './lib/logger'
import collectorRoutes from './routes/collectors'
import healthRoutes from './routes/health'
import webhookRoutes from './routes/webhooks'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json())

// Setup Bull queues
const queues = setupQueues()

// Setup Bull Dashboard
const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/admin/queues')
const { addQueue } = createBullBoard({
  queues: Object.values(queues).map(queue => new BullAdapter(queue)),
  serverAdapter
})

// Routes
app.use('/api/collectors', collectorRoutes)
app.use('/api/health', healthRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/admin/queues', serverAdapter.getRouter())

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
  logger.info(`Backend server running on port ${PORT}`)
  logger.info(`Bull Dashboard available at http://localhost:${PORT}/admin/queues`)

  // Setup cron jobs
  if (process.env.ENABLE_CRON === 'true') {
    initializeCronJobs()
    logger.info('Cron jobs initialized')
  }
}) 