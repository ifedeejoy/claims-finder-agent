import { NextRequest, NextResponse } from 'next/server'
import type { ApiResponse } from '@/types'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { collector = 'all', domains, query } = body

    // Validate collector type
    if (!['exa', 'ftc', 'sec', 'all'].includes(collector)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid collector type. Must be: exa, ftc, sec, or all'
      }, { status: 400 })
    }

    // Forward request to backend service
    const backendResponse = await fetch(`${BACKEND_URL}/api/collectors/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: collector,
        options: { domains, query }
      })
    })

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`)
    }

    const result = await backendResponse.json()

    return NextResponse.json<ApiResponse>(result)

  } catch (error) {
    console.error('Collection API error:', error)

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Collection failed'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Forward health check to backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/health`)

    if (!backendResponse.ok) {
      throw new Error('Backend health check failed')
    }

    const health = await backendResponse.json()

    return NextResponse.json<ApiResponse>({
      success: true,
      data: health
    })
  } catch {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Health check failed'
    }, { status: 500 })
  }
}
