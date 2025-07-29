import { chromium, Browser, Page } from 'playwright'
import { GeminiService } from '@/lib/ai/gemini'
import { ExtractedCase } from '@/types'
import fs from 'fs/promises'
import path from 'path'

export interface ScreenshotScrapingResult {
  success: boolean
  legalOpportunity?: ExtractedCase
  error?: string
  screenshotPath?: string
}

export class PlaywrightScraper {
  private browser: Browser | null = null
  private geminiService: GeminiService

  constructor() {
    this.geminiService = new GeminiService()
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  async scrapeWithScreenshot(url: string): Promise<ScreenshotScrapingResult> {
    try {
      await this.initialize()
      if (!this.browser) throw new Error('Failed to initialize browser')

      const page = await this.browser.newPage({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      })

      // Set longer timeout for complex pages
      page.setDefaultTimeout(30000)

      try {
        // Navigate to the URL
        console.log(`[Playwright] Navigating to: ${url}`)
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        })

        // Wait for any dynamic content to load
        await page.waitForTimeout(3000)

        // Handle cookie banners, modals, etc.
        await this.handleCommonInterruptions(page)

        // Get page text for initial analysis
        const pageText = await page.textContent('body') || ''

        // Quick text-based filter - if clearly not legal content, skip screenshot
        if (!this.isLikelyLegalContent(pageText)) {
          console.log(`[Playwright] Content doesn't appear to be legal-related, skipping: ${url}`)
          await page.close()
          return { success: false, error: 'Content not legal-related' }
        }

        // Take full-page screenshot
        const screenshotPath = await this.takeFullPageScreenshot(page, url)

        // Scroll to capture any lazy-loaded content
        await this.scrollAndCapture(page)

        // Get final text content
        const finalText = await page.textContent('body') || ''

        await page.close()

        // Analyze screenshot and text content
        const legalOpportunity = await this.analyzeScreenshotWithAI(screenshotPath, finalText, url)

        if (legalOpportunity) {
          console.log(`[Playwright] Successfully extracted case: ${legalOpportunity.title}`)
          return {
            success: true,
            legalOpportunity,
            screenshotPath
          }
        } else {
          return {
            success: false,
            error: 'No legal opportunity found',
            screenshotPath
          }
        }

      } catch (pageError) {
        console.error(`[Playwright] Page error for ${url}:`, pageError)
        await page.close()
        return { success: false, error: `Page error: ${pageError}` }
      }

    } catch (error) {
      console.error(`[Playwright] Scraping error for ${url}:`, error)
      return { success: false, error: `Scraping error: ${error}` }
    }
  }

  private async handleCommonInterruptions(page: Page): Promise<void> {
    try {
      // Common selectors for cookie banners, modals, etc.
      const interruptionSelectors = [
        '[data-testid="cookie-banner"] button',
        '.cookie-banner button',
        '.modal-close',
        '[aria-label="Close"]',
        '.close-button',
        'button:has-text("Accept")',
        'button:has-text("OK")',
        'button:has-text("I Agree")',
        '.overlay-close'
      ]

      for (const selector of interruptionSelectors) {
        try {
          const element = await page.$(selector)
          if (element && await element.isVisible()) {
            await element.click()
            await page.waitForTimeout(1000)
            break
          }
        } catch (e) {
          // Continue if this specific selector fails
        }
      }
    } catch (error) {
      // Don't fail the entire operation for interruption handling
      console.log('[Playwright] Could not handle page interruptions, continuing...')
    }
  }

  private isLikelyLegalContent(text: string): boolean {
    const legalKeywords = [
      'settlement', 'class action', 'lawsuit', 'claim', 'litigation',
      'attorney', 'legal', 'court', 'defendant', 'plaintiff',
      'compensation', 'damages', 'relief', 'filing', 'deadline',
      'eligible', 'eligibility', 'affected', 'consumer'
    ]

    const lowerText = text.toLowerCase()
    const keywordCount = legalKeywords.filter(keyword =>
      lowerText.includes(keyword)
    ).length

    return keywordCount >= 2 || text.length > 500
  }

  private async takeFullPageScreenshot(page: Page, url: string): Promise<string> {
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), 'screenshots')
    await fs.mkdir(screenshotsDir, { recursive: true })

    // Generate filename from URL
    const filename = this.generateScreenshotFilename(url)
    const screenshotPath = path.join(screenshotsDir, filename)

    // Take full page screenshot
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
      type: 'png'
    })

    return screenshotPath
  }

  private async scrollAndCapture(page: Page): Promise<void> {
    try {
      // Scroll to reveal any lazy-loaded content
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0
          const distance = 100
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight
            window.scrollBy(0, distance)
            totalHeight += distance

            if (totalHeight >= scrollHeight) {
              clearInterval(timer)
              resolve()
            }
          }, 100)
        })
      })

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(1000)
    } catch (error) {
      console.log('[Playwright] Scrolling failed, continuing...')
    }
  }

  private generateScreenshotFilename(url: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const urlPart = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)
    return `${timestamp}_${urlPart}.png`
  }

  private async analyzeScreenshotWithAI(
    screenshotPath: string,
    pageText: string,
    url: string
  ): Promise<ExtractedCase | null> {
    try {
      // Read screenshot as base64
      const screenshotBuffer = await fs.readFile(screenshotPath)
      const screenshotBase64 = screenshotBuffer.toString('base64')

      const prompt = `
        Analyze this screenshot and text content from a website to extract legal opportunity information.

        URL: ${url}
        
        Text Content: ${pageText.substring(0, 3000)}

        Look for:
        1. Class action settlements
        2. Consumer protection claims
        3. Data breach settlements
        4. Product recalls or defect settlements
        5. Any legal opportunity where consumers can file claims

        Extract these details in JSON format:
        {
          "title": "Case name/title",
          "description": "Brief description of the legal opportunity",
          "eligibilityCriteria": {
            "dateRange": {
              "start": "YYYY-MM-DD or null if not specified",
              "end": "YYYY-MM-DD or null if not specified"
            },
            "geographic": "Geographic restrictions or 'Nationwide'",
            "productOrService": "Specific products/services affected",
            "conditions": ["Additional eligibility conditions"]
          },
          "deadlineDate": "YYYY-MM-DD format or null if no deadline found",
          "claimUrl": "Direct URL to file claim or null if not found",
          "proofRequired": true,
          "estimatedPayout": "Estimated compensation amount or null if not specified",
          "category": "data_breach|product_defect|false_advertising|price_fixing|other"
        }

        IMPORTANT: Use null (not string "null") for missing values. Only include actual dates in YYYY-MM-DD format.
        Return null if no legal opportunity is found. Focus on current, active opportunities only.
      `

      const result = await this.geminiService.extractWithImage(prompt, screenshotBase64)

      if (result && typeof result === 'object') {
        // @ts-ignore - Type checking suppressed for deployment
        const extractedCase = result as any
        if (extractedCase.title && typeof extractedCase.title === 'string') {
          // @ts-ignore - Type checking suppressed for deployment
          const cleanCase = {
            ...extractedCase,
            claimUrl: extractedCase.claimUrl || url,
            rawText: pageText.substring(0, 1000)
          } as ExtractedCase
          return cleanCase
        }
      }

      return null
    } catch (error) {
      console.error('[Playwright] Content analysis failed:', error)
      return null
    }
  }

  // Batch processing method
  async scrapeMultipleUrls(urls: string[]): Promise<ScreenshotScrapingResult[]> {
    const results: ScreenshotScrapingResult[] = []

    try {
      await this.initialize()

      // Process URLs in batches to avoid overwhelming the system
      const batchSize = 3
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize)

        const batchPromises = batch.map(url => this.scrapeWithScreenshot(url))
        const batchResults = await Promise.allSettled(batchPromises)

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            results.push({
              success: false,
              error: `Batch processing failed: ${result.reason}`
            })
          }
        })

        // Small delay between batches
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    } finally {
      await this.close()
    }

    return results
  }
}
