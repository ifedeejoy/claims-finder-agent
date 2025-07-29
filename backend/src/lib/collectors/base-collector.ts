import type { CollectorResult, ExtractedCase, EligibilityQuestion } from '../../types'
import { db } from '../supabase/operations'
import { logger } from '../logger'
import { PlaywrightScraper } from './playwright-scraper'

export abstract class BaseCollector {
  protected scraper?: PlaywrightScraper

  constructor(protected sourceName: string) { }

  abstract collect(): Promise<CollectorResult>

  protected log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
    const prefix = `[${this.sourceName}]`
    switch (level) {
      case 'error':
        logger.error(`${prefix} ${message}`)
        break
      case 'warn':
        logger.warn(`${prefix} ${message}`)
        break
      default:
        logger.info(`${prefix} ${message}`)
    }
  }

  protected async initializeScraper() {
    if (!this.scraper) {
      this.scraper = new PlaywrightScraper()
      await this.scraper.initialize()
    }
  }

  protected async closeScraper() {
    if (this.scraper) {
      await this.scraper.close()
      this.scraper = undefined
    }
  }

  protected async getOrCreateSource(name: string, type: string, url: string): Promise<string> {
    try {
      // Check if source exists
      const existing = await db.findSourceByName(name)
      if (existing) {
        return existing.id
      }

      // Create new source
      const newSource = await db.createSource({
        name,
        type: type as 'exa' | 'sec' | 'ftc' | 'native',
        url,
        lastChecked: new Date(),
        isActive: true,
        config: {}
      })

      return newSource.id
    } catch (error) {
      this.log(`Failed to get or create source: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      throw error
    }
  }

  protected async processCase(
    extractedCase: ExtractedCase & { questions?: EligibilityQuestion[] },
    sourceType: string,
    sourceUrl: string,
    screenshotUrl?: string
  ): Promise<boolean> {
    try {
      // Get or create source
      const sourceId = await this.getOrCreateSource(
        this.sourceName,
        sourceType,
        sourceUrl
      )

      // Save the case with all enhanced details
      await db.upsertCase(
        extractedCase,
        sourceId,
        extractedCase.claimUrl || sourceUrl
      )

      return true
    } catch (error) {
      logger.error(`Failed to process case: ${extractedCase.title}`, error)
      return false
    }
  }

  protected createResult(
    casesFound: number,
    casesProcessed: number,
    errors: string[],
    startTime: number
  ): CollectorResult {
    return {
      sourceName: this.sourceName,
      casesFound,
      casesProcessed,
      errors,
      duration: Date.now() - startTime
    }
  }
} 