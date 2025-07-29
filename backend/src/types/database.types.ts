export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string
          name: string
          type: string
          url: string | null
          last_checked: string
          is_active: boolean
          config: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          url?: string | null
          last_checked?: string
          is_active?: boolean
          config?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          url?: string | null
          last_checked?: string
          is_active?: boolean
          config?: Json | null
          created_at?: string
        }
      }
      cases: {
        Row: {
          id: string
          source_id: string | null
          title: string
          description: string | null
          eligibility_criteria: Json | null
          deadline_date: string | null
          claim_url: string | null
          proof_required: boolean
          estimated_payout: string | null
          category: string | null
          raw_text: string | null
          screenshot_url: string | null
          status: string
          created_at: string
          updated_at: string
          // New fields
          full_description: string | null
          how_to_claim: string | null
          important_dates: Json | null
          contact_info: Json | null
          faqs: Json | null
          documentation_required: string[] | null
          claim_form_url: string | null
          external_redirect: boolean
        }
        Insert: {
          id?: string
          source_id?: string | null
          title: string
          description?: string | null
          eligibility_criteria?: Json | null
          deadline_date?: string | null
          claim_url?: string | null
          proof_required?: boolean
          estimated_payout?: string | null
          category?: string | null
          raw_text?: string | null
          screenshot_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          // New fields
          full_description?: string | null
          how_to_claim?: string | null
          important_dates?: Json | null
          contact_info?: Json | null
          faqs?: Json | null
          documentation_required?: string[] | null
          claim_form_url?: string | null
          external_redirect?: boolean
        }
        Update: {
          id?: string
          source_id?: string | null
          title?: string
          description?: string | null
          eligibility_criteria?: Json | null
          deadline_date?: string | null
          claim_url?: string | null
          proof_required?: boolean
          estimated_payout?: string | null
          category?: string | null
          raw_text?: string | null
          screenshot_url?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          // New fields
          full_description?: string | null
          how_to_claim?: string | null
          important_dates?: Json | null
          contact_info?: Json | null
          faqs?: Json | null
          documentation_required?: string[] | null
          claim_form_url?: string | null
          external_redirect?: boolean
        }
      }
      eligibility_questions: {
        Row: {
          id: string
          case_id: string
          question_order: number
          question_text: string
          question_type: 'boolean' | 'multiple_choice' | 'text' | 'date' | 'number'
          options: Json | null
          required: boolean
          disqualifying_answers: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          case_id: string
          question_order: number
          question_text: string
          question_type: 'boolean' | 'multiple_choice' | 'text' | 'date' | 'number'
          options?: Json | null
          required?: boolean
          disqualifying_answers?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          question_order?: number
          question_text?: string
          question_type?: 'boolean' | 'multiple_choice' | 'text' | 'date' | 'number'
          options?: Json | null
          required?: boolean
          disqualifying_answers?: Json | null
          created_at?: string
        }
      }
      user_eligibility_responses: {
        Row: {
          id: string
          case_id: string
          user_identifier: string
          responses: Json
          is_eligible: boolean | null
          eligibility_score: number | null
          completed_at: string
        }
        Insert: {
          id?: string
          case_id: string
          user_identifier: string
          responses: Json
          is_eligible?: boolean | null
          eligibility_score?: number | null
          completed_at?: string
        }
        Update: {
          id?: string
          case_id?: string
          user_identifier?: string
          responses?: Json
          is_eligible?: boolean | null
          eligibility_score?: number | null
          completed_at?: string
        }
      }
      claim_templates: {
        Row: {
          id: string
          name: string
          category: string
          default_questions: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          default_questions: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          default_questions?: Json
          created_at?: string
        }
      }
    }
    Views: {
      cases_with_questions: {
        Row: {
          id: string
          source_id: string | null
          title: string
          description: string | null
          eligibility_criteria: Json | null
          deadline_date: string | null
          claim_url: string | null
          proof_required: boolean
          estimated_payout: string | null
          category: string | null
          raw_text: string | null
          screenshot_url: string | null
          status: string
          created_at: string
          updated_at: string
          full_description: string | null
          how_to_claim: string | null
          important_dates: Json | null
          contact_info: Json | null
          faqs: Json | null
          documentation_required: string[] | null
          claim_form_url: string | null
          external_redirect: boolean
          question_count: number
          questions: Json
        }
      }
    }
    Functions: {
      [key: string]: unknown
    }
    Enums: {
      [key: string]: unknown
    }
  }
}
