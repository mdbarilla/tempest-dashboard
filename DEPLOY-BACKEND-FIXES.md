# Backend Redeployment Instructions

## Quick Deployment

If you have SSH access to the Pi, run this single command:

```bash
# Transfer and run the deployment script
scp scripts/deploy-backend-fixes.sh mbarilla@towerhill.local:~/
ssh mbarilla@towerhill.local "bash ~/deploy-backend-fixes.sh"
```

## Manual Deployment Steps

If you prefer to run commands manually on the Pi:

### 1. Verify Files Are Updated

```bash
ssh mbarilla@towerhill.local
cd ~/deployment/backend

# Check Permissions-Policy header exists
grep -A 3 "Permissions-Policy" server.js

# Check AI bridge conditional logic exists
grep -A 5 "isLocalNetworkUrl" services/ai-bridge.js
```

### 2. Install Dependencies

```bash
cd ~/deployment/backend
npm install --production
```

### 3. Restart Backend

```bash
pm2 restart tempest-backend
# Or if not running:
pm2 start server.js --name tempest-backend
pm2 save
```

### 4. Verify Backend is Running

```bash
pm2 status
pm2 logs tempest-backend --lines 20
```

### 5. Test Permissions-Policy Header

```bash
curl -I http://localhost:3001/api/weather/current | grep -i permissions-policy
```

Should show:
```
Permissions-Policy: local-network-access=()
```

### 6. Update nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/tempest
```

Add this line after `server_name _;`:
```nginx
add_header Permissions-Policy "local-network-access=()" always;
```

Then test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Final Verification

```bash
# Test API header
curl -I http://localhost:3001/api/weather/current | grep -i permissions

# Check backend logs
pm2 logs tempest-backend --lines 10
```

## Troubleshooting

If backend won't start:
```bash
# Check for errors
pm2 logs tempest-backend --err --lines 50

# Try running directly to see errors
cd ~/deployment/backend
node server.js
```

If Permissions-Policy header is missing:
```bash
# Verify middleware is in server.js
grep -A 5 "Permissions-Policy" ~/deployment/backend/server.js

# Restart backend again
pm2 restart tempest-backend
```

## Expected Results

After deployment:
- ✅ Backend shows "online" in `pm2 status`
- ✅ Permissions-Policy header appears in API responses
- ✅ No errors in `pm2 logs tempest-backend`
- ✅ External access (towerhill.app) no longer shows permission prompt
