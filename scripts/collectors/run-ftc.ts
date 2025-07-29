#!/usr/bin/env tsx

import { FtcCollector } from '@/lib/collectors/ftc-collector'

async function main() {
  console.log('🏛️  Starting FTC collector...')

  try {
    const collector = new FtcCollector()
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

    console.log('\n✅ FTC collection complete!')

  } catch (error) {
    console.error('❌ Collection failed:', error)
    process.exit(1)
  }
}

main() 