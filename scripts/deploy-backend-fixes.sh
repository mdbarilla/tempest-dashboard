#!/bin/bash

# Backend Redeployment Script for Permission Fixes
# Run this on the Raspberry Pi after transferring the deployment package

set -e

echo "🔧 Redeploying Backend with Permission Fixes..."
echo ""

# Step 1: Verify files are present
echo "[1/7] Verifying deployment files..."
cd ~/deployment/backend

if [ ! -f server.js ]; then
    echo "❌ Error: server.js not found in ~/deployment/backend"
    exit 1
fi

if ! grep -q "Permissions-Policy" server.js; then
    echo "⚠️  Warning: Permissions-Policy header not found in server.js"
    echo "   The deployment package may not have the latest changes"
fi

if ! grep -q "isLocalNetworkUrl" services/ai-bridge.js 2>/dev/null; then
    echo "⚠️  Warning: Conditional AI bridge logic not found"
fi

echo "✓ Files verified"
echo ""

# Step 2: Install dependencies
echo "[2/7] Installing dependencies..."
npm install --production 2>&1 | grep -v "^npm WARN" || true
echo "✓ Dependencies installed"
echo ""

# Step 3: Restart backend
echo "[3/7] Restarting backend..."
if pm2 list | grep -q "tempest-backend"; then
    pm2 restart tempest-backend
else
    pm2 start server.js --name tempest-backend
fi
pm2 save
echo "✓ Backend restarted"
echo ""

# Step 4: Verify backend is running
echo "[4/7] Verifying backend status..."
sleep 2
pm2 status

if ! pm2 list | grep -q "tempest-backend.*online"; then
    echo "⚠️  Warning: Backend may not be running. Check logs:"
    echo "   pm2 logs tempest-backend --lines 20"
fi
echo ""

# Step 5: Test Permissions-Policy header
echo "[5/7] Testing Permissions-Policy header..."
sleep 1
if curl -s -I http://localhost:3001/api/weather/current | grep -qi "permissions-policy"; then
    echo "✓ Permissions-Policy header found in API response"
    curl -s -I http://localhost:3001/api/weather/current | grep -i "permissions-policy"
else
    echo "⚠️  Warning: Permissions-Policy header not found in response"
    echo "   Check that server.js has the middleware installed"
fi
echo ""

# Step 6: Check nginx config
echo "[6/7] Checking nginx configuration..."
if sudo grep -q "Permissions-Policy" /etc/nginx/sites-available/tempest 2>/dev/null; then
    echo "✓ nginx config already has Permissions-Policy header"
else
    echo "⚠️  nginx config needs update. Run:"
    echo "   sudo nano /etc/nginx/sites-available/tempest"
    echo "   Add: add_header Permissions-Policy \"local-network-access=()\" always;"
    echo "   Then: sudo nginx -t && sudo systemctl reload nginx"
fi
echo ""

# Step 7: Summary
echo "[7/7] Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Backend redeployed with permission fixes"
echo ""
echo "Next steps:"
echo "1. Check logs: pm2 logs tempest-backend --lines 20"
echo "2. Test API: curl -I http://localhost:3001/api/weather/current"
echo "3. Update nginx config if needed (see step 6)"
echo "4. Test from external network: https://towerhill.app"
echo ""
echo "Verification:"
echo "  pm2 status                    # Check backend status"
echo "  curl -I http://localhost:3001/api/weather/current | grep -i permissions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
