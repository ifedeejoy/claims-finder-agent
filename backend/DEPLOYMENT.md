# Backend Deployment Guide

## Overview

The Claim Finder backend is deployed separately from the frontend:
- **Backend**: Deployed to Railway
- **Frontend**: Deployed to Vercel
- **Database**: Supabase (shared between environments)
- **Redis**: Railway Redis add-on

## Deployment Architecture

```
Frontend (Vercel) --> Backend API (Railway) --> Supabase DB
                                           \--> Redis (Railway)
```

## Railway Deployment

### Initial Setup

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   
   # Create new project
   railway init
   ```

2. **Add Redis Service**
   - In Railway dashboard, click "New Service"
   - Select "Redis"
   - Railway will automatically provide `REDIS_URL`

3. **Configure Environment Variables**
   In Railway dashboard, add:
   ```
   GEMINI_API_KEY=your-gemini-api-key
   EXA_API_KEY=your-exa-api-key
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ENABLE_CRON=true
   WEBHOOK_URL=https://your-frontend.vercel.app/api/webhooks/collector
   ```

4. **Get Railway Token for GitHub Actions**
   ```bash
   railway tokens create github-actions
   ```
   Add this token as `RAILWAY_TOKEN` in GitHub Secrets

### Railway Configuration Files

The backend uses these configuration files:

1. **`railway.json`** (root directory) - Tells Railway to build only the backend
   ```json
   {
     "build": {
       "builder": "nixpacks",
       "buildCommand": "cd backend && npm install && npm run build",
       "watchPatterns": ["backend/**"]
     },
     "deploy": {
       "startCommand": "cd backend && npm start"
     }
   }
   ```

2. **`backend/railway.toml`** - Backend-specific Railway configuration
3. **`backend/nixpacks.toml`** - Build configuration for nixpacks

### Manual Deployment

```bash
# From project root
railway up --service backend

# Or from backend directory
cd backend
railway up
```

## GitHub Actions Deployment

The `.github/workflows/deploy.yml` handles automatic deployments:

1. **On push to main**:
   - Tests frontend and backend separately
   - Deploys frontend to Vercel
   - Deploys backend to Railway

2. **Required GitHub Secrets**:
   ```
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

## Environment Variables

### Backend (Railway)
- `NODE_ENV=production`
- `PORT=3001` (Railway provides this)
- `REDIS_URL` (auto-provided by Railway)
- `GEMINI_API_KEY`
- `EXA_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENABLE_CRON=true`
- `WEBHOOK_URL` (optional)

### Frontend (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BACKEND_URL` (your Railway backend URL)

## Monitoring

1. **Backend Health**: `https://your-backend.railway.app/api/health`
2. **Bull Dashboard**: `https://your-backend.railway.app/admin/queues`
3. **Railway Logs**: Available in Railway dashboard
4. **Vercel Logs**: Available in Vercel dashboard

## Troubleshooting

### Railway Build Failures

1. **Check build logs in Railway dashboard**
2. **Ensure all dependencies are in package.json**
3. **Check nixpacks.toml configuration**

### Common Issues

1. **"Cannot find module" errors**
   - Ensure all dependencies are listed in backend/package.json
   - Check that TypeScript paths are resolved correctly

2. **Redis connection errors**
   - Ensure Redis service is added in Railway
   - Check REDIS_URL is available

3. **Build timeout**
   - Increase build timeout in Railway settings
   - Optimize build process

### Rollback

Railway automatically keeps previous deployments:
```bash
# List deployments
railway deployments

# Rollback to previous
railway rollback
```

## Local Development

To test Railway deployment locally:
```bash
cd backend
npm install
npm run build
npm start
```

## Cost Optimization

1. **Use Railway's sleep feature** for development environments
2. **Monitor Redis memory usage**
3. **Set appropriate resource limits in railway.toml**
4. **Use Vercel's hobby plan for frontend** 