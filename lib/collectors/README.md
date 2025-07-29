# Legal Opportunity Collectors

This directory contains automated collectors that discover and process legal opportunities from various sources.

## Overview

The collectors work together to find class action settlements, consumer refunds, and other legal opportunities that U.S. consumers might be eligible for.

## Collectors

### 1. SEC Collector (`sec-collector.ts`)

Monitors SEC EDGAR filings for legal settlements and class actions.

**Features:**
- Monitors 20+ major companies known for frequent settlements
- Searches recent filings (8-K, 10-K, 10-Q, etc.) for legal content
- Extracts settlement information from legal proceedings sections
- Extended 180-day lookback period for better coverage

**How it works:**
1. Fetches company submissions from SEC's data API
2. Filters for relevant forms and date ranges
3. Downloads and parses filing content
4. Uses AI to extract legal opportunities

### 2. Exa Collector (`exa-collector.ts`)

Uses neural search to discover legal opportunities across the web.

**Features:**
- Smart pagination for comprehensive results
- Multiple search queries for different case types
- Domain-specific targeting for trusted sources
- Deduplication to avoid processing the same content

**Search Categories:**
- Class action settlements
- FTC consumer refunds
- Data breach settlements
- Product defect cases
- Financial services settlements

### 3. FTC Collector (`ftc-collector.ts`)

Monitors Federal Trade Commission announcements for consumer refund programs.

**Features:**
- Scrapes FTC press releases and enforcement actions
- Focuses on consumer protection cases
- Extracts refund and claim information

## Usage

### Running Individual Collectors

```bash
# Run SEC collector
pnpm collect:sec

# Run Exa collector
pnpm collect:exa

# Run FTC collector
pnpm collect:ftc
```

### Running All Collectors

```bash
# Run all collectors sequentially
pnpm collect:all

# Test all collectors
pnpm test:collectors
```

### Testing Specific Collectors

```bash
# Test only SEC collector
pnpm test:collectors sec

# Test multiple collectors
pnpm test:collectors sec exa

# Test orchestrator
pnpm test:collectors orchestrator
```

## Configuration

### Exa Collector Configuration

```typescript
const collector = new ExaCollector({
  queries: ['custom query'],        // Custom search queries
  numResults: 100,                  // Results per query (max 100)
  dateFilter: '30d',               // Time window (7d, 14d, 30d, etc.)
  includeDomains: ['example.com'],  // Specific domains to search
  excludeDomains: ['spam.com']      // Domains to exclude
})
```

### Environment Variables

Required environment variables in `.env.local`:

```bash
# AI Services
GEMINI_API_KEY=your_gemini_api_key
EXA_API_KEY=your_exa_api_key

# Database
SUPABASE_SERVICE_ROLE_KEY=your_service_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Architecture

```
collectors/
├── base-collector.ts      # Base class with common functionality
├── exa-collector.ts       # Web search collector
├── sec-collector.ts       # SEC EDGAR collector
├── ftc-collector.ts       # FTC announcement collector
├── orchestrator.ts        # Manages all collectors
└── playwright-scraper.ts  # Browser automation for complex sites
```

## Error Handling

All collectors implement robust error handling:
- Network errors are retried with exponential backoff
- AI extraction errors are logged but don't stop processing
- Each collector tracks and reports errors separately
- Failed cases are logged for manual review

## Performance

- SEC Collector: ~10-20 seconds per company
- Exa Collector: ~1-2 seconds per result
- FTC Collector: ~30-60 seconds total
- Rate limiting prevents API throttling

## Development

To add a new collector:

1. Extend `BaseCollector` class
2. Implement the `collect()` method
3. Add to orchestrator
4. Create run script in `scripts/collectors/`
5. Add npm script to `package.json`

Example:

```typescript
export class NewCollector extends BaseCollector {
  constructor() {
    super('New Source', 'new-source')
  }

  async collect(): Promise<CollectorResult> {
    // Implementation
  }
}
``` 