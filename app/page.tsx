import { ClaimsList } from '@/components/claims-list'
import { CollectorStatus } from '@/components/collector-status'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Claim Finder</h1>
              <p className="mt-1 text-gray-600">
                Discover legal opportunities and check your eligibility
              </p>
            </div>
            <CollectorStatus />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-indigo-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-4">
              Never Miss a Class Action Settlement Again
            </h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-3xl mx-auto">
              We automatically find and analyze legal settlements, class actions, and consumer refunds.
              Check your eligibility with our smart questionnaires before filing a claim.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="bg-indigo-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">🔍 Automated Discovery</h3>
                <p className="text-indigo-100">
                  Our AI agents scan multiple sources 24/7 to find new settlements
                </p>
              </div>
              <div className="bg-indigo-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">✅ Eligibility Check</h3>
                <p className="text-indigo-100">
                  Answer simple questions to see if you qualify before filing
                </p>
              </div>
              <div className="bg-indigo-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">📋 Detailed Info</h3>
                <p className="text-indigo-100">
                  Get all the details you need to file your claim successfully
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Active Legal Opportunities
          </h2>
          <p className="text-gray-600">
            Click on any claim below to view full details and check your eligibility
          </p>
        </div>

        <ClaimsList />
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="mb-2">
            Claim Finder helps you discover legal opportunities you may be eligible for.
          </p>
          <p className="text-gray-400 text-sm">
            We are not a law firm and do not provide legal advice.
            Always consult with an attorney for legal matters.
          </p>
        </div>
      </footer>
    </div>
  )
}
