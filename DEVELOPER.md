# Developer Guide - Legal Opportunity Monitor

This document contains technical details for development and maintenance.

## Project Structure

```
claim-finder-agent/
├── app/                    # Next.js app router pages
├── components/            # React components
├── lib/                   # Shared libraries
│   ├── ai/               # Gemini & Exa integrations
│   ├── collectors/       # Data collection logic
│   ├── supabase/        # Database operations
│   └── monitoring/      # Production monitoring
├── backend/              # Standalone backend service
│   ├── src/             # Backend source code
│   ├── Dockerfile       # Container configuration
│   └── package.json     # Backend dependencies
├── scripts/             # Utility scripts
├── supabase/           # Database migrations
└── types/              # TypeScript definitions
```

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
GEMINI_API_KEY=your_gemini_api_key
EXA_API_KEY=your_exa_api_key
```

### Backend (.env)
```bash
PORT=3001
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
EXA_API_KEY=your_exa_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Development Commands

```bash
# Frontend
pnpm install              # Install dependencies
pnpm dev                 # Development server
pnpm build              # Production build
pnpm type-check         # TypeScript checking
pnpm lint               # ESLint

# Backend
cd backend
npm run setup           # Copy files from main project
npm install             # Install backend dependencies
npm run dev            # Development server
npm run build          # Production build
npm start              # Production server

# Data Collection
pnpm collect:exa        # Run Exa collector
pnpm collect:sec        # Run SEC collector
pnpm collect:ftc        # Run FTC collector
pnpm collect:all        # Run all collectors

# Testing
pnpm test:local         # Test local setup
```

## Data Collectors

### Base Collector (`lib/collectors/base-collector.ts`)
- Shared functionality for all collectors
- Duplicate detection logic
- Quality assessment integration
- Database operations

### Exa Collector (`lib/collectors/exa-collector.ts`)
- Web search via Exa API
- Playwright fallback for complex sites
- Progressive date filtering (7d → 14d → 30d)

### SEC Collector (`lib/collectors/sec-collector.ts`)
- Official SEC EDGAR API integration
- Filing type filtering
- Content extraction from filings

### FTC Collector (`lib/collectors/ftc-collector.ts`)
- FTC press release monitoring
- Enforcement action tracking
- Consumer protection announcements

## Database Operations

### Key Functions (`lib/supabase/operations.ts`)
- `getActiveCases()`: Fetch current opportunities
- `getActiveSources()`: Get monitored sources
- `createCase()`: Add new opportunity
- `findSimilarCases()`: Duplicate detection
- `markCaseAsExpired()`: Expire old cases

### Migrations (`supabase/migrations/`)
- Database schema definitions
- Indexes for performance
- RLS policies for security

## AI Integrations

### Gemini Service (`lib/ai/gemini.ts`)
- Content extraction and analysis
- Structured data extraction
- Quality assessment
- Duplicate detection

### Exa Service (`lib/ai/exa.ts`)
- Intelligent web search
- Domain-specific searches
- Content retrieval

## Monitoring

### Production Monitoring (`lib/monitoring/production-monitoring.ts`)
- System health checks
- Performance metrics
- Error tracking
- Daily reports

### Key Metrics
- Collection success rates
- Processing times
- Error rates
- Database performance

## Deployment

### Frontend (Vercel)
1. Connect GitHub repository
2. Set environment variables
3. Configure build settings
4. Deploy automatically on push

### Backend Options

#### Railway
```bash
cd backend
railway login
railway init
railway add
railway deploy
```

#### Docker
```bash
cd backend
docker build -t claim-finder-backend .
docker run -p 3001:3001 --env-file .env claim-finder-backend
```

#### VPS with PM2
```bash
# On server
git clone <repo>
cd claim-finder-agent/backend
npm run setup
npm install
npm run build
pm2 start dist/server-simple.js --name claim-finder-backend
```

## Testing

### Local Testing
```bash
pnpm test:local
```

### Manual Collection Testing
```bash
# Test individual collectors
pnpm collect:exa
pnpm collect:sec
pnpm collect:ftc

# Test orchestrator
cd scripts && node test-orchestrator.js
```

## Troubleshooting

### Common Issues

1. **Build Errors**: Usually missing environment variables
2. **API Rate Limits**: Adjust delays in collectors
3. **Database Timeouts**: Check Supabase connection
4. **Playwright Issues**: Ensure Chromium is installed

### Debug Mode
```bash
LOG_LEVEL=debug pnpm dev
```

### Database Issues
```bash
# Reset migrations
supabase db reset

# Check connection
supabase status
```

## Performance Optimization

- Use connection pooling for database
- Implement proper caching strategies
- Monitor API rate limits
- Optimize database queries
- Use CDN for static assets

## Security Considerations

- API keys in environment variables only
- Database RLS policies enabled
- CORS properly configured
- Input validation on all endpoints
- Rate limiting in production

## Maintenance

### Regular Tasks
- Monitor collector success rates
- Update dependencies
- Review error logs
- Clean up expired cases
- Backup database

### Scaling Considerations
- Horizontal scaling of backend service
- Database read replicas
- CDN for static content
- Load balancing for high traffic
