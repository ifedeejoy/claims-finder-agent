# Continuous Legal Opportunity Monitoring System

## Overview

The enhanced system continuously monitors SEC filings, FTC announcements, regulatory updates, and news feeds to automatically identify emerging legal opportunities before they become widely known. It uses AI-driven pattern recognition to parse regulatory documents for violation indicators and cross-references against successful case patterns.

## Key Features

### 1. Continuous Monitoring Schedules

The system runs on optimized schedules:

- **News Feeds** (Every 15 minutes): Monitors breaking legal news and emerging opportunities
- **SEC Filings** (Every hour): Checks new EDGAR filings for violation indicators
- **FTC Announcements** (Every 2 hours): Scans for new enforcement actions and consumer protection announcements
- **Deep Analysis** (Daily at 9 AM): Comprehensive pattern recognition across all sources
- **Weekend Scan** (Saturdays & Sundays): Catches opportunities posted during off-hours

### 2. Timezone-Aware Collection

The orchestrator adapts to your timezone:
- Adjusts collection times based on source update patterns
- Optimizes for when sources are most likely to publish new content
- Accounts for international sources with different schedules

### 3. Pattern Recognition

#### Violation Indicators
The system searches for specific patterns in regulatory documents:

**SEC Filings:**
- Material weakness, restatement, class action
- Investigation, litigation, breach, violation
- Penalty, settlement, deficiency, non-compliance
- Whistleblower complaints, subpoenas

**FTC Actions:**
- Deceptive practices, unfair practices
- Consumer harm, false advertising
- Privacy violations, data breaches
- Unauthorized charges, hidden fees

**Regulatory Patterns:**
- Consent orders, enforcement actions
- Civil penalties, injunctions
- Disgorgement, restitution
- Refund programs, compliance failures

#### Success Pattern Cross-Referencing

The system scores opportunities based on:

**High-Value Indicators:**
- Million dollar settlements
- Nationwide class coverage
- Automatic payments
- No proof of purchase required

**Easy Claim Indicators:**
- Online claim forms
- Simple process
- Minimal documentation
- Self-certification

**Urgency Indicators:**
- Approaching deadlines
- Limited time offers
- Final notices

### 4. Company CIK Lookup

When companies are identified in legal opportunities:
1. Automatically looks up their CIK numbers
2. Searches for related SEC filings
3. Identifies additional violation patterns
4. Adds company-specific queries for future monitoring

## API Endpoints

### Start Continuous Monitoring
```bash
POST /api/collectors/monitor/start
{
  "timezone": "America/Los_Angeles",
  "schedules": ["newsFeeds", "secFilings", "ftcAnnouncements"]
}
```

### Stop Monitoring
```bash
POST /api/collectors/monitor/stop
{
  "schedules": ["newsFeeds"]  // Optional, stops all if not specified
}
```

### Check Monitoring Status
```bash
GET /api/collectors/monitor/status
```

### Get Performance Metrics
```bash
GET /api/collectors/metrics
```

## Usage Examples

### 1. Start Full Monitoring (All Schedules)
```bash
curl -X POST http://localhost:3001/api/collectors/monitor/start \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York"
  }'
```

### 2. Start Specific Monitors
```bash
curl -X POST http://localhost:3001/api/collectors/monitor/start \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "Europe/London",
    "schedules": ["secFilings", "newsFeeds"]
  }'
```

### 3. Run One-Time Collection
```bash
curl -X POST http://localhost:3001/api/collectors/run \
  -H "Content-Type: application/json" \
  -d '{
    "type": "all"
  }'
```

### 4. Check System Performance
```bash
curl http://localhost:3001/api/collectors/metrics
```

## Monitoring Types

### News Feeds Monitoring
- Checks legal news sites, blogs, and press releases
- Identifies breaking opportunities
- Detects emerging trends

### SEC Filings Monitoring
- Monitors EDGAR for new filings
- Searches for violation indicators
- Tracks companies with multiple issues

### FTC Announcements Monitoring
- Scans FTC press releases
- Checks CFPB announcements
- Monitors state AG actions

### Deep Analysis
- Comprehensive cross-source analysis
- Pattern recognition across all data
- Trend identification and prediction

### Weekend Scan
- Catches opportunities posted during off-hours
- Checks sources that update on weekends
- Ensures nothing is missed

## Scoring System

Each discovered opportunity is scored on multiple factors:

1. **Settlement Likelihood** (0-10): Based on violation patterns and historical data
2. **Affected Consumer Count**: Estimate of how many people are eligible
3. **Average Payout**: Expected compensation per claimant
4. **Claim Difficulty** (1-5): How easy it is to file a claim (lower is better)
5. **Urgency Score**: Based on deadline proximity

## Configuration

### Environment Variables
```bash
# Required
GEMINI_API_KEY=your_gemini_api_key
EXA_API_KEY=your_exa_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
REDIS_URL=redis://localhost:6379

# Optional
DEFAULT_TIMEZONE=America/New_York
MONITORING_ENABLED=true
```

### Custom Schedules
You can modify the monitoring schedules in `routes/collectors.ts`:

```typescript
const MONITORING_SCHEDULES = {
  newsFeeds: { cron: '*/15 * * * *', description: 'Every 15 minutes' },
  // Add custom schedules here
}
```

## Troubleshooting

### Common Issues

1. **Timezone not recognized**: Use standard IANA timezone names (e.g., "America/New_York")
2. **Jobs not running**: Check Redis connection and Bull dashboard at `/admin/queues`
3. **API rate limits**: The system includes rate limiting between requests

### Monitoring Logs
```bash
# View all logs
tail -f backend/logs/combined.log

# View errors only
tail -f backend/logs/error.log

# Filter for monitoring jobs
grep "monitoring" backend/logs/combined.log
```

## Performance Optimization

### Best Practices

1. **Timezone Selection**: Set your actual timezone for optimal source timing
2. **Schedule Selection**: Only enable monitors you need to reduce API usage
3. **Pattern Updates**: The system learns from successful cases to improve future searches

### Resource Usage

- News feed monitoring: ~100 API calls/day
- SEC filing monitoring: ~50 API calls/day
- FTC monitoring: ~25 API calls/day
- Deep analysis: ~200 API calls/run

## Future Enhancements

1. **Machine Learning**: Train models on successful case patterns
2. **Notification System**: Real-time alerts for high-value opportunities
3. **API Integration**: Direct integration with claim filing systems
4. **Multi-language Support**: Monitor international sources
5. **Social Media Monitoring**: Track emerging issues on social platforms 