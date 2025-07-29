import { notFound } from 'next/navigation'
import { getSupabase } from '@/lib/supabase/client'
import type { CaseWithQuestions } from '@/types'
import ClaimDetails from '@/components/claim-details-simple'
import EligibilityQuestionnaire from '@/components/eligibility-questionnaire'

async function getCase(id: string): Promise<CaseWithQuestions | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('cases_with_questions')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null

  return data as CaseWithQuestions
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const caseData = await getCase(params.id)

  if (!caseData) {
    return {
      title: 'Claim Not Found',
    }
  }

  return {
    title: caseData.title,
    description: caseData.description,
  }
}

export default async function ClaimPage({ params }: { params: { id: string } }) {
  const caseData = await getCase(params.id)

  if (!caseData) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <ClaimDetails caseData={caseData} />

        {/* Eligibility questionnaire will be enabled once all components are ready */}
        {/* {caseData.question_count > 0 && (
          <div className="mt-8">
            <EligibilityQuestionnaire 
              caseId={caseData.id}
              questions={caseData.questions}
            />
          </div>
        )} */}
      </div>
    </div>
  )
} 