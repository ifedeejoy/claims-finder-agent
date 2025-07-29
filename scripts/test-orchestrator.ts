#!/usr/bin/env tsx

import { agenticOrchestrator } from '../lib/ai/agentic-orchestrator'

async function testOrchestrator() {
  console.log('🤖 Testing AI-Guided Orchestrator\n')

  try {
    // Test strategy selection
    console.log('1️⃣ Testing Strategy Selection...')
    const result = await agenticOrchestrator.runCollection()

    console.log('\n📊 Collection Results:')
    console.log(`  Strategy: ${result.strategy}`)
    console.log(`  Reasoning: ${result.reasoning}`)
    console.log(`  Collectors Run: ${result.collectorsRun.join(', ')}`)
    console.log(`  Total Cases Found: ${result.results.reduce((sum, r) => sum + r.casesFound, 0)}`)
    console.log(`  Total Cases Processed: ${result.results.reduce((sum, r) => sum + r.casesProcessed, 0)}`)

    // Display results by collector
    console.log('\n📈 Results by Collector:')
    result.results.forEach(r => {
      console.log(`  ${r.sourceName}:`)
      console.log(`    - Cases Found: ${r.casesFound}`)
      console.log(`    - Cases Processed: ${r.casesProcessed}`)
      console.log(`    - Errors: ${r.errors.length}`)
      console.log(`    - Duration: ${(r.duration / 1000).toFixed(2)}s`)
    })

    // Test query optimization
    console.log('\n2️⃣ Testing Query Optimization...')
    const currentQueries = [
      'class action settlement',
      'consumer refund',
      'legal settlement claim'
    ]

    const optimizedQueries = await agenticOrchestrator.optimizeSearchQueries(currentQueries)
    console.log('  Original queries:', currentQueries)
    console.log('  Optimized queries:', optimizedQueries)

    // Test source discovery
    console.log('\n3️⃣ Testing Source Discovery...')
    const newSources = await agenticOrchestrator.discoverSources()
    console.log(`  Discovered ${newSources.length} new sources:`)
    newSources.forEach(source => console.log(`    - ${source}`))

    console.log('\n✅ AI Orchestrator test complete!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  }
}

// Run test
testOrchestrator() 