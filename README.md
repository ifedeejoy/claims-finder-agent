# Legal Opportunity Monitor

A web application that automatically monitors legal information sources to identify potential opportunities for U.S. consumers - class action settlements, consumer refunds, and enforcement actions.

## Architecture

The system consists of two parts:

### Frontend (Next.js)
- User interface for browsing discovered opportunities
- Built with Next.js, TypeScript, and Tailwind CSS
- Real-time updates via Supabase integration
- Deployed on Vercel

### Backend Service
- Standalone Node.js service for long-running data collection
- Avoids serverless timeout limitations
- Processes multiple sources concurrently
- Deployed separately (Railway, VPS, etc.)

## Data Sources

- **SEC EDGAR**: Corporate filings and settlement announcements
- **FTC**: Press releases and enforcement actions  
- **Web Search**: Legal news sites and class action databases
- **Class Action Sites**: TopClassActions, ClassAction.org, etc.

## Key Features

- **Automated Discovery**: Continuously monitors sources for new opportunities
- **Smart Extraction**: Extracts structured data (deadlines, payouts, eligibility)
- **Duplicate Detection**: Prevents reprocessing of existing cases
- **Quality Assessment**: Evaluates opportunity value and legitimacy
- **Real-time Updates**: Live database updates for immediate visibility

## Technical Stack

- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, Bull queues
- **Database**: PostgreSQL (Supabase)
- **AI Services**: Google Gemini for content extraction, Exa for search
- **Web Scraping**: Playwright for complex sites, traditional scraping for APIs
- **Deployment**: Vercel (frontend) + Railway/VPS (backend)

## Development

### Frontend Setup
```bash
# Install dependencies
pnpm install

# Configure environment (.env.local)
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Run development server
pnpm dev
```

### Backend Setup
```bash
cd backend

# Setup backend files
npm run setup

# Configure environment (.env)
PORT=3001
GEMINI_API_KEY=your_key
EXA_API_KEY=your_key
# ... other vars

# Run backend service
npm run dev
```

## Database Schema

- **sources**: Monitored data sources (URLs, last check times, config)
- **cases**: Discovered legal opportunities (title, description, deadlines, eligibility)

The system tracks performance metrics and optimizes collection strategies based on success rates.

## How It Works

1. **Collection Orchestration**: Backend service runs collectors on schedule
2. **Content Processing**: Gemini extracts structured data from raw content
3. **Quality Control**: Multi-layer duplicate detection and quality assessment
4. **Database Storage**: Cases stored with metadata for frontend display
5. **User Interface**: Frontend displays opportunities with filtering and search

The system is designed to run autonomously with minimal maintenance while providing valuable opportunities to users.
