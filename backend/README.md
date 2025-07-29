# Claim Finder Backend

This is the backend service for the Claim Finder application, deployed separately to Railway.

## Architecture

- **Framework**: Node.js + Express + TypeScript
- **Queue System**: BullMQ with Redis
- **AI Services**: Google Gemini + Exa API
- **Database**: Supabase
- **Deployment**: Railway (separate from frontend)

## Deployment

This backend is deployed to Railway independently of the frontend:

1. **Automatic Deployment**: Pushes to `main` branch trigger deployment via GitHub Actions
2. **Manual Deployment**: `railway up` from the project root (not this directory)

The Railway configuration at the root level (`railway.json`) ensures only this backend folder is deployed.

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Environment Variables

Required for production (set in Railway dashboard):
- `REDIS_URL` - Automatically provided by Railway Redis
- `GEMINI_API_KEY` - Google Gemini API key
- `EXA_API_KEY` - Exa search API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

Optional:
- `ENABLE_CRON` - Enable scheduled collectors (default: false)
- `WEBHOOK_URL` - Frontend webhook for notifications
- `PORT` - Server port (default: 3001, auto-set by Railway)

## API Endpoints

### Collector Management
- `POST /api/collectors/run` - Start a collector job
- `GET /api/collectors/jobs/:id` - Get job status
- `GET /api/collectors/jobs` - List all jobs
- `GET /api/collectors/metrics` - System metrics

### Monitoring
- `POST /api/collectors/monitor/start` - Start continuous monitoring
- `POST /api/collectors/monitor/stop` - Stop monitoring
- `GET /api/collectors/monitor/status` - Get monitoring status

### Health & Admin
- `GET /api/health` - Health check endpoint
- `GET /admin/queues` - Bull Dashboard (job queue UI)

## Collectors

The backend includes several collectors that gather legal opportunities:

1. **Exa Collector** - Web search for class actions, settlements
2. **FTC Collector** - Federal Trade Commission announcements
3. **SEC Collector** - Securities and Exchange Commission filings
4. **AI Orchestrator** - Intelligent collector coordination

## Monitoring Features

- **Continuous Monitoring**: Scheduled collection runs
- **Pattern Recognition**: AI identifies violation patterns
- **CIK Lookup**: Automatic company identification
- **Timezone Awareness**: Adjusts schedules to user timezone

## Project Structure

```
backend/
├── src/
│   ├── server.ts           # Main server with cron
│   ├── server-simple.ts    # Simple server (default)
│   ├── lib/
│   │   ├── ai/            # AI services (Gemini, Exa)
│   │   ├── collectors/    # Data collectors
│   │   └── supabase/      # Database operations
│   ├── queues/            # BullMQ job processing
│   ├── routes/            # API routes
│   └── types/             # TypeScript types
├── logs/                  # Application logs
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── railway.toml          # Railway configuration
└── nixpacks.toml         # Build configuration
```

## Logs

Logs are stored in the `logs/` directory:
- `combined.log` - All logs
- `error.log` - Error logs only

In production, logs are available in the Railway dashboard.

## Redis

Redis is used for:
- Job queue management (BullMQ)
- Caching collector results
- Rate limiting

Railway automatically provides Redis when added as a service.

## Troubleshooting

1. **Redis Connection Failed**
   - Ensure Redis service is added in Railway
   - Check REDIS_URL environment variable

2. **API Key Errors**
   - Verify all required API keys are set
   - Check logs for specific API errors

3. **Build Failures**
   - Check nixpacks.toml configuration
   - Ensure all dependencies are in package.json

## Development Tips

1. Use `npm run dev` for hot-reloading during development
2. Test collectors individually before running all
3. Monitor Bull Dashboard for job status
4. Check logs for AI decision-making insights

## Related Documentation

- [Deployment Guide](./DEPLOYMENT.md) - Detailed deployment instructions
- [Monitoring Guide](./MONITORING.md) - Continuous monitoring setup
- [Main Project README](../README.md) - Overall project documentation 