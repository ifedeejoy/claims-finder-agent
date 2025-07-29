'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { LegalCase, ApiResponse } from '@/types'

export function ClaimsList() {
  const [cases, setCases] = useState<LegalCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/cases')
      const result: ApiResponse<LegalCase[]> = await response.json()

      if (result.success && result.data) {
        setCases(result.data)
      } else {
        setError(result.error || 'Failed to fetch cases')
      }
    } catch {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-lg p-6">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={fetchCases}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (cases.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Claims Found</h3>
        <p className="text-gray-600 mb-4">
          The system hasn&apos;t discovered any legal opportunities yet.
        </p>
        <p className="text-sm text-gray-500">
          The collector runs automatically to find new opportunities.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Legal Opportunities ({cases.length})
        </h2>
        <button
          onClick={fetchCases}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-6">
        {cases.map((case_) => (
          <ClaimCard key={case_.id} case={case_} />
        ))}
      </div>
    </div>
  )
}

function ClaimCard({ case: case_ }: { case: LegalCase }) {
  const formatDate = (date: Date | null) => {
    if (!date) return 'No deadline specified'
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getDeadlineStatus = (deadline: Date | null) => {
    if (!deadline) return { color: 'gray', text: 'No deadline' }

    const now = new Date()
    const deadlineDate = new Date(deadline)
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil < 0) return { color: 'red', text: 'Expired' }
    if (daysUntil <= 30) return { color: 'orange', text: `${daysUntil} days left` }
    return { color: 'green', text: `${daysUntil} days left` }
  }

  const deadlineStatus = getDeadlineStatus(case_.deadlineDate)

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {case_.title}
          </h3>

          <div className="flex items-center space-x-4 text-sm text-gray-500">
            {case_.category && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                {case_.category}
              </span>
            )}
            {case_.estimatedPayout && (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                {case_.estimatedPayout}
              </span>
            )}
            {case_.proofRequired && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                Proof Required
              </span>
            )}
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-sm font-medium ${deadlineStatus.color === 'red' ? 'bg-red-100 text-red-800' :
          deadlineStatus.color === 'orange' ? 'bg-orange-100 text-orange-800' :
            deadlineStatus.color === 'green' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
          }`}>
          {deadlineStatus.text}
        </div>
      </div>

      {/* Description */}
      {case_.description && (
        <p className="text-gray-700 mb-4 leading-relaxed">
          {case_.description}
        </p>
      )}

      {/* Eligibility Criteria */}
      {case_.eligibilityCriteria && case_.eligibilityCriteria.requirements && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Eligibility Requirements:</h4>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            {case_.eligibilityCriteria.requirements.map((req, index) => (
              <li key={index}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
        <div className="text-sm text-gray-500">
          <span>Deadline: {formatDate(case_.deadlineDate)}</span>
          <span className="mx-2">•</span>
          <span>Found: {new Date(case_.createdAt).toLocaleDateString()}</span>
        </div>

        <Link
          href={`/${case_.id}`}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium inline-block"
        >
          View Claim Details →
        </Link>
      </div>
    </div>
  )
}
