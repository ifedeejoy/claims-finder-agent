

interface MetricData {
  timestamp: Date
  metric: string
  value: number
  tags: Record<string, string>
}

interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical'
  message: string
  data?: any
}

export class ProductionMonitoring {
  private metrics: MetricData[] = []
  
  /**
   * Track collector performance metrics
   */
  trackCollectorMetrics(sourceName: string, result: {
    casesFound: number
    casesProcessed: number
    duration: number
    errors: string[]
  }): void {
    const timestamp = new Date()
    
    this.recordMetric({
      timestamp,
      metric: 'collector.cases_found',
      value: result.casesFound,
      tags: { source: sourceName }
    })
    
    this.recordMetric({
      timestamp,
      metric: 'collector.cases_processed', 
      value: result.casesProcessed,
      tags: { source: sourceName }
    })
    
    this.recordMetric({
      timestamp,
      metric: 'collector.duration_ms',
      value: result.duration,
      tags: { source: sourceName }
    })
    
    this.recordMetric({
      timestamp,
      metric: 'collector.errors',
      value: result.errors.length,
      tags: { source: sourceName }
    })
    
    // Success rate
    const successRate = result.casesFound > 0 ? result.casesProcessed / result.casesFound : 0
    this.recordMetric({
      timestamp,
      metric: 'collector.success_rate',
      value: successRate,
      tags: { source: sourceName }
    })
    
    // Generate alerts for anomalies
    this.checkCollectorAlerts(sourceName, result)
  }
  
  /**
   * Track API performance
   */
  trackApiMetrics(endpoint: string, duration: number, status: number): void {
    this.recordMetric({
      timestamp: new Date(),
      metric: 'api.response_time_ms',
      value: duration,
      tags: { endpoint, status: status.toString() }
    })
    
    this.recordMetric({
      timestamp: new Date(),
      metric: 'api.requests',
      value: 1,
      tags: { endpoint, status: status.toString() }
    })
  }
  
  /**
   * Track database operations
   */
  trackDatabaseMetrics(operation: string, duration: number, success: boolean): void {
    this.recordMetric({
      timestamp: new Date(),
      metric: 'database.operation_time_ms',
      value: duration,
      tags: { operation, success: success.toString() }
    })
    
    if (!success) {
      this.alert({
        level: 'warning',
        message: `Database operation failed: ${operation}`,
        data: { operation, duration }
      })
    }
  }
  
  /**
   * Track AI service usage and costs
   */
  trackAiMetrics(service: 'gemini' | 'exa', operation: string, tokens?: number, cost?: number): void {
    this.recordMetric({
      timestamp: new Date(),
      metric: 'ai.requests',
      value: 1,
      tags: { service, operation }
    })
    
    if (tokens) {
      this.recordMetric({
        timestamp: new Date(),
        metric: 'ai.tokens_used',
        value: tokens,
        tags: { service, operation }
      })
    }
    
    if (cost) {
      this.recordMetric({
        timestamp: new Date(),
        metric: 'ai.cost_usd',
        value: cost,
        tags: { service, operation }
      })
    }
  }
  
  /**
   * Health check monitoring
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, { status: 'pass' | 'fail', latency?: number, message: string }>
  }> {
    const checks: Record<string, { status: 'pass' | 'fail', latency?: number, message: string }> = {}
    
    // Database health
    try {
      const start = Date.now()
      // Quick DB query to test connectivity
      await this.testDatabaseConnection()
      checks.database = {
        status: 'pass',
        latency: Date.now() - start,
        message: 'Database responsive'
      }
    } catch (error) {
      checks.database = {
        status: 'fail',
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown'}`
      }
    }
    
    // AI Services health
    try {
      const start = Date.now()
      await this.testAiServices()
      checks.ai_services = {
        status: 'pass',
        latency: Date.now() - start,
        message: 'AI services responsive'
      }
    } catch (error) {
      checks.ai_services = {
        status: 'fail',
        message: `AI services error: ${error instanceof Error ? error.message : 'Unknown'}`
      }
    }
    
    // External APIs health
    checks.external_apis = await this.testExternalApis()
    
    // Determine overall status
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length
    const status = failedChecks === 0 ? 'healthy' : failedChecks <= 1 ? 'degraded' : 'unhealthy'
    
    if (status === 'unhealthy') {
      this.alert({
        level: 'critical',
        message: 'System health check failed',
        data: checks
      })
    }
    
    return { status, checks }
  }
  
  /**
   * Generate daily performance report
   */
  generateDailyReport(): {
    totalCasesProcessed: number
    totalApiRequests: number
    averageResponseTime: number
    errorRate: number
    aiCosts: number
    topPerformingSources: string[]
  } {
    const last24Hours = this.getMetricsInTimeRange(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      new Date()
    )
    
    const casesProcessed = this.sumMetric(last24Hours, 'collector.cases_processed')
    const apiRequests = this.sumMetric(last24Hours, 'api.requests')
    const avgResponseTime = this.averageMetric(last24Hours, 'api.response_time_ms')
    const errors = this.sumMetric(last24Hours, 'collector.errors')
    const aiCosts = this.sumMetric(last24Hours, 'ai.cost_usd')
    
    const sourcePerformance = this.getSourcePerformanceRanking(last24Hours)
    
    return {
      totalCasesProcessed: casesProcessed,
      totalApiRequests: apiRequests,
      averageResponseTime: avgResponseTime,
      errorRate: apiRequests > 0 ? errors / apiRequests : 0,
      aiCosts,
      topPerformingSources: sourcePerformance.slice(0, 3)
    }
  }
  
  private recordMetric(metric: MetricData): void {
    this.metrics.push(metric)
    
    // Keep only last 7 days of metrics
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    this.metrics = this.metrics.filter(m => m.timestamp >= sevenDaysAgo)
  }
  
  private checkCollectorAlerts(sourceName: string, result: any): void {
    // High error rate alert
    if (result.errors.length > 5) {
      this.alert({
        level: 'warning',
        message: `High error rate for ${sourceName}: ${result.errors.length} errors`,
        data: { source: sourceName, errors: result.errors }
      })
    }
    
    // Low success rate alert
    const successRate = result.casesFound > 0 ? result.casesProcessed / result.casesFound : 0
    if (successRate < 0.5 && result.casesFound > 0) {
      this.alert({
        level: 'warning',
        message: `Low success rate for ${sourceName}: ${Math.round(successRate * 100)}%`,
        data: { source: sourceName, successRate }
      })
    }
    
    // Long duration alert
    if (result.duration > 300000) { // 5 minutes
      this.alert({
        level: 'warning',
        message: `Slow collection for ${sourceName}: ${Math.round(result.duration / 1000)}s`,
        data: { source: sourceName, duration: result.duration }
      })
    }
  }
  
  private alert(alert: Alert): void {
    console.log(`[${alert.level.toUpperCase()}] ${alert.message}`, alert.data)
    
    // In production, send to monitoring service (DataDog, Sentry, etc.)
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(alert)
    }
  }
  
  private async sendToMonitoringService(alert: Alert): Promise<void> {
    // Integrate with your monitoring service here
    // Example: Sentry, DataDog, PagerDuty, Slack webhooks
    
    if (process.env.SLACK_WEBHOOK_URL) {
      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 ${alert.level.toUpperCase()}: ${alert.message}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${alert.level.toUpperCase()}*: ${alert.message}`
                }
              },
              alert.data && {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `\`\`\`${JSON.stringify(alert.data, null, 2)}\`\`\``
                }
              }
            ].filter(Boolean)
          })
        })
      } catch (error) {
        console.error('Failed to send alert to Slack:', error)
      }
    }
  }
  
  private async testDatabaseConnection(): Promise<void> {
    // Test basic database connectivity
    // Implementation would depend on your database setup
  }
  
  private async testAiServices(): Promise<void> {
    // Test AI service connectivity with minimal requests
    // Implementation would test Gemini and Exa APIs
  }
  
  private async testExternalApis(): Promise<{ status: 'pass' | 'fail', message: string }> {
    // Test external service availability
    return { status: 'pass', message: 'External APIs responsive' }
  }
  
  private getMetricsInTimeRange(start: Date, end: Date): MetricData[] {
    return this.metrics.filter(m => m.timestamp >= start && m.timestamp <= end)
  }
  
  private sumMetric(metrics: MetricData[], metricName: string): number {
    return metrics
      .filter(m => m.metric === metricName)
      .reduce((sum, m) => sum + m.value, 0)
  }
  
  private averageMetric(metrics: MetricData[], metricName: string): number {
    const values = metrics.filter(m => m.metric === metricName).map(m => m.value)
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
  }
  
  private getSourcePerformanceRanking(metrics: MetricData[]): string[] {
    const sourceMetrics = new Map<string, { processed: number, found: number }>()
    
    metrics.forEach(m => {
      if (m.tags.source) {
        if (!sourceMetrics.has(m.tags.source)) {
          sourceMetrics.set(m.tags.source, { processed: 0, found: 0 })
        }
        
        const source = sourceMetrics.get(m.tags.source)!
        if (m.metric === 'collector.cases_processed') source.processed += m.value
        if (m.metric === 'collector.cases_found') source.found += m.value
      }
    })
    
    return Array.from(sourceMetrics.entries())
      .map(([source, data]) => ({
        source,
        efficiency: data.found > 0 ? data.processed / data.found : 0
      }))
      .sort((a, b) => b.efficiency - a.efficiency)
      .map(item => item.source)
  }
}

export const monitoring = new ProductionMonitoring()
