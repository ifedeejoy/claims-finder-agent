import { createServiceClient, getSupabase } from './client'
import type { LegalCase, Source, ExtractedCase } from '@/types'
import type { Database } from '@/types/database.types'

let supabase: ReturnType<typeof createServiceClient> | null = null

function getSupabaseServiceClient() {
  if (!supabase) {
    supabase = createServiceClient()
  }
  return supabase
}

export class DatabaseOperations {
  // Source operations
  async createSource(source: Omit<Source, 'id' | 'createdAt'>): Promise<Source> {
    const { data, error } = await getSupabaseServiceClient()
      .from('sources')
      .insert({
        name: source.name,
        type: source.type,
        url: source.url,
        last_checked: source.lastChecked.toISOString(),
        is_active: source.isActive,
        config: source.config
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create source: ${error.message}`)
    
    return this.mapDbSourceToSource(data)
  }

  async updateSourceLastChecked(sourceId: string): Promise<void> {
    const { error } = await getSupabaseServiceClient()
      .from('sources')
      .update({ last_checked: new Date().toISOString() })
      .eq('id', sourceId)

    if (error) throw new Error(`Failed to update source: ${error.message}`)
  }

  async getActiveSources(): Promise<Source[]> {
    const { data, error } = await getSupabaseServiceClient()
      .from('sources')
      .select()
      .eq('is_active', true)

    if (error) throw new Error(`Failed to fetch sources: ${error.message}`)
    
    return data.map(this.mapDbSourceToSource)
  }

  async findSourceByName(name: string): Promise<Source | null> {
    const { data, error } = await getSupabaseServiceClient()
      .from('sources')
      .select()
      .eq('name', name)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find source: ${error.message}`)
    }
    
    return data ? this.mapDbSourceToSource(data) : null
  }

  // Case operations
  async createCase(caseData: ExtractedCase, sourceId: string): Promise<LegalCase> {
    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .insert({
        source_id: sourceId,
        title: caseData.title,
        description: caseData.description,
        eligibility_criteria: caseData.eligibilityCriteria || null,
        deadline_date: caseData.deadlineDate || null,
        claim_url: caseData.claimUrl || null,
        proof_required: caseData.proofRequired,
        estimated_payout: caseData.estimatedPayout || null,
        category: caseData.category || null,
        status: 'active'
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to create case: ${error.message}`)
    
    return this.mapDbCaseToCase(data)
  }

  async upsertCase(caseData: ExtractedCase, sourceId: string, claimUrl: string): Promise<LegalCase> {
    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .upsert({
        source_id: sourceId,
        title: caseData.title,
        description: caseData.description,
        eligibility_criteria: caseData.eligibilityCriteria || null,
        deadline_date: caseData.deadlineDate || null,
        claim_url: claimUrl,
        proof_required: caseData.proofRequired,
        estimated_payout: caseData.estimatedPayout || null,
        category: caseData.category || null,
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'claim_url'
      })
      .select()
      .single()

    if (error) throw new Error(`Failed to upsert case: ${error.message}`)
    
    return this.mapDbCaseToCase(data)
  }

  async getCaseByClaimUrl(claimUrl: string): Promise<LegalCase | null> {
    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .select()
      .eq('claim_url', claimUrl)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch case: ${error.message}`)
    }
    
    return data ? this.mapDbCaseToCase(data) : null
  }

  async findCaseByUrl(url: string): Promise<LegalCase | null> {
    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .select()
      .eq('claim_url', url)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find case by URL: ${error.message}`)
    }
    
    return data ? this.mapDbCaseToCase(data) : null
  }

  async findSimilarCases(title: string): Promise<LegalCase[]> {
    // First try exact title match
    const { data: exactMatch, error: exactError } = await getSupabaseServiceClient()
      .from('cases')
      .select()
      .eq('title', title)
      .eq('status', 'active')

    if (exactError) {
      console.warn('Failed to check for exact title matches:', exactError)
    }

    if (exactMatch && exactMatch.length > 0) {
      return exactMatch.map(this.mapDbCaseToCase)
    }

    // Then try fuzzy matching using similarity
    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .select()
      .eq('status', 'active')
      .textSearch('title', title.split(' ').join(' | '))
      .limit(10)

    if (error) {
      console.warn('Failed to find similar cases:', error)
      return []
    }
    
    return data ? data.map(this.mapDbCaseToCase) : []
  }

  async getRecentCasesForDuplicateCheck(hours = 24): Promise<LegalCase[]> {
    const cutoffTime = new Date()
    cutoffTime.setHours(cutoffTime.getHours() - hours)

    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .select()
      .eq('status', 'active')
      .gte('created_at', cutoffTime.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Failed to fetch recent cases:', error)
      return []
    }
    
    return data ? data.map(this.mapDbCaseToCase) : []
  }

  async getActiveCases(limit = 50, offset = 0): Promise<LegalCase[]> {
    const { data, error } = await getSupabaseServiceClient()
      .from('cases')
      .select()
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw new Error(`Failed to fetch cases: ${error.message}`)
    
    return data.map(this.mapDbCaseToCase)
  }

  async markCaseAsExpired(caseId: string): Promise<void> {
    const { error } = await getSupabaseServiceClient()
      .from('cases')
      .update({ status: 'expired' })
      .eq('id', caseId)

    if (error) throw new Error(`Failed to mark case as expired: ${error.message}`)
  }

  // Utility mappers
  private mapDbSourceToSource(dbSource: Database['public']['Tables']['sources']['Row']): Source {
    return {
      id: dbSource.id,
      name: dbSource.name,
      type: dbSource.type,
      url: dbSource.url,
      lastChecked: new Date(dbSource.last_checked),
      isActive: dbSource.is_active,
      config: dbSource.config,
      createdAt: new Date(dbSource.created_at)
    }
  }

  private mapDbCaseToCase(dbCase: Database['public']['Tables']['cases']['Row']): LegalCase {
    return {
      id: dbCase.id,
      sourceId: dbCase.source_id,
      title: dbCase.title,
      description: dbCase.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eligibilityCriteria: dbCase.eligibility_criteria as any,
      deadlineDate: dbCase.deadline_date ? new Date(dbCase.deadline_date) : null,
      claimUrl: dbCase.claim_url,
      proofRequired: dbCase.proof_required,
      estimatedPayout: dbCase.estimated_payout,
      category: dbCase.category,
      rawText: dbCase.raw_text,
      status: dbCase.status,
      createdAt: new Date(dbCase.created_at),
      updatedAt: new Date(dbCase.updated_at)
    }
  }
}

export const db = new DatabaseOperations()
