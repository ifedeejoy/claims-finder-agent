import type { CollectorResult, ExtractedCase, EligibilityQuestion } from '../../types'
import { supabaseOps } from '../supabase/operations'
import { logger } from '../logger'
import { PlaywrightScraper } from './playwright-scraper'

export abstract class BaseCollector {
  protected scraper?: PlaywrightScraper

  constructor(protected sourceName: string) { }

  abstract collect(): Promise<CollectorResult>

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

  protected async processCase(
    extractedCase: ExtractedCase & { questions?: EligibilityQuestion[] },
    sourceType: string,
    sourceUrl: string,
    screenshotUrl?: string
  ): Promise<boolean> {
    try {
      // Get or create source
      const sourceId = await supabaseOps.getOrCreateSource(
        this.sourceName,
        sourceType,
        sourceUrl
      )

      // Save the case with all enhanced details
      await supabaseOps.saveCase(
        extractedCase,
        sourceId,
        sourceUrl,
        screenshotUrl
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