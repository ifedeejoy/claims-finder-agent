#!/usr/bin/env tsx

import { SecCollector } from '@/lib/collectors/sec-collector'
import { ExaCollector } from '@/lib/collectors/exa-collector'
import { FtcCollector } from '@/lib/collectors/ftc-collector'
import { CollectorOrchestrator } from '@/lib/collectors/orchestrator'

async function testSecCollector() {
  console.log('\n🔍 Testing SEC Collector...')

  try {
    const collector = new SecCollector()
    const result = await collector.collect()

    console.log('✅ SEC Collector Results:')
    console.log(`  - Cases Found: ${result.casesFound}`)
    console.log(`  - Cases Processed: ${result.casesProcessed}`)
    console.log(`  - Errors: ${result.errors.length}`)
    console.log(`  - Duration: ${Math.round(result.duration / 1000)}s`)

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }
  } catch (error) {
    console.error('❌ SEC Collector failed:', error)
  }
}

async function testExaCollector() {
  console.log('\n🔍 Testing Exa Collector...')

  try {
    const collector = new ExaCollector({
      numResults: 10, // Small number for testing
      dateFilter: '7d'
    })
    const result = await collector.collect()

    console.log('✅ Exa Collector Results:')
    console.log(`  - Cases Found: ${result.casesFound}`)
    console.log(`  - Cases Processed: ${result.casesProcessed}`)
    console.log(`  - Errors: ${result.errors.length}`)
    console.log(`  - Duration: ${Math.round(result.duration / 1000)}s`)

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }
  } catch (error) {
    console.error('❌ Exa Collector failed:', error)
  }
}

async function testFtcCollector() {
  console.log('\n🔍 Testing FTC Collector...')

  try {
    const collector = new FtcCollector()
    const result = await collector.collect()

    console.log('✅ FTC Collector Results:')
    console.log(`  - Cases Found: ${result.casesFound}`)
    console.log(`  - Cases Processed: ${result.casesProcessed}`)
    console.log(`  - Errors: ${result.errors.length}`)
    console.log(`  - Duration: ${Math.round(result.duration / 1000)}s`)

    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }
  } catch (error) {
    console.error('❌ FTC Collector failed:', error)
  }
}

async function testOrchestrator() {
  console.log('\n🔍 Testing Collector Orchestrator...')

  try {
    const orchestrator = new CollectorOrchestrator()
    const orchestratorResults = await orchestrator.runAll()

    console.log('\n✅ Orchestrator Results:')
    orchestratorResults.results.forEach(result => {
      console.log(`\n  ${result.sourceName}:`)
      console.log(`    - Cases Found: ${result.casesFound}`)
      console.log(`    - Cases Processed: ${result.casesProcessed}`)
      console.log(`    - Errors: ${result.errors.length}`)
      console.log(`    - Duration: ${Math.round(result.duration / 1000)}s`)
    })

    const totalFound = orchestratorResults.results.reduce((acc, r) => acc + r.casesFound, 0)
    const totalProcessed = orchestratorResults.results.reduce((acc, r) => acc + r.casesProcessed, 0)
    const totalErrors = orchestratorResults.results.reduce((acc, r) => acc + r.errors.length, 0)

    console.log('\n📊 Total Summary:')
    console.log(`  - Total Cases Found: ${totalFound}`)
    console.log(`  - Total Cases Processed: ${totalProcessed}`)
    console.log(`  - Total Errors: ${totalErrors}`)
  } catch (error) {
    console.error('❌ Orchestrator failed:', error)
  }
}

async function main() {
  console.log('🚀 Starting Collector Tests...')
  console.log('================================')

  // Check environment variables
  const requiredEnvVars = ['GEMINI_API_KEY', 'EXA_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

  if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:')
    missingEnvVars.forEach(varName => console.error(`  - ${varName}`))
    process.exit(1)
  }

  // Run tests based on command line arguments
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('all')) {
    await testSecCollector()
    await testExaCollector()
    await testFtcCollector()
  } else {
    if (args.includes('sec')) await testSecCollector()
    if (args.includes('exa')) await testExaCollector()
    if (args.includes('ftc')) await testFtcCollector()
    if (args.includes('orchestrator')) await testOrchestrator()
  }

  console.log('\n✅ All tests completed!')
}

// Run with error handling
main().catch(error => {
  console.error('❌ Test runner failed:', error)
  process.exit(1)
}) 