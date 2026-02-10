#!/bin/bash

# Manual deployment script - uses scp/ssh with password prompt
set -e

PI_IP="192.168.1.160"
PI_USER="mbarilla"
BUILD_DIR="/Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest/build-output"
PACKAGE="tempest-v1.3.2-20260119-101051.tar.gz"

echo "╔════════════════════════════════════════════════╗"
echo "║   Tempest Manual Deployment                    ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "This will prompt for your Pi password a few times."
echo "Package: $PACKAGE"
echo ""

# Transfer package
echo "→ Transferring package to Pi..."
scp "${BUILD_DIR}/${PACKAGE}" ${PI_USER}@${PI_IP}:~/

echo ""
echo "→ Deploying on Pi..."
ssh ${PI_USER}@${PI_IP} << 'ENDSSH'
set -e

echo "  → Extracting package..."
tar -xzf tempest-v*.tar.gz

echo "  → Backing up current deployment..."
if [ -d ~/deployment ]; then
    cp -r ~/deployment ~/deployment-backup-$(date +%Y%m%d-%H%M%S)
fi

echo "  → Moving new deployment..."
rm -rf ~/deployment
mv deployment ~/deployment

echo "  → Installing dependencies..."
cd ~/deployment/backend
npm install --production 2>&1 | grep -v "^npm WARN" || true

echo "  → Checking .env file..."
if [ ! -f .env ]; then
    echo "  ⚠️  Creating .env from template..."
    cp .env.example .env
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ⚠️  IMPORTANT: You need to edit .env file"
    echo "     Add your TEMPEST_API_TOKEN and TEMPEST_STATION_ID"
    echo "     Run: nano ~/deployment/backend/.env"
    echo "     Then: pm2 restart tempest-backend"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
fi

echo "  → Restarting backend..."
pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
pm2 save

echo "  → Updating dashboard..."
sudo cp -r ../dashboard/* /var/www/html/ 2>/dev/null || echo "  ⚠️  Dashboard copy requires sudo - run manually: sudo cp -r ~/deployment/dashboard/* /var/www/html/"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Verify with:"
echo "  pm2 status"
echo "  pm2 logs tempest-backend --lines 20"
echo "  curl http://localhost:3001/api/weather/current"
ENDSSH

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║   Deployment Complete!                         ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Add credentials: ssh ${PI_USER}@${PI_IP}"
echo "  2. Edit .env: nano ~/deployment/backend/.env"
echo "  3. Add: TEMPEST_API_TOKEN and TEMPEST_STATION_ID"
echo "  4. Restart: pm2 restart tempest-backend"
echo ""
