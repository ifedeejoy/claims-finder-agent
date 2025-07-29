#!/bin/bash

echo "Setting up backend collectors..."

# Create necessary directories
mkdir -p src/collectors
mkdir -p src/lib/ai
mkdir -p src/lib/supabase
mkdir -p src/types
mkdir -p logs

# Copy collector files
cp -r ../lib/collectors/* src/collectors/
cp -r ../lib/ai/* src/lib/ai/
cp -r ../lib/supabase/* src/lib/supabase/
cp -r ../types/* src/types/

# Copy environment file
cp ../.env.local .env

echo "✅ Files copied successfully"

# Install dependencies
echo "Installing dependencies..."
npm install

echo "✅ Backend setup complete!"
echo ""
echo "To start the backend:"
echo "  npm run dev     # Development mode"
echo "  npm run build   # Build for production"
echo "  npm start       # Start production server" 