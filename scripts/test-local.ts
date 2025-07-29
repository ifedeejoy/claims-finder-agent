#!/usr/bin/env tsx

/**
 * Local Testing Script
 * Run this to test the system locally with your API keys
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { agenticOrchestrator } from '@/lib/ai/agentic-orchestrator'
import { geminiService } from '@/lib/ai/gemini'
import { exaService } from '@/lib/ai/exa'

async function testEnvironment() {
  console.log('🧪 Testing Environment Setup...\n')

  // Test environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY',
    'GEMINI_API_KEY',
    'EXA_API_KEY'
  ]

  console.log('📋 Environment Variables:')
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    console.log(`  ${envVar}: ${value ? '✅ Set' : '❌ Missing'}`)
  }
  console.log()


  console.log('🤖 Testing AI Services...\n')

  try {
    console.log('  Testing Gemini API...')
    const geminiTest = await geminiService.generateContent('Say "Gemini is working" and nothing else.')
    console.log(`  ✅ Gemini Response: ${geminiTest.response.text()}\n`)
  } catch (error) {
    console.log(`  ❌ Gemini Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }

  try {
    console.log('  Testing Exa API...')
    const exaTest = await exaService.searchSpecificDomains(
      'class action settlement',
      ['classaction.org'],
      2
    )
    console.log(`  ✅ Exa Results: Found ${exaTest.length} results\n`)
  } catch (error) {
    console.log(`  ❌ Exa Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`)
  }

  // Test Legal Opportunity Detection
  console.log('⚖️  Testing Legal Opportunity Detection...\n')

  const testContent = `
    Apple has agreed to pay $95 million to settle a class action lawsuit
    alleging that its voice assistant Siri was activated without permission
    and recorded private conversations. The settlement covers consumers who
    owned Siri-enabled devices between September 17, 2014 and December 31, 2024.
    
    Eligible class members can receive up to $20 per device, with a maximum
    of 5 devices per person. No proof of purchase is required. The deadline
    to submit claims is January 31, 2025.
  `

  try {
    const isLegal = await geminiService.isLegalOpportunity(testContent)
    console.log(`  ✅ Legal Opportunity Detection: ${isLegal ? 'Detected legal opportunity' : 'No legal opportunity found'}`)

    if (isLegal) {
      const extracted = await geminiService.extractCaseDetails(testContent)
      console.log(`  ✅ Extracted Case: ${extracted.title}`)
      console.log(`  💰 Estimated Payout: ${extracted.estimatedPayout || 'Not specified'}`)
      console.log(`  📅 Deadline: ${extracted.deadlineDate || 'Not specified'}`)
    }
  } catch (error) {
    console.log(`  ❌ Legal Detection Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  console.log('\n🎯 Test Complete!\n')
}

async function testAgenticOrchestrator() {
  console.log('🤖 Testing Agentic Orchestrator...\n')

  try {
    console.log('  🔍 Testing Source Discovery...')
    const newSources = await agenticOrchestrator.discoverSources()
    console.log(`  ✅ Discovered ${newSources.length} new sources:`)
    newSources.forEach(source => console.log(`    - ${source}`))
    console.log()

    // Test search query optimization
    console.log('  🎯 Testing Search Query Optimization...')
    const currentQueries = ['class action settlement', 'consumer refund program']
    const optimizedQueries = await agenticOrchestrator.optimizeSearchQueries(currentQueries)
    console.log(`  ✅ Generated ${optimizedQueries.length} queries:`)
    optimizedQueries.slice(0, 3).forEach(query => console.log(`    - "${query}"`))
    console.log()

    // Test case quality assessment
    console.log('  📊 Testing Case Quality Assessment...')
    const testCase = {
      title: 'Apple Siri Privacy Settlement',
      description: 'Settlement for Siri privacy violations with $20 per device payout',
      estimatedPayout: '$20 per device',
      deadlineDate: '2025-01-31',
      proofRequired: false
    }
    
    const qualityAssessment = await agenticOrchestrator.assessCaseQuality([testCase])
    const assessment = qualityAssessment[0]
    console.log(`  ✅ Quality Score: ${assessment.quality}/10`)
    console.log(`  ✅ Keep Case: ${assessment.keep ? 'Yes' : 'No'}`)

  } catch (error) {
    console.log(`  ❌ Agentic Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  console.log('\n🎯 Agentic Test Complete!\n')
}

async function main() {
  console.log('🚀 Legal Opportunity Monitor - Local Test\n')
  
  await testEnvironment()
  await testAgenticOrchestrator()
  
  console.log('🎉 All tests completed!')
  console.log('\nNext steps:')
  console.log('1. Set up Supabase database using the migration file')
  console.log('2. Run: pnpm dev')
  console.log('3. Visit http://localhost:3000')
  console.log('4. Try running collectors: pnpm collect:all')
}

main().catch(console.error)
