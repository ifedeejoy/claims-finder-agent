import { ExaCollector } from './exa-collector'
import { FtcCollector } from './ftc-collector'
import { SecCollector } from './sec-collector'
import type { CollectorResult } from '@/types'

export class CollectorOrchestrator {
  private collectors: {
    exa: ExaCollector
    ftc: FtcCollector
    sec: SecCollector
  }

  constructor() {
    this.collectors = {
      exa: new ExaCollector(),
      ftc: new FtcCollector(),
      sec: new SecCollector()
    }
  }

  /**
   * Run all collectors in parallel
   */
  async runAll(): Promise<{
    results: CollectorResult[]
    summary: {
      totalCasesFound: number
      totalCasesProcessed: number
      totalErrors: number
      duration: number
    }
  }> {
    const startTime = Date.now()
    
    console.log('🚀 Starting claim collection...')

    // First, check for expired cases across all collectors
    try {
      const expiredCount = await (this.collectors.exa as unknown as { checkAndMarkExpiredCases: () => Promise<number> }).checkAndMarkExpiredCases()
      if (expiredCount > 0) {
        console.log(`✓ Marked ${expiredCount} expired cases`)
      }
    } catch (error) {
      console.warn('Failed to check for expired cases:', error)
    }

    // Run all collectors in parallel
    const results = await Promise.allSettled([
      this.collectors.exa.collect(),
      this.collectors.ftc.collect(),
      this.collectors.sec.collect()
    ])

    // Process results
    const collectorResults: CollectorResult[] = []
    let totalCasesFound = 0
    let totalCasesProcessed = 0
    let totalErrors = 0

    results.forEach((result, index) => {
      const collectorNames = ['exa', 'ftc', 'sec']
      const collectorName = collectorNames[index]

      if (result.status === 'fulfilled') {
        collectorResults.push(result.value)
        totalCasesFound += result.value.casesFound
        totalCasesProcessed += result.value.casesProcessed
        totalErrors += result.value.errors.length
      } else {
        console.error(`❌ ${collectorName} collector failed:`, result.reason)
        collectorResults.push({
          sourceName: collectorName,
          casesFound: 0,
          casesProcessed: 0,
          errors: [result.reason?.message || 'Unknown error'],
          duration: 0
        })
        totalErrors += 1
      }
    })

    const duration = Date.now() - startTime

    const summary = {
      totalCasesFound,
      totalCasesProcessed,
      totalErrors,
      duration
    }

    console.log('✅ Collection complete!')
    console.log(`📊 Summary: ${totalCasesProcessed}/${totalCasesFound} cases processed in ${Math.round(duration / 1000)}s`)
    
    if (totalErrors > 0) {
      console.log(`⚠️  ${totalErrors} errors occurred`)
    }

    return {
      results: collectorResults,
      summary
    }
  }

  /**
   * Run a specific collector
   */
  async runCollector(type: 'exa' | 'ftc' | 'sec'): Promise<CollectorResult> {
    console.log(`🔍 Running ${type} collector...`)
    
    const result = await this.collectors[type].collect()
    
    console.log(`✅ ${type} collection complete: ${result.casesProcessed}/${result.casesFound} cases processed`)
    
    return result
  }

  /**
   * Run Exa collector with specific domains
   */
  async runExaForDomains(domains: string[], query?: string): Promise<CollectorResult> {
    console.log(`🔍 Running Exa collector for domains: ${domains.join(', ')}`)
    
    const result = await this.collectors.exa.collectFromDomains(domains, query)
    
    console.log(`✅ Domain collection complete: ${result.casesProcessed}/${result.casesFound} cases processed`)
    
    return result
  }

  /**
   * Health check - verify all collectors can initialize
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, { status: 'pass' | 'fail'; message: string }>
  }> {
    const checks: Record<string, { status: 'pass' | 'fail'; message: string }> = {}

    // Check environment variables
    checks.gemini = {
      status: process.env.GEMINI_API_KEY ? 'pass' : 'fail',
      message: process.env.GEMINI_API_KEY ? 'API key present' : 'Missing GEMINI_API_KEY'
    }

    checks.exa = {
      status: process.env.EXA_API_KEY ? 'pass' : 'fail', 
      message: process.env.EXA_API_KEY ? 'API key present' : 'Missing EXA_API_KEY'
    }

    checks.supabase = {
      status: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'pass' : 'fail',
      message: process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
        ? 'Configuration present' 
        : 'Missing Supabase configuration'
    }

    // Test basic connectivity (you could add actual API calls here)
    checks.connectivity = {
      status: 'pass',
      message: 'Basic connectivity assumed'
    }

    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length
    const status = failedChecks === 0 ? 'healthy' : failedChecks <= 1 ? 'degraded' : 'unhealthy'

    return { status, checks }
  }
}

// Export singleton instance
export const orchestrator = new CollectorOrchestrator()
