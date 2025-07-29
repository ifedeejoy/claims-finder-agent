#!/usr/bin/env tsx

import { ExaCollector } from '@/lib/collectors/exa-collector'
import { ExaService } from '@/lib/ai/exa'

async function main() {
  console.log('🔍 Starting Exa collector...')
  
  try {
    const collector = new ExaCollector()
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
    
    console.log('\n✅ Exa collection complete!')
    
  } catch (error) {
    console.error('❌ Collection failed:', error)
    process.exit(1)
  }
}

// Run with specific domains if provided
if (process.argv.includes('--domains')) {
  const domainsIndex = process.argv.indexOf('--domains') + 1
  const domains = process.argv[domainsIndex]?.split(',') || []
  
  if (domains.length > 0) {
    console.log(`🎯 Running Exa collector for specific domains: ${domains.join(', ')}`)
    
    const collector = new ExaCollector()
    collector.collectFromDomains(domains)
      .then(result => {
        console.log('\n📊 Domain Collection Results:')
        console.log(`  Source: ${result.sourceName}`)
        console.log(`  Cases Found: ${result.casesFound}`)
        console.log(`  Cases Processed: ${result.casesProcessed}`)
        console.log(`  Duration: ${Math.round(result.duration / 1000)}s`)
        
        if (result.errors.length > 0) {
          console.log(`\n⚠️  Errors (${result.errors.length}):`)
          result.errors.forEach(error => console.log(`  - ${error}`))
        }
        
        console.log('\n✅ Domain collection complete!')
      })
      .catch(error => {
        console.error('❌ Domain collection failed:', error)
        process.exit(1)
      })
  }
} else {
  main()
}
