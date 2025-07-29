# Backend Deployment Guide for Railway

This guide walks you through deploying the Claim Finder backend to Railway with Redis support.

## Prerequisites

- Railway account (https://railway.app)
- GitHub account
- Backend code in a separate repository

## Step 1: Prepare the Repository

1. Move the backend folder to a new repository:
```bash
# Create new repo
mkdir claim-finder-backend
cd claim-finder-backend

# Copy backend files
cp -r path/to/claim-finder-agent/backend/* .

# Initialize git
git init
git add .
git commit -m "Initial backend setup"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/claim-finder-backend.git
git push -u origin main
```

2. Ensure these files are present:
- `package.json` with correct scripts
- `railway.toml` configuration
- `src/server-simple.ts` as the main server file

## Step 2: Deploy to Railway

1. **Create New Project**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your backend repository

2. **Add Redis Service**
   - In your Railway project, click "New Service"
   - Select "Database" → "Add Redis"
   - Railway will automatically set `REDIS_URL` environment variable

3. **Configure Environment Variables**
   - Click on your backend service
   - Go to "Variables" tab
   - Add required variables:
     ```
     GEMINI_API_KEY=your_gemini_api_key
     EXA_API_KEY=your_exa_api_key
     SUPABASE_URL=your_supabase_url
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     NODE_ENV=production
     PORT=3001
     ```

4. **Deploy**
   - Railway will automatically deploy when you push to GitHub
   - Monitor deployment in the Railway dashboard

## Step 3: Verify Deployment

1. **Check Health Endpoint**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

2. **Access Bull Dashboard**
   - Navigate to: `https://your-app.railway.app/admin/queues`
   - Monitor job queues and Redis connection

3. **Test Collector API**
   ```bash
   # Start a collection job
   curl -X POST https://your-app.railway.app/api/collectors/run \
     -H "Content-Type: application/json" \
     -d '{"type": "all"}'
   
   # Check job status
   curl https://your-app.railway.app/api/collectors/jobs/JOB_ID
   ```

## Environment Variables Reference

### Required
- `REDIS_URL` - Automatically provided by Railway when Redis is added
- `GEMINI_API_KEY` - Google Gemini API key for AI processing
- `EXA_API_KEY` - Exa API key for web search
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Optional
- `ENABLE_CRON` - Set to "true" to enable scheduled collection (if using server.ts)
- `WEBHOOK_URL` - Frontend URL for notifications
- `NODE_ENV` - Set to "production" (Railway sets this automatically)
- `PORT` - Server port (default: 3001, Railway sets this automatically)

## Redis Configuration

The backend automatically connects to Redis using:
1. `REDIS_URL` if provided (Railway's default)
2. Individual `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` if no URL

## Monitoring

1. **Logs**
   - View in Railway dashboard under "Logs" tab
   - Application logs include AI decisions and collector status

2. **Bull Dashboard**
   - Access at `/admin/queues`
   - Monitor job queues, success/failure rates
   - View individual job details

3. **Health Check**
   - Railway automatically monitors `/api/health`
   - Includes Redis connection status

## Troubleshooting

### Redis Connection Issues
- Ensure Redis service is running in Railway
- Check `REDIS_URL` is set correctly
- View connection status in health endpoint

### API Key Errors
- Verify all required API keys are set
- Check logs for specific API errors
- Test with minimal collectors first

### Memory Issues
- Adjust memory limits in `railway.toml`
- Monitor usage in Railway dashboard
- Consider running collectors individually

## Production Best Practices

1. **Security**
   - Use environment variables for all secrets
   - Enable CORS for your frontend domain only
   - Regularly rotate API keys

2. **Performance**
   - Monitor Redis memory usage
   - Clean up old jobs periodically (automated)
   - Use job progress tracking for long-running tasks

3. **Reliability**
   - Railway automatically restarts on failures
   - Redis persists job data
   - Health checks ensure availability

## Updating

To update the deployed backend:

```bash
git add .
git commit -m "Update description"
git push origin main
```

Railway will automatically detect changes and redeploy. 