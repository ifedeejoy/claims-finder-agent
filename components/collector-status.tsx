'use client'

import { useState, useEffect } from 'react'
import type { ApiResponse, CollectorResult } from '@/types'

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: Record<string, { status: 'pass' | 'fail'; message: string }>
}

export function CollectorStatus() {
  const [health, setHealth] = useState<HealthCheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [lastRun, setLastRun] = useState<any>(null)

  useEffect(() => {
    checkHealth()
  }, [])

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/collectors/run')
      const result: ApiResponse<HealthCheck> = await response.json()
      
      if (result.success && result.data) {
        setHealth(result.data)
      }
    } catch (error) {
      console.error('Health check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const runCollectors = async (type: 'all' | 'exa' | 'ftc' | 'sec' = 'all') => {
    if (running) return
    
    setRunning(true)
    try {
      const response = await fetch('/api/collectors/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collector: type })
      })
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: ApiResponse<CollectorResult | { results: CollectorResult[], summary: any }> = await response.json()
      
      if (result.success) {
        setLastRun(result.data)
        // Trigger a refresh of the claims list by dispatching a custom event
        window.dispatchEvent(new CustomEvent('collectorsComplete'))
      }
    } catch (error) {
      console.error('Collection failed:', error)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'degraded': return 'text-yellow-600 bg-yellow-100' 
      case 'unhealthy': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getCheckIcon = (status: 'pass' | 'fail') => {
    return status === 'pass' ? '✅' : '❌'
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          
          {health && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(health.status)}`}>
              {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
            </span>
          )}
        </div>
      </div>

      {/* Health Checks */}
      {health && (
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Service Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(health.checks).map(([service, check]) => (
              <div key={service} className="flex items-center space-x-2">
                <span className="text-lg">{getCheckIcon(check.status)}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900 capitalize">{service}</div>
                  <div className="text-xs text-gray-500">{check.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-1">Manual Collection</h3>
            <p className="text-xs text-gray-500">Run collectors to find new legal opportunities</p>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => runCollectors('exa')}
              disabled={running}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Exa
            </button>
            <button
              onClick={() => runCollectors('ftc')}
              disabled={running}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              FTC
            </button>
            <button
              onClick={() => runCollectors('sec')}
              disabled={running}
              className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              SEC
            </button>
            <button
              onClick={() => runCollectors('all')}
              disabled={running}
              className="px-4 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run All'}
            </button>
          </div>
        </div>

        {/* Last Run Results */}
        {lastRun && (
          <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-900 mb-1">Last Collection Results:</div>
            {Array.isArray(lastRun.results) ? (
              <div className="space-y-1">
                <div>Total: {lastRun.summary.totalCasesProcessed}/{lastRun.summary.totalCasesFound} cases processed</div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {lastRun.results.map((result: any, i: number) => (
                  <div key={i} className="text-gray-600">
                    {result.sourceName}: {result.casesProcessed}/{result.casesFound} cases
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {lastRun.sourceName}: {lastRun.casesProcessed}/{lastRun.casesFound} cases processed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
