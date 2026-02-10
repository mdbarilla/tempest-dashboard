#!/bin/bash

# Tempest Weather Dashboard - Build for Deployment
# This script prepares the application for Raspberry Pi deployment

set -e

echo "🔨 Building Tempest Weather Dashboard for Production..."
echo ""

# Check if we're in the project root
if [ ! -d "apps/dashboard" ] || [ ! -d "backend" ]; then
    echo "❌ Error: This script must be run from the project root directory"
    exit 1
fi

# Clean previous deployment
echo "📦 Cleaning previous deployment..."
rm -rf deployment
rm -f tempest-deploy.tar.gz

# Create deployment structure
echo "📁 Creating deployment directory structure..."
mkdir -p deployment/backend
mkdir -p deployment/data
mkdir -p deployment/logs

# Build React dashboard
echo "⚛️  Building React dashboard..."
cd apps/dashboard
npm run build
cd ../..

# Copy dashboard build
echo "📋 Copying dashboard build..."
cp -r apps/dashboard/build deployment/dashboard

# Copy backend files
echo "🔧 Copying backend files..."
cp -r backend/* deployment/backend/

# Copy environment template
echo "📝 Creating environment template..."
cat > deployment/backend/.env.example << 'EOF'
PORT=3001
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=204768
NODE_ENV=production
DATABASE_PATH=../data/tempest.db
EOF

# Create README for deployment
cat > deployment/README.md << 'EOF'
# Tempest Weather Dashboard - Deployment Package

This directory contains everything needed to deploy the Tempest Weather Dashboard.

## Quick Start

1. Copy this entire directory to your Raspberry Pi
2. Copy `.env.example` to `.env` and configure your API credentials
3. Install dependencies: `cd backend && npm install --production`
4. Follow the deployment guide in DEPLOYMENT.md

## Directory Structure

- `dashboard/` - Built React application (served by nginx)
- `backend/` - Node.js API server
- `data/` - Database storage
- `logs/` - Application logs

EOF

# Create deployment archive
echo "📦 Creating deployment archive..."
tar -czf tempest-deploy.tar.gz deployment/

# Get file size
SIZE=$(du -h tempest-deploy.tar.gz | cut -f1)

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Deployment package: tempest-deploy.tar.gz ($SIZE)"
echo ""
echo "Next steps:"
echo "1. Transfer to Pi: scp tempest-deploy.tar.gz pi@tempest-weather.local:~/"
echo "2. Follow DEPLOYMENT.md for complete setup instructions"
echo ""
