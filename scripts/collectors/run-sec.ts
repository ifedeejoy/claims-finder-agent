#!/usr/bin/env tsx

import { SecCollector } from '@/lib/collectors/sec-collector'

async function main() {
  console.log('🏛️  Starting SEC EDGAR collector...')

  try {
    const collector = new SecCollector()
    const result = await collector.collect()

    console.log('\n📊 Collection Results:')
    console.log(`  Source: ${result.sourceName}`)
    console.log(`  Cases Found: ${result.casesFound}`)
    console.log(`  Cases Processed: ${result.casesProcessed}`)
    console.log(`  Duration: ${Math.round(result.duration / 1000)}s`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors (${result.errors.length}):`)
      result.errors.forEach(error => console.log(`  - ${error}`))
    }

    console.log('\n✅ SEC collection complete!')

  } catch (error) {
    console.error('❌ Collection failed:', error)
    process.exit(1)
  }
}

main() 