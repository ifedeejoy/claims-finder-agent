#!/bin/bash

echo "🔍 Verifying Deployment Setup..."
echo ""

# Check if railway.json exists at root
if [ -f "railway.json" ]; then
    echo "✅ railway.json found at root"
else
    echo "❌ railway.json missing at root - Railway will build wrong directory"
fi

# Check if .vercelignore exists
if [ -f ".vercelignore" ]; then
    echo "✅ .vercelignore found"
    if grep -q "backend/" ".vercelignore"; then
        echo "  ✅ Backend directory excluded from Vercel"
    else
        echo "  ❌ Backend directory not excluded from Vercel"
    fi
else
    echo "❌ .vercelignore missing - Vercel will deploy backend too"
fi

# Check backend configuration files
echo ""
echo "📦 Checking backend configuration..."

if [ -f "backend/railway.toml" ]; then
    echo "✅ backend/railway.toml found"
else
    echo "❌ backend/railway.toml missing"
fi

if [ -f "backend/nixpacks.toml" ]; then
    echo "✅ backend/nixpacks.toml found"
else
    echo "❌ backend/nixpacks.toml missing"
fi

if [ -f "backend/package.json" ]; then
    echo "✅ backend/package.json found"
    # Check for build script
    if grep -q '"build":' "backend/package.json"; then
        echo "  ✅ Build script found"
    else
        echo "  ❌ Build script missing"
    fi
else
    echo "❌ backend/package.json missing"
fi

# Check GitHub Actions workflow
echo ""
echo "🚀 Checking deployment workflow..."

if [ -f ".github/workflows/deploy.yml" ]; then
    echo "✅ .github/workflows/deploy.yml found"
    # Check for separate deployment jobs
    if grep -q "deploy-frontend:" ".github/workflows/deploy.yml" && grep -q "deploy-backend:" ".github/workflows/deploy.yml"; then
        echo "  ✅ Separate deployment jobs configured"
    else
        echo "  ❌ Missing separate deployment jobs"
    fi
else
    echo "❌ .github/workflows/deploy.yml missing"
fi

echo ""
echo "📝 Summary:"
echo "-----------"
echo "This setup will deploy:"
echo "- Frontend (Next.js) → Vercel"
echo "- Backend (Node.js) → Railway"
echo ""
echo "Next steps:"
echo "1. Set up environment variables in Vercel and Railway"
echo "2. Add GitHub secrets for deployment"
echo "3. Push to main branch to trigger deployment" 