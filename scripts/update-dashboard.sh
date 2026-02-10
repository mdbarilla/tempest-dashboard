#!/bin/bash

# Tempest Weather Dashboard - Update Script
# Rebuilds the dashboard and deploys it to your Pi

set -e

PI_HOST="${1:-tempest-weather.local}"

echo "🔄 Updating Tempest Weather Dashboard on $PI_HOST"
echo ""

# Build dashboard
echo "⚛️  Building dashboard..."
cd apps/dashboard
npm run build
cd ../..

# Create update package
echo "📦 Creating update package..."
tar -czf dashboard-update.tar.gz apps/dashboard/build/

# Transfer to Pi
echo "📤 Transferring to Pi..."
scp dashboard-update.tar.gz pi@$PI_HOST:~/

# Deploy on Pi
echo "🚀 Deploying on Pi..."
ssh pi@$PI_HOST << 'ENDSSH'
  cd ~
  tar -xzf dashboard-update.tar.gz
  rm -rf deployment/dashboard/*
  cp -r apps/dashboard/build/* deployment/dashboard/
  rm -rf apps
  sudo systemctl reload nginx
  echo "✅ Dashboard updated!"
ENDSSH

# Clean up
rm dashboard-update.tar.gz

echo ""
echo "✅ Update complete!"
echo "Visit http://$PI_HOST to see the changes"
echo ""
