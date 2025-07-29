import { BaseCollector } from './base-collector'
import { CollectorError, type CollectorResult } from '@/types'

interface SecFiling {
  cik: string
  company: string
  form: string
  filingDate: string
  reportDate: string
  acceptanceDateTime: string
  accessionNumber: string
  act: string
  fileNumber: string
  filmNumber: string
  items: string[]
  size: number
  isXBRL: boolean
  isInlineXBRL: boolean
  primaryDocument: string
  primaryDocDescription: string
}

interface SecCompanyData {
  cik: string
  entityType: string
  sic: string
  sicDescription: string
  insiderTransactionForOwnerExists: boolean
  insiderTransactionForIssuerExists: boolean
  name: string
  tickers: string[]
  exchanges: string[]
  ein: string
  description: string
  website: string
  investorWebsite: string
  category: string
  fiscalYearEnd: string
  stateOfIncorporation: string
  stateOfIncorporationDescription: string
  addresses: Record<string, unknown>
  phone: string
  flags: string
  formerNames: Array<Record<string, unknown>>
  filings: {
    recent: {
      accessionNumber: string[]
      filingDate: string[]
      reportDate: string[]
      acceptanceDateTime: string[]
      act: string[]
      form: string[]
      fileNumber: string[]
      filmNumber: string[]
      items: string[]
      size: number[]
      isXBRL: number[]
      isInlineXBRL: number[]
      primaryDocument: string[]
      primaryDocDescription: string[]
    }
  }
}

export class SecCollector extends BaseCollector {
  private readonly baseUrl = 'https://data.sec.gov'
  private readonly archivesUrl = 'https://www.sec.gov/Archives/edgar/data'
  private readonly userAgent = 'Claim Finder Agent contact@claimfinder.com'

  // Expanded list of major companies that often have legal settlements
  private readonly targetCompanies = [
    '0000320193', // Apple
    '0001018724', // Amazon  
    '0001652044', // Google/Alphabet
    '0000789019', // Microsoft
    '0001326801', // Meta/Facebook
    '0000051143', // IBM
    '0000037996', // Ford
    '0000200406', // Johnson & Johnson
    '0000019617', // JPMorgan Chase
    '0000886982', // Exxon Mobil
    '0000731802', // Walmart
    '0001403161', // Visa
    '0000070858', // Bank of America
    '0000072971', // Wells Fargo
    '0000092380', // PayPal
    '0001065088', // eBay
    '0001467373', // T-Mobile
    '0000732717', // AT&T
    '0000020520', // Verizon
    '0001108524', // Salesforce
  ]

  constructor() {
    super('SEC EDGAR Filings')
  }

