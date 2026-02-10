#!/bin/bash

# Tempest Weather Dashboard - Deployment Script
# Version: 1.2.0
# This script deploys the dashboard to your Raspberry Pi

set -e  # Exit on error

# Configuration
PI_IP="192.168.1.160"
PI_USER="mbarilla"
DEPLOY_PACKAGE="tempest-v1.2.0-deploy.tar.gz"
REMOTE_HOME="/home/mbarilla"
DEPLOYMENT_DIR="$REMOTE_HOME/deployment"

echo "🌤️  Tempest Weather Dashboard - Deployment Script"
echo "=================================================="
echo ""
echo "Deploying version 1.2.0 to $PI_USER@$PI_IP"
echo ""

# Check if deployment package exists
if [ ! -f "$DEPLOY_PACKAGE" ]; then
    echo "❌ Error: Deployment package not found: $DEPLOY_PACKAGE"
    echo "Please run the build process first."
    exit 1
fi

# Step 1: Transfer deployment package
echo "📦 Step 1/5: Transferring deployment package..."
scp "$DEPLOY_PACKAGE" "$PI_USER@$PI_IP:$REMOTE_HOME/" || {
    echo "❌ Failed to transfer package. Please check:"
    echo "   - Pi is powered on and connected to network"
    echo "   - IP address is correct: $PI_IP"
    echo "   - You have the correct password"
    exit 1
}

echo "✅ Package transferred successfully"
echo ""

# Step 2: Extract and prepare files
echo "📂 Step 2/5: Extracting files on Pi..."
ssh "$PI_USER@$PI_IP" << 'ENDSSH'
cd ~
tar -xzf tempest-v1.1.0-deploy.tar.gz
echo "✅ Files extracted"
ENDSSH

# Step 3: Backup current deployment (if exists)
echo "💾 Step 3/5: Backing up current deployment..."
ssh "$PI_USER@$PI_IP" << 'ENDSSH'
if [ -d ~/deployment/dashboard ]; then
    BACKUP_DIR="deployment-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p ~/$BACKUP_DIR
    cp -r ~/deployment/dashboard ~/$BACKUP_DIR/ 2>/dev/null || true
    echo "✅ Backup created: ~/$BACKUP_DIR"
else
    echo "ℹ️  No previous deployment found, skipping backup"
fi
ENDSSH

# Step 4: Deploy new version
echo "🚀 Step 4/5: Deploying new version..."
ssh "$PI_USER@$PI_IP" << 'ENDSSH'
# Create deployment directory if it doesn't exist
mkdir -p ~/deployment/dashboard

# Clear old dashboard files
rm -rf ~/deployment/dashboard/*

# Copy new dashboard files
if [ -d ~/apps/dashboard/build ]; then
    cp -r ~/apps/dashboard/build/* ~/deployment/dashboard/
    echo "✅ Dashboard files deployed"
else
    echo "❌ Error: Build directory not found"
    exit 1
fi

# Copy backend files if they exist
if [ -d ~/backend ]; then
    cp -r ~/backend ~/deployment/ 2>/dev/null || true
    echo "✅ Backend files updated"
fi

# Set proper permissions
chmod -R 755 ~/deployment/dashboard
echo "✅ Permissions set"
ENDSSH

# Step 5: Restart services
echo "🔄 Step 5/5: Restarting services..."
ssh "$PI_USER@$PI_IP" << 'ENDSSH'
# Reload nginx
if command -v nginx &> /dev/null; then
    sudo systemctl reload nginx 2>/dev/null && echo "✅ Nginx reloaded" || echo "⚠️  Nginx reload failed (may need manual restart)"
else
    echo "ℹ️  Nginx not found, skipping"
fi

# Restart backend with PM2
if command -v pm2 &> /dev/null; then
    cd ~/deployment/backend
    pm2 restart tempest-backend 2>/dev/null && echo "✅ Backend restarted" || echo "⚠️  Backend restart failed (may not be running)"
else
    echo "ℹ️  PM2 not found, skipping backend restart"
fi
ENDSSH

# Cleanup
echo ""
echo "🧹 Cleaning up..."
ssh "$PI_USER@$PI_IP" << 'ENDSSH'
rm -f ~/tempest-v1.1.0-deploy.tar.gz
rm -rf ~/apps ~/backend
ENDSSH

echo ""
echo "✨ Deployment Complete!"
echo "=================================================="
echo ""
echo "📍 Your dashboard should now be running at:"
echo "   http://$PI_IP"
echo ""
echo "📊 To check logs:"
echo "   ssh $PI_USER@$PI_IP"
echo "   pm2 logs tempest-backend"
echo ""
echo "Version 1.1.0 deployed successfully! 🎉"
