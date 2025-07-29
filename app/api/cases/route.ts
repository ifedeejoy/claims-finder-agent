import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase/operations'
import type { ApiResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const category = searchParams.get('category')
    // const status = searchParams.get('status') || 'active'

    // For now, get all active cases (we'll add filtering later)
    const cases = await db.getActiveCases(limit, offset)

    // Apply client-side filtering for category if needed
    const filteredCases = category 
      ? cases.filter(c => c.category?.toLowerCase().includes(category.toLowerCase()))
      : cases

    return NextResponse.json<ApiResponse>({
      success: true,
      data: filteredCases,
      meta: {
        count: filteredCases.length,
        hasMore: filteredCases.length === limit
      }
    })

  } catch (error) {
    console.error('Cases API error:', error)
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch cases'
    }, { status: 500 })
  }
}