  async collect(): Promise<CollectorResult> {
    const startTime = Date.now()
    let casesFound = 0
    let casesProcessed = 0
    const errors: string[] = []

    try {
      this.log('Starting SEC collection', 'info')

      // Get or create source
      const sourceId = await this.getOrCreateSource(
        this.sourceName,
        'sec',
        this.baseUrl
      )

      // Process each target company
      for (const cik of this.targetCompanies) {
        try {
          const companyResults = await this.processCompany(cik, sourceId)
          casesFound += companyResults.found
          casesProcessed += companyResults.processed

          // Rate limiting between companies (SEC allows 10 requests per second)
          await this.delay(1000)
        } catch (error) {
          const errorMsg = `Failed to process company ${cik}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          this.log(errorMsg, 'warn')
        }
      }

      this.log(`Successfully processed ${casesProcessed}/${casesFound} SEC filings`, 'info')

    } catch (error) {
      const errorMsg = `SEC collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      errors.push(errorMsg)
      this.log(errorMsg, 'error')
    }

    const duration = Date.now() - startTime

    return {
      sourceName: this.sourceName,
      casesFound,
      casesProcessed,
      errors,
      duration
    }
  }

  private async processCompany(cik: string, sourceId: string): Promise<{ found: number; processed: number }> {
    try {
      this.log(`Processing company CIK: ${cik}`, 'info')

      // Fetch company filings
      const companyData = await this.fetchCompanyData(cik)
      const recentFilings = this.getRecentRelevantFilings(companyData)

      let processed = 0
      for (const filing of recentFilings.slice(0, 10)) { // Process up to 10 most recent
        try {
          await this.processFiling(filing, companyData.name, sourceId)
          processed++
          await this.delay(500)
        } catch (error) {
          this.log(`Failed to process filing ${filing.accessionNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'warn')
        }
      }

      return {
        found: recentFilings.length,
        processed
      }

    } catch (error) {
      throw new CollectorError(
        `Company processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'network'
      )
    }
  }

  private async fetchCompanyData(cik: string): Promise<SecCompanyData> {
    try {
      const url = `${this.baseUrl}/submissions/CIK${cik.padStart(10, '0')}.json`

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new CollectorError(
          `Failed to fetch company data: ${response.status}`,
          this.sourceName,
          'network'
        )
      }

      return await response.json() as SecCompanyData
    } catch (error) {
      throw new CollectorError(
        `Company data fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'network'
      )
    }
  }

  private getRecentRelevantFilings(companyData: SecCompanyData): SecFiling[] {
    const filings: SecFiling[] = []
    const recent = companyData.filings.recent

    // Look through recent filings for forms that might contain legal information
    const relevantForms = ['8-K', '10-K', '10-Q', '20-F', 'DEF 14A', 'DEFA14A', '8-K/A']

    // Extended time window to 180 days for better coverage
    const daysToLookBack = 180
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToLookBack)

    for (let i = 0; i < recent.form.length && i < 100; i++) {
      const form = recent.form[i]

      if (relevantForms.includes(form)) {
        const filingDate = new Date(recent.filingDate[i])

        if (filingDate >= cutoffDate) {
          // Check for legal-related items in 8-K filings
          const items = recent.items[i] ? recent.items[i].split(',') : []
          const hasLegalItems = items.some(item =>
            ['8.01', '1.01', '3.01', '7.01'].includes(item.trim())
          )

          // Include all 10-K/Q and relevant 8-K filings
          if (form !== '8-K' || hasLegalItems) {
            filings.push({
              cik: companyData.cik,
              company: companyData.name,
              form,
              filingDate: recent.filingDate[i],
              reportDate: recent.reportDate[i],
              acceptanceDateTime: recent.acceptanceDateTime[i],
              accessionNumber: recent.accessionNumber[i],
              act: recent.act[i],
              fileNumber: recent.fileNumber[i],
              filmNumber: recent.filmNumber[i],
              items,
              size: recent.size[i],
              isXBRL: Boolean(recent.isXBRL[i]),
              isInlineXBRL: Boolean(recent.isInlineXBRL[i]),
              primaryDocument: recent.primaryDocument[i],
              primaryDocDescription: recent.primaryDocDescription[i]
            })
          }
        }
      }
    }

    return filings.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime())
  }

  private async processFiling(filing: SecFiling, companyName: string, sourceId: string): Promise<void> {
    try {
      this.log(`Processing ${filing.form} filing for ${companyName} (${filing.filingDate})`, 'info')

      // Construct filing URL  
      const cleanAccessionNumber = filing.accessionNumber.replace(/-/g, '')
      const filingUrl = `${this.archivesUrl}/${filing.cik}/${cleanAccessionNumber}/${filing.primaryDocument}`

      // Fetch filing content
      const response = await fetch(filingUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,text/plain'
        }
      })

      if (!response.ok) {
        throw new CollectorError(
          `Failed to fetch filing content: ${response.status}`,
          this.sourceName,
          'network'
        )
      }

      let content = await response.text()

      // Extract relevant sections that might contain legal information
      content = this.extractLegalSections(content, filing.form)

      if (content.length < 500) {
        this.log(`No relevant legal content found in ${filing.form}`, 'info')
        return
      }

      // Clean content
      const cleanedContent = this.cleanSecContent(content)

      // Use geminiService to extract case details
      const { geminiService } = await import('@/lib/ai/gemini')
      const extractedCase = await geminiService.extractCaseDetails(
        cleanedContent.substring(0, 10000), // Limit content size for processing
        filingUrl
      )

      if (!extractedCase) {
        this.log(`No legal opportunity found in ${filing.form} for ${companyName}`, 'info')
        return
      }

      // Use filing URL as claim URL if none extracted
      if (!extractedCase.claimUrl) {
        extractedCase.claimUrl = filingUrl
      }

      // Enhance title with company name and form type
      if (!extractedCase.title.toLowerCase().includes(companyName.toLowerCase())) {
        extractedCase.title = `${companyName} - ${extractedCase.title} (${filing.form})`
      }

      // Process the case using BaseCollector's processCase method
      const processed = await this.processCase(
        extractedCase,
        'sec',
        filingUrl
      )

      if (processed) {
        this.log(`Successfully processed SEC case: ${extractedCase.title}`, 'info')
      }

    } catch (error) {
      throw new CollectorError(
        `Filing processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.sourceName,
        'parsing'
      )
    }
  }

  private extractLegalSections(content: string, formType: string): string {
    const legalKeywords = [
      'litigation',
      'legal proceedings',
      'lawsuits',
      'class action',
      'settlement',
      'contingencies',
      'regulatory matters',
      'legal matters',
      'proceedings',
      'claims',
      'disputes',
      'consumer',
      'complaint',
      'alleged',
      'plaintiff',
      'defendant',
      'court',
      'judgment',
      'damages',
      'compensation',
      'refund',
      'reimbursement'
    ]

    // Remove HTML tags and decode entities
    content = content.replace(/<[^>]*>/g, ' ')
    content = content.replace(/&nbsp;/g, ' ')
    content = content.replace(/&amp;/g, '&')
    content = content.replace(/&lt;/g, '<')
    content = content.replace(/&gt;/g, '>')

    // Split into sections
    const sections = content.split(/(?:\n\s*){2,}/)
    const relevantSections: string[] = []
    const seenSections = new Set<string>()

    for (const section of sections) {
      const lowerSection = section.toLowerCase()

      // Check if section contains multiple legal keywords
      const keywordCount = legalKeywords.filter(keyword => lowerSection.includes(keyword)).length

      if (keywordCount >= 2) {
        // Avoid duplicate sections
        const sectionKey = section.substring(0, 100)
        if (!seenSections.has(sectionKey)) {
          seenSections.add(sectionKey)
          relevantSections.push(section)
        }
      }
    }

    // For 8-K filings, focus on Item 8.01 and Item 1.01
    if (formType === '8-K' && relevantSections.length === 0) {
      const item801Match = content.match(/Item\s*8\.01[\s\S]*?(?=Item\s*\d+\.\d+|$)/i)
      const item101Match = content.match(/Item\s*1\.01[\s\S]*?(?=Item\s*\d+\.\d+|$)/i)

      if (item801Match) relevantSections.push(item801Match[0])
      if (item101Match) relevantSections.push(item101Match[0])
    }

    return relevantSections.join('\n\n')
  }

  private cleanSecContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .replace(/[^\w\s.,;:!?()$%-]/g, '') // Keep currency symbols and percentages
      .trim()
  }

  // Helper methods
  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
