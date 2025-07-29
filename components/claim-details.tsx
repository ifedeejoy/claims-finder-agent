'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CaseWithQuestions } from '@/types'
import { formatDate } from '@/lib/utils'

interface ClaimDetailsProps {
  caseData: CaseWithQuestions
}

export default function ClaimDetails({ caseData }: ClaimDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'how-to' | 'faqs'>('overview')

  const isExpired = caseData.deadline_date && new Date(caseData.deadline_date) < new Date()

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{caseData.title}</h1>
            <p className="text-gray-600">{caseData.description}</p>
          </div>
          {caseData.external_redirect && caseData.claim_url && (
            <a
              href={caseData.claim_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Visit Claim Site →
            </a>
          )}
        </div>

        {/* Key Info */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {caseData.deadline_date && (
            <div className="flex items-center">
              <CalendarIcon className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <p className="text-sm text-gray-500">Deadline</p>
                <p className={`font-medium ${isExpired ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatDate(caseData.deadline_date)}
                  {isExpired && ' (Expired)'}
                </p>
              </div>
            </div>
          )}

          {caseData.estimated_payout && (
            <div className="flex items-center">
              <DollarSignIcon className="h-5 w-5 text-gray-400 mr-2" />
              <div>
                <p className="text-sm text-gray-500">Estimated Payout</p>
                <p className="font-medium text-gray-900">{caseData.estimated_payout}</p>
              </div>
            </div>
          )}

          <div className="flex items-center">
            <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2" />
            <div>
              <p className="text-sm text-gray-500">Documentation</p>
              <p className="font-medium text-gray-900">
                {caseData.documentation_required?.length ? 'Required' : 'Not Required'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          {(['overview', 'details', 'how-to', 'faqs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm capitalize
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab === 'how-to' ? 'How to Claim' : tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {caseData.full_description && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">About This Settlement</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{caseData.full_description}</p>
              </div>
            )}

            {/* Important Dates */}
            {caseData.important_dates && Object.keys(caseData.important_dates).length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Important Dates</h3>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                  {Object.entries(caseData.important_dates).map(([key, value]) => (
                    <div key={key} className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">{formatDate(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Contact Info */}
            {caseData.contact_info && Object.keys(caseData.contact_info).length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Contact Information</h3>
                <div className="space-y-2">
                  {caseData.contact_info.phone && (
                    <div className="flex items-center">
                      <span className="text-gray-400 mr-2">📞</span>
                      <a href={`tel:${caseData.contact_info.phone}`} className="text-indigo-600 hover:text-indigo-500">
                        {caseData.contact_info.phone}
                      </a>
                    </div>
                  )}
                  {caseData.contact_info.email && (
                    <div className="flex items-center">
                      <span className="text-gray-400 mr-2">✉️</span>
                      <a href={`mailto:${caseData.contact_info.email}`} className="text-indigo-600 hover:text-indigo-500">
                        {caseData.contact_info.email}
                      </a>
                    </div>
                  )}
                  {caseData.contact_info.website && (
                    <div className="flex items-center">
                      <span className="text-gray-400 mr-2">🔗</span>
                      <a href={caseData.contact_info.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">
                        Official Website
                      </a>
                    </div>
                  )}
                  {caseData.contact_info.mailingAddress && (
                    <div className="text-sm text-gray-600 ml-7">
                      {caseData.contact_info.mailingAddress}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Eligibility */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Eligibility Requirements</h3>
              {caseData.eligibility_criteria ? (
                <div className="space-y-3">
                  {/* Render eligibility criteria from JSON */}
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                    {JSON.stringify(caseData.eligibility_criteria, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-gray-600">No specific eligibility criteria listed.</p>
              )}
            </div>

            {/* Documentation Required */}
            {caseData.documentationRequired && caseData.documentationRequired.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Required Documentation</h3>
                <ul className="list-disc list-inside space-y-1">
                  {caseData.documentationRequired.map((doc, index) => (
                    <li key={index} className="text-gray-600">{doc}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Category */}
            {caseData.category && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Category</h3>
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {caseData.category}
                </span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'how-to' && (
          <div className="space-y-6">
            {caseData.howToClaim ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">How to File Your Claim</h3>
                <div className="prose prose-indigo max-w-none">
                  <p className="text-gray-600 whitespace-pre-wrap">{caseData.howToClaim}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <QuestionMarkCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-600">No specific claim instructions available.</p>
                {caseData.claimUrl && (
                  <a
                    href={caseData.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center text-indigo-600 hover:text-indigo-500"
                  >
                    Visit the claim website for instructions
                    <ExternalLinkIcon className="ml-2 h-4 w-4" />
                  </a>
                )}
              </div>
            )}

            {caseData.claimFormUrl && (
              <div className="mt-4">
                <a
                  href={caseData.claimFormUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 border border-indigo-600 text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Download Claim Form
                  <DocumentTextIcon className="ml-2 h-4 w-4" />
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'faqs' && (
          <div className="space-y-6">
            {caseData.faqs && caseData.faqs.length > 0 ? (
              <div className="space-y-4">
                {caseData.faqs.map((faq, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-base font-medium text-gray-900 mb-2">{faq.question}</h4>
                    <p className="text-sm text-gray-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <QuestionMarkCircleIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-gray-600">No FAQs available for this claim.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Bar */}
      {!isExpired && caseData.questionCount > 0 && (
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Complete the eligibility questionnaire below to see if you qualify for this claim.
          </p>
        </div>
      )}
    </div>
  )
} 