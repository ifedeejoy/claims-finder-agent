'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EligibilityQuestion, UserEligibilityResponse } from '@/types'
import { getSupabase } from '@/lib/supabase/client'
import { geminiService } from '@/lib/ai/gemini'

interface EligibilityQuestionnaireProps {
  caseId: string
  questions: EligibilityQuestion[]
}

export default function EligibilityQuestionnaire({
  caseId,
  questions
}: EligibilityQuestionnaireProps) {
  const router = useRouter()
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, any>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    isEligible: boolean
    score: number
    reasons: string[]
  } | null>(null)

  const currentQuestion = questions[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const handleAnswer = (answer: any) => {
    const updatedResponses = {
      ...responses,
      [currentQuestion.questionText]: answer
    }
    setResponses(updatedResponses)

    // Check if this answer disqualifies the user
    if (currentQuestion.disqualifyingAnswers?.includes(answer)) {
      // Immediately show ineligible result
      setResult({
        isEligible: false,
        score: 0,
        reasons: [`You answered "${answer}" to "${currentQuestion.questionText}"`]
      })
    } else if (!isLastQuestion) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // Submit responses
      handleSubmit(updatedResponses)
    }
  }

  const handleSubmit = async (finalResponses: Record<string, any>) => {
    setIsSubmitting(true)

    try {
      // Get a unique identifier for the user
      const userIdentifier = localStorage.getItem('user_identifier') ||
        `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      if (!localStorage.getItem('user_identifier')) {
        localStorage.setItem('user_identifier', userIdentifier)
      }

      // Save responses to database
      const supabase = getSupabase()
      const { error } = await supabase
        .from('user_eligibility_responses')
        .insert({
          case_id: caseId,
          user_identifier: userIdentifier,
          responses: finalResponses,
          is_eligible: result?.isEligible,
          eligibility_score: result?.score
        })

      if (error) {
        console.error('Error saving responses:', error)
      }

      // If no immediate disqualification, calculate eligibility
      if (!result) {
        // For now, simple check - if they answered all required questions, they're likely eligible
        const eligibilityScore = questions.filter(q => q.required && finalResponses[q.questionText]).length / questions.filter(q => q.required).length * 100

        setResult({
          isEligible: eligibilityScore >= 50,
          score: Math.round(eligibilityScore),
          reasons: eligibilityScore >= 50
            ? ['You meet the basic eligibility requirements']
            : ['You may not meet all eligibility requirements']
        })
      }
    } catch (error) {
      console.error('Error processing eligibility:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleRestart = () => {
    setCurrentQuestionIndex(0)
    setResponses({})
    setResult(null)
  }

  if (result) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">Eligibility Results</h2>

        <div className={`p-4 rounded-lg mb-4 ${result.isEligible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
          <div className="flex items-center mb-2">
            {result.isEligible ? (
              <>
                <CheckCircleIcon className="h-6 w-6 text-green-600 mr-2" />
                <span className="font-semibold text-green-900">You appear to be eligible!</span>
              </>
            ) : (
              <>
                <XCircleIcon className="h-6 w-6 text-red-600 mr-2" />
                <span className="font-semibold text-red-900">You may not be eligible</span>
              </>
            )}
          </div>

          <p className="text-sm text-gray-700 mb-2">
            Eligibility Score: {result.score}%
          </p>

          <ul className="list-disc list-inside text-sm text-gray-600">
            {result.reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          {result.isEligible && (
            <button
              onClick={() => router.push(`/${caseId}/claim`)}
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Proceed to Claim
            </button>
          )}
          <button
            onClick={handleRestart}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Retake Questionnaire
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">Eligibility Check</h2>
          <span className="text-sm text-gray-500">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-medium mb-4">{currentQuestion.questionText}</h3>

        {currentQuestion.questionType === 'boolean' && (
          <div className="space-y-3">
            <button
              onClick={() => handleAnswer(true)}
              className="w-full text-left p-4 border border-gray-300 rounded-lg hover:border-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer(false)}
              className="w-full text-left p-4 border border-gray-300 rounded-lg hover:border-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              No
            </button>
          </div>
        )}

        {currentQuestion.questionType === 'multiple_choice' && currentQuestion.options && (
          <div className="space-y-3">
            {currentQuestion.options.map((option) => (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                className="w-full text-left p-4 border border-gray-300 rounded-lg hover:border-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {option}
              </button>
            ))}
          </div>
        )}

        {currentQuestion.questionType === 'text' && (
          <input
            type="text"
            className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter your answer"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                handleAnswer(e.currentTarget.value)
              }
            }}
          />
        )}

        {currentQuestion.questionType === 'date' && (
          <input
            type="date"
            className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onChange={(e) => {
              if (e.target.value) {
                handleAnswer(e.target.value)
              }
            }}
          />
        )}

        {currentQuestion.questionType === 'number' && (
          <input
            type="number"
            className="w-full p-3 border border-gray-300 rounded-lg focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter amount"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                handleAnswer(parseFloat(e.currentTarget.value))
              }
            }}
          />
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        {!currentQuestion.required && (
          <button
            onClick={() => handleAnswer(null)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

// Icon components (simplified versions)
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
} 