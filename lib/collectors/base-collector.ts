import { geminiService } from '@/lib/ai/gemini'
import { db } from '@/lib/supabase/operations'
import type { CollectorResult, ExtractedCase } from '@/types'
import { CollectorError } from '@/types'

export abstract class BaseCollector {
  protected sourceName: string
  protected sourceType: 'exa' | 'sec' | 'ftc' | 'native'

  constructor(sourceName: string, sourceType: 'exa' | 'sec' | 'ftc' | 'native') {
    this.sourceName = sourceName
    this.sourceType = sourceType
  }

  /**
   * Main collection method - each collector implements this
   */
  abstract collect(): Promise<CollectorResult>

  /**
   * Process raw content into structured cases
   */
  protected async processContent(
    content: string, 
    sourceUrl: string, 
    _sourceId?: string
  ): Promise<ExtractedCase | null> {
    try {
      // First, check if this content contains legal opportunities
      const isLegal = await geminiService.isLegalOpportunity(content)
      if (!isLegal) {
        return null
      }

      // Extract structured case details
      const extractedCase = await geminiService.extractCaseDetails(content, sourceUrl)
      
      // Validate that we have minimum required information
      if (!extractedCase.title || !extractedCase.description) {
        throw new CollectorError(
          'Extracted case missing required fields',
          this.sourceName,
          'ai'
        )
      }

      return extractedCase
    } catch (error) {
      if (error instanceof CollectorError) {
        throw error
      }
      throw new CollectorError(
        `Content processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'ai'
      )
    }
  }

  /**
   * Save or update case in database with comprehensive duplicate detection
   */
  protected async saveCase(
    extractedCase: ExtractedCase, 
    sourceId: string, 
    sourceUrl: string
  ): Promise<void> {
    try {
      // 1. Check for exact URL match
      if (extractedCase.claimUrl) {
        const existingCase = await db.findCaseByUrl(extractedCase.claimUrl)
        if (existingCase) {
          this.log(`Skipping duplicate case by URL: ${extractedCase.title}`, 'info')
          return
        }
      }

      // 2. Check by source URL if different from claim URL
      if (sourceUrl !== extractedCase.claimUrl) {
        const existingCase = await db.findCaseByUrl(sourceUrl)
        if (existingCase) {
          this.log(`Skipping duplicate case by source URL: ${extractedCase.title}`, 'info')
          return
        }
      }

      // 3. Check for similar titles (exact match first)
      const similarCases = await db.findSimilarCases(extractedCase.title)
      if (similarCases.length > 0) {
        // Check for content similarity
        const recentCases = await db.getRecentCasesForDuplicateCheck(72) // 3 days
        
        if (recentCases.length > 0) {
          const isDuplicate = await geminiService.detectDuplicates(
            extractedCase, 
            recentCases.map(c => ({
              title: c.title,
              description: c.description,
              claimUrl: c.claimUrl,
              category: c.category
            }))
          )

          if (isDuplicate) {
            this.log(`Skipping duplicate case detected: ${extractedCase.title}`, 'info')
            return
          }
        }
      }

      // 4. All checks passed - create new case
      await db.createCase(extractedCase, sourceId)
      this.log(`Successfully saved new case: ${extractedCase.title}`, 'info')
      
    } catch (error) {
      throw new CollectorError(
        `Database save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'database'
      )
    }
  }

  /**
   * Get or create source in database
   */
  protected async getOrCreateSource(url?: string): Promise<string> {
    try {
      // Try to find existing source
      const sources = await db.getActiveSources()
      const existingSource = sources.find(s => s.name === this.sourceName)
      
      if (existingSource) {
        // Update last checked timestamp
        await db.updateSourceLastChecked(existingSource.id)
        return existingSource.id
      }

      // Create new source
      const newSource = await db.createSource({
        name: this.sourceName,
        type: this.sourceType,
        url: url || null,
        lastChecked: new Date(),
        isActive: true,
        config: null
      })

      return newSource.id
    } catch (error) {
      throw new CollectorError(
        `Source management failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'database'
      )
    }
  }

  /**
   * Clean and normalize text content
   */
  protected cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim()
  }

  /**
   * Extract domain from URL
   */
  protected getDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'unknown'
    }
  }

  /**
   * Rate limiting helper
   */
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Check and mark expired cases based on deadline dates
   */
  protected async checkAndMarkExpiredCases(): Promise<number> {
    try {
      const activeCases = await db.getActiveCases(1000) // Get all active cases
      const today = new Date()
      let expiredCount = 0

      for (const legalCase of activeCases) {
        if (legalCase.deadlineDate && new Date(legalCase.deadlineDate) < today) {
          await db.markCaseAsExpired(legalCase.id)
          expiredCount++
          this.log(`Marked case as expired: ${legalCase.title}`, 'info')
        }
      }

      if (expiredCount > 0) {
        this.log(`Marked ${expiredCount} cases as expired`, 'info')
      }

      return expiredCount
    } catch (error) {
      this.log(`Failed to check for expired cases: ${error}`, 'warn')
      return 0
    }
  }

  /**
   * Get cases processed in the last N hours for duplicate checking
   */
  protected async getRecentlyProcessedUrls(hours = 24): Promise<Set<string>> {
    try {
      const recentCases = await db.getRecentCasesForDuplicateCheck(hours)
      const urls = new Set<string>()
      
      recentCases.forEach(c => {
        if (c.claimUrl) urls.add(c.claimUrl)
      })

      return urls
    } catch (error) {
      this.log(`Failed to get recently processed URLs: ${error}`, 'warn')
      return new Set()
    }
  }

  /**
   * Quick URL check before processing (fast duplicate prevention)
   */
  protected async isUrlAlreadyProcessed(url: string): Promise<boolean> {
    try {
      const existingCase = await db.findCaseByUrl(url)
      return existingCase !== null
    } catch (error) {
      this.log(`Failed to check if URL already processed: ${error}`, 'warn')
      return false
    }
  }

  /**
   * Log collection activity
   */
  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString()
    console[level](`[${timestamp}] [${this.sourceName}] ${message}`)
  }
}
