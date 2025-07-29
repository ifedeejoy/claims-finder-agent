# Deployment Summary

## Architecture Overview

The Claim Finder application is deployed as two separate services:

```
┌─────────────────────┐       ┌─────────────────────┐
│                     │       │                     │
│   Frontend (Next.js)│ ----> │   Backend (Node.js) │
│   Deployed: Vercel  │ HTTP  │  Deployed: Railway  │
│                     │       │                     │
└─────────────────────┘       └──────────┬──────────┘
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                              │  Redis    Supabase  │
                              │ Railway   Database  │
                              │                     │
                              └─────────────────────┘
```

## Key Files for Deployment

### Root Level
- **`railway.json`** - Tells Railway to only build the backend directory
- **`.vercelignore`** - Prevents Vercel from deploying the backend
- **`.github/workflows/deploy.yml`** - Automated deployment workflow

### Backend Directory
- **`backend/railway.toml`** - Railway-specific configuration
- **`backend/nixpacks.toml`** - Build configuration for Railway
- **`backend/package.json`** - Backend dependencies and scripts

## Deployment Process

### 1. Frontend → Vercel
- Triggered by push to `main` branch
- Builds Next.js application
- Ignores `/backend` directory
- Environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_BACKEND_URL` (Railway backend URL)

### 2. Backend → Railway
- Triggered by push to `main` branch
- Changes directory to `/backend`
- Builds Node.js/TypeScript application
- Connects to Railway Redis service
- Environment variables:
  - `REDIS_URL` (auto-provided by Railway)
  - `GEMINI_API_KEY`
  - `EXA_API_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## GitHub Actions Workflow

The deployment is orchestrated by `.github/workflows/deploy.yml`:

1. **Test Frontend** - Runs type checking, linting, and build
2. **Test Backend** - Builds the backend to ensure no errors
3. **Deploy Frontend** - Deploys to Vercel (only on main branch)
4. **Deploy Backend** - Deploys to Railway (only on main branch)

## Required GitHub Secrets

```yaml
# Frontend (Vercel)
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Backend (Railway)
RAILWAY_TOKEN

# Shared API Keys
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
EXA_API_KEY
```

## Local Development

### Frontend
```bash
# From root directory
pnpm install
pnpm dev
# Runs on http://localhost:3000
```

### Backend
```bash
# From backend directory
cd backend
npm install
npm run dev
# Runs on http://localhost:3001
```

## Manual Deployment

### Frontend to Vercel
```bash
vercel --prod
```

### Backend to Railway
```bash
# From root directory (not backend/)
railway up --service backend
```

## Common Issues and Solutions

### 1. Railway Building Wrong Directory
**Problem**: Railway tries to build the Next.js frontend instead of backend
**Solution**: The `railway.json` at root level fixes this by specifying:
```json
{
  "build": {
    "buildCommand": "cd backend && npm install && npm run build",
    "watchPatterns": ["backend/**"]
  }
}
```

### 2. Vercel Deploying Backend
**Problem**: Vercel includes backend in deployment
**Solution**: `.vercelignore` file excludes the backend directory

### 3. Environment Variables Not Available
**Problem**: Build fails due to missing environment variables
**Solution**: Add all required variables in both Vercel and Railway dashboards

## Monitoring

- **Frontend Logs**: Vercel Dashboard → Functions → Logs
- **Backend Logs**: Railway Dashboard → Service → Logs
- **Backend Health**: `https://[railway-url]/api/health`
- **Job Queue**: `https://[railway-url]/admin/queues`

## Cost Optimization

1. **Vercel**: Use hobby plan for frontend (free for personal projects)
2. **Railway**: 
   - Enable sleep mode for development
   - Monitor Redis memory usage
   - Set resource limits in `railway.toml`

## Next Steps

1. Set up all required environment variables in both platforms
2. Add GitHub secrets for automated deployment
3. Test deployment workflow by pushing to main branch
4. Monitor initial deployments for any issues 