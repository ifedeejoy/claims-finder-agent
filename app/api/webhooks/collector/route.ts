import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import type { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, jobId, type, result, error } = body

    console.log(`Webhook received: ${event} for job ${jobId}`)

    switch (event) {
      case 'collection.completed':
        console.log(`Collection completed: ${type}`, {
          casesFound: result?.summary?.totalCasesFound || 0,
          casesProcessed: result?.summary?.totalCasesProcessed || 0
        })

        // Revalidate the homepage to show new cases
        revalidatePath('/')
        break

      case 'collection.failed':
        console.error(`Collection failed: ${type}`, error)
        break

      default:
        console.warn(`Unknown webhook event: ${event}`)
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { received: true }
    })

  } catch (error) {
    console.error('Webhook error:', error)

    return NextResponse.json<ApiResponse>({
      success: false,
      error: error instanceof Error ? error.message : 'Webhook processing failed'
    }, { status: 500 })
  }
} 