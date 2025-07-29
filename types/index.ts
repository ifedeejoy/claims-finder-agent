import { z } from 'zod'


export interface LegalCase {
  id: string
  sourceId: string | null
  title: string
  description: string | null
  eligibilityCriteria: EligibilityCriteria | null
  deadlineDate: Date | null
  claimUrl: string | null
  proofRequired: boolean
  estimatedPayout: string | null
  category: string | null
  rawText: string | null
  status: 'active' | 'expired' | 'duplicate'
  createdAt: Date
  updatedAt: Date
}

export interface Source {
  id: string
  name: string
  type: 'exa' | 'sec' | 'ftc' | 'native'
  url: string | null
  lastChecked: Date
  isActive: boolean
  config: Record<string, unknown> | null
  createdAt: Date
}

export interface EligibilityCriteria {
  requirements: string[]
  dateRange?: {
    start: string
    end: string
  }
  geography?: string[]
  demographics?: string[]
  purchaseAmount?: {
    min?: number
    max?: number
  }
  proofDocuments?: string[]
}

export interface ExtractedCase {
  title: string
  description: string
  eligibilityPreview?: string[]
  eligibilityFull?: {
    required: string[]
    optional?: string[]
    restrictions?: string[]
  }
  deadlineDate?: string
  claimUrl?: string
  proofRequired: boolean
  estimatedPayout?: string
  category?: string
  // Enhanced fields
  fullDescription?: string
  howToClaim?: string
  importantDates?: {
    classStart?: string
    classEnd?: string
    filingDeadline?: string
    exclusionDeadline?: string
    finalApprovalHearing?: string
    paymentDate?: string
    [key: string]: string | undefined
  }
  contactInfo?: {
    phone?: string
    email?: string
    mailingAddress?: string
    website?: string
    lawFirm?: string
  }
  faqs?: Array<{
    question: string
    answer: string
  }>
  documentationRequired?: string[]
  claimFormUrl?: string
  externalRedirect?: boolean
}

export interface EligibilityQuestion {
  id?: string
  caseId?: string
  questionOrder: number
  questionText: string
  questionType: 'boolean' | 'multiple_choice' | 'text' | 'date' | 'number'
  options?: string[]
  required: boolean
  disqualifyingAnswers?: (string | number | boolean)[]
}

export interface UserEligibilityResponse {
  caseId: string
  userIdentifier: string
  responses: Record<string, string | number | boolean | string[]>
  isEligible?: boolean
  eligibilityScore?: number
}

export interface CaseWithQuestions {
  id: string
  title: string
  description: string | null
  full_description: string | null
  how_to_claim: string | null
  important_dates: Record<string, string> | null
  contact_info: Record<string, string> | null
  faqs: Array<{ question: string; answer: string }> | null
  documentation_required: string[] | null
  claim_form_url: string | null
  claim_url: string | null
  external_redirect: boolean
  deadline_date: string | null
  estimated_payout: string | null
  category: string | null
  eligibility_criteria: Record<string, unknown> | null
  proof_required: boolean
  questions: EligibilityQuestion[]
  question_count: number
}

export interface CollectorResult {
  sourceName: string
  casesFound: number
  casesProcessed: number
  errors: string[]
  duration: number
}

export class CollectorError extends Error {
  constructor(
    message: string,
    public sourceName: string,
    public errorType: 'network' | 'parsing' | 'extraction' | 'database' | 'unknown'
  ) {
    super(message)
    this.name = 'CollectorError'
  }
}

export class AIExtractionError extends Error {
  constructor(message: string, public rawText: string) {
    super(message)
    this.name = 'AIExtractionError'
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface ExaCollectorConfig {
  queries: string[]
  numResults?: number
  dateFilter?: string
  includeDomains?: string[]
  excludeDomains?: string[]
}

// Zod schema for validation
export const ExtractedCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  eligibilityPreview: z.array(z.string()).optional(),
  eligibilityFull: z.object({
    required: z.array(z.string()),
    optional: z.array(z.string()).optional(),
    restrictions: z.array(z.string()).optional()
  }).optional(),
  deadlineDate: z.string().optional(),
  claimUrl: z.string().url().optional(),
  proofRequired: z.boolean().default(false),
  estimatedPayout: z.string().optional(),
  category: z.string().optional(),
  // Enhanced fields
  fullDescription: z.string().optional(),
  howToClaim: z.string().optional(),
  importantDates: z.record(z.string()).optional(),
  contactInfo: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    mailingAddress: z.string().optional(),
    website: z.string().url().optional(),
    lawFirm: z.string().optional()
  }).optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string()
  })).optional(),
  documentationRequired: z.array(z.string()).optional(),
  claimFormUrl: z.string().url().optional(),
  externalRedirect: z.boolean().default(true)
})
