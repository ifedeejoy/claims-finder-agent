#!/usr/bin/env tsx

import { CollectorOrchestrator } from '@/lib/collectors/orchestrator'

async function main() {
  console.log('🚀 Starting legal claim collection...')
  console.log('This will run all collectors: Exa, FTC, and SEC\n')

  try {
    const orchestrator = new CollectorOrchestrator()
    const { results, summary } = await orchestrator.runAll()

    console.log('\n📊 Detailed Results:')
    results.forEach(result => {
      console.log(`\n  ${result.sourceName}:`)
      console.log(`    Cases Found: ${result.casesFound}`)
      console.log(`    Cases Processed: ${result.casesProcessed}`)
      console.log(`    Duration: ${Math.round(result.duration / 1000)}s`)

      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.length}`)
        result.errors.forEach(error => console.log(`      - ${error}`))
      }
    })

    console.log('\n🎯 Overall Summary:')
    console.log(`  Total Cases Found: ${summary.totalCasesFound}`)
    console.log(`  Total Cases Processed: ${summary.totalCasesProcessed}`)
    console.log(`  Total Errors: ${summary.totalErrors}`)
    console.log(`  Total Duration: ${Math.round(summary.duration / 1000)}s`)

    const successRate = summary.totalCasesFound > 0
      ? Math.round((summary.totalCasesProcessed / summary.totalCasesFound) * 100)
      : 0

    console.log(`  Success Rate: ${successRate}%`)

    console.log('\n✅ Collection complete!')

    if (summary.totalCasesProcessed > 0) {
      console.log('\n💡 New legal opportunities have been added to the database.')
      console.log('   Users can now view and check eligibility for these claims.')
    }

  } catch (error) {
    console.error('❌ Collection failed:', error)
    process.exit(1)
  }
}

main()
