import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null

function initializeSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey)
  }
  return supabaseClient
}

// Lazy getter to avoid initialization at import time
export const getSupabase = () => initializeSupabase()

// Service role client for backend operations
export const createServiceClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
