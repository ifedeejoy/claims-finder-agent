import cron from 'node-cron'
import { logger } from '../lib/logger'
import { agenticOrchestrator } from '../lib/ai/agentic-orchestrator'
import { ExaCollector } from '../lib/collectors/exa-collector'
import { FtcCollector } from '../lib/collectors/ftc-collector'
import { SecCollector } from '../lib/collectors/sec-collector'

export function initializeCronJobs() {
  logger.info('Initializing cron jobs')

  // Main AI-guided collection every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    logger.info('Starting scheduled AI-guided collection')
    try {
      const result = await agenticOrchestrator.runCollection()
      logger.info('Scheduled AI collection completed', {
        strategy: result.strategy,
        collectorsRun: result.collectorsRun,
        casesFound: result.results.reduce((sum, r) => sum + r.casesFound, 0),
        casesProcessed: result.results.reduce((sum, r) => sum + r.casesProcessed, 0)
      })
    } catch (error) {
      logger.error('Scheduled AI collection failed', error)
    }
  })

  // Quick Exa search every 2 hours (for time-sensitive opportunities)
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Starting scheduled Exa quick search')
    try {
      const collector = new ExaCollector()
      const result = await collector.collect()
      logger.info('Scheduled Exa search completed', {
        casesFound: result.casesFound,
        casesProcessed: result.casesProcessed
      })
    } catch (error) {
      logger.error('Scheduled Exa search failed', error)
    }
  })

  // FTC check daily at 10 AM EST (3 PM UTC)
  cron.schedule('0 15 * * *', async () => {
    logger.info('Starting scheduled FTC collection')
    try {
      const collector = new FtcCollector()
      const result = await collector.collect()
      logger.info('Scheduled FTC collection completed', {
        casesFound: result.casesFound,
        casesProcessed: result.casesProcessed
      })
    } catch (error) {
      logger.error('Scheduled FTC collection failed', error)
    }
  })

  // SEC check daily at 5 PM EST (10 PM UTC) - after market close
  cron.schedule('0 22 * * *', async () => {
    logger.info('Starting scheduled SEC collection')
    try {
      const collector = new SecCollector()
      const result = await collector.collect()
      logger.info('Scheduled SEC collection completed', {
        casesFound: result.casesFound,
        casesProcessed: result.casesProcessed
      })
    } catch (error) {
      logger.error('Scheduled SEC collection failed', error)
    }
  })

  // Query optimization weekly on Sundays at 2 AM
  cron.schedule('0 2 * * 0', async () => {
    logger.info('Starting weekly query optimization')
    try {
      const currentQueries = [
        'class action settlement deadline 2024',
        'consumer refund program',
        'FTC settlement claims',
        'data breach compensation'
      ]

      const optimizedQueries = await agenticOrchestrator.optimizeSearchQueries(currentQueries)
      logger.info('Query optimization completed', {
        originalCount: currentQueries.length,
        optimizedCount: optimizedQueries.length,
        queries: optimizedQueries
      })

      // TODO: Store optimized queries for next collection runs
    } catch (error) {
      logger.error('Query optimization failed', error)
    }
  })

  // Source discovery monthly on the 1st at 3 AM
  cron.schedule('0 3 1 * *', async () => {
    logger.info('Starting monthly source discovery')
    try {
      const newSources = await agenticOrchestrator.discoverSources()
      logger.info('Source discovery completed', {
        newSourcesFound: newSources.length,
        sources: newSources
      })

      // TODO: Add new sources to collection rotation
    } catch (error) {
      logger.error('Source discovery failed', error)
    }
  })

  logger.info('Cron jobs initialized with AI-guided scheduling')
} 