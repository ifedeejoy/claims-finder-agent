# Claim Finder Backend Service

A separate Node.js/Express backend service that handles long-running data collection tasks with AI-guided orchestration for the Claim Finder application.

## 🤖 AI-Guided Orchestration

The backend uses an intelligent orchestrator powered by Gemini AI to optimize the collection process:

### Features

- **Smart Strategy Selection**: AI analyzes performance metrics and time patterns to choose optimal collection strategies
- **Dynamic Source Prioritization**: Sources are ranked based on historical success rates and recency
- **Query Optimization**: AI improves search queries based on successful past discoveries
- **Quality Assessment**: Automatic filtering of low-quality opportunities
- **Source Discovery**: Monthly discovery of new legal opportunity sources

### Collection Strategies

1. **Aggressive**: Run all collectors with high frequency (high activity periods)
2. **Targeted**: Focus on high-performing sources (default strategy)
3. **Exploratory**: Try new search terms and sources (discovery mode)
4. **Maintenance**: Light collection, focus on data quality (low activity periods)

## 🚀 Quick Start

### Local Development

```bash
# Setup (first time only)
npm run setup

# Start development server with AI orchestration
npm run dev

# The server will run on http://localhost:3001
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Core Configuration
PORT=3001
NODE_ENV=development

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
EXA_API_KEY=your_exa_api_key

# Optional: Webhook for notifications
WEBHOOK_URL=https://your-frontend.vercel.app/api/webhooks/collector
```

## 📡 API Endpoints

### Run Collection

```bash
POST /api/collectors/run
Content-Type: application/json

{
  "type": "all" | "exa" | "ftc" | "sec"
}

# Response
{
  "success": true,
  "data": {
    "jobId": "job_123456789_abc",
    "message": "Collector job all started",
    "status": "pending"
  }
}
```

### Check Job Status

```bash
GET /api/collectors/jobs/:jobId

# Response (AI-guided collection)
{
  "success": true,
  "data": {
    "id": "job_123456789_abc",
    "type": "all",
    "status": "completed",
    "strategy": "targeted",
    "reasoning": "Business hours with good historical performance for FTC and SEC sources",
    "result": {
      "collectorsRun": ["Exa Web Search", "FTC Press Releases"],
      "totalCasesFound": 25,
      "totalCasesProcessed": 22,
      "errors": []
    },
    "duration": 45.2
  }
}
```

### List All Jobs

```bash
GET /api/collectors/jobs

# Returns last 50 jobs with AI strategy information
```

### Health Check

```bash
GET /api/health
```

## 🚀 Deployment

### Railway (Recommended)

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and initialize:
```bash
railway login
railway init
```

3. Set environment variables:
```bash
railway variables set GEMINI_API_KEY=your_key
railway variables set EXA_API_KEY=your_key
railway variables set SUPABASE_URL=your_url
railway variables set SUPABASE_SERVICE_ROLE_KEY=your_key
```

4. Deploy:
```bash
railway up
```

### Vercel (Not Recommended)
Vercel has timeout limits that make it unsuitable for long-running collection tasks. Use Railway or another platform that supports background jobs.

## 🕐 Automated Collection Schedule

The AI orchestrator runs on the following schedule:

- **Main Collection**: Every 4 hours (AI-guided strategy)
- **Quick Exa Search**: Every 2 hours (time-sensitive opportunities)
- **FTC Check**: Daily at 10 AM EST
- **SEC Check**: Daily at 5 PM EST (after market close)
- **Query Optimization**: Weekly on Sundays
- **Source Discovery**: Monthly on the 1st

## 🏗️ Architecture

```
backend/
├── src/
│   ├── server-simple.ts      # Main server with in-memory jobs
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── agentic-orchestrator.ts  # AI-guided orchestration
│   │   │   ├── gemini.ts                # Gemini AI integration
│   │   │   └── exa.ts                   # Exa search service
│   │   ├── collectors/       # Individual collector implementations
│   │   ├── supabase/        # Database operations
│   │   └── logger.ts        # Winston logging
│   ├── cron/               # Scheduled jobs
│   └── types/              # TypeScript definitions
├── dist/                   # Compiled JavaScript
└── logs/                   # Application logs
```

## 🔍 Monitoring

### AI Orchestration Logs

The system logs detailed information about AI decisions:

```
INFO: Selected strategy: targeted - Business hours with good historical performance
INFO: Running collector: Exa Web Search (priority: 0.82)
INFO: Updated metrics for Exa Web Search: Success rate 87.5%
```

### Performance Metrics

Track collector performance through the job API:
- Success rates per source
- Average processing time
- Error patterns
- AI strategy effectiveness

## 🛡️ Security

- All API keys stored as environment variables
- Service role key used for Supabase operations
- CORS configured for frontend origin
- Rate limiting on external API calls

## 🧪 Testing

Test the AI orchestration locally:

```bash
# Test all collectors with AI guidance
curl -X POST http://localhost:3001/api/collectors/run \
  -H "Content-Type: application/json" \
  -d '{"type": "all"}'

# Check job status
curl http://localhost:3001/api/collectors/jobs/JOB_ID
```

## 📈 Cost Optimization

The AI orchestrator helps reduce costs by:
- Prioritizing high-value sources
- Avoiding redundant searches
- Optimizing API call frequency
- Filtering low-quality results early

## 🔧 Troubleshooting

### Common Issues

1. **AI Strategy Selection Fails**
   - Check GEMINI_API_KEY is set correctly
   - System falls back to "targeted" strategy

2. **Collectors Not Running**
   - Verify all API keys are set
   - Check logs in `logs/` directory
   - Ensure database connection is working

3. **High API Costs**
   - Adjust collection frequency in cron schedule
   - Review AI strategy logs for optimization opportunities
   - Consider reducing `numResults` in Exa searches

### Debug Mode

Enable detailed logging:
```bash
DEBUG=* npm run dev
```

## 🚀 Future Enhancements

- [ ] Real-time strategy adjustments based on live metrics
- [ ] Multi-model AI consensus for quality assessment
- [ ] Automatic source quality degradation detection
- [ ] Cost prediction and budget management
- [ ] Custom strategy plugins 