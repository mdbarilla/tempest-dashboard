# Tempest v1.3.5 Manual Deployment Guide

**Build Date**: 2026-01-22 00:18:12
**Package**: tempest-v1.3.5-20260122-001812.tar.gz
**Status**: Package transferred to Raspberry Pi

## Current Issue
The backend is crash-looping due to missing sqlite3 native bindings for ARM64 architecture. The sqlite3 module needs to be rebuilt on the Pi.

## SSH into Raspberry Pi

```bash
ssh mbarilla@192.168.1.160
```

## Step 1: Stop Current Backend (if running)

```bash
pm2 stop tempest-backend
pm2 delete tempest-backend
```

## Step 2: Backup Existing Deployment

```bash
if [ -d ~/deployment ]; then
    cp -r ~/deployment ~/deployment-backup-$(date +%Y%m%d-%H%M%S)
    echo "✓ Backup created"
fi
```

## Step 3: Extract New Package

```bash
cd ~
tar -xzf tempest-v1.3.5-20260122-001812.tar.gz
echo "✓ Package extracted"
```

## Step 4: Install Dependencies

```bash
cd ~/deployment/backend
npm install --production
```

## Step 5: Rebuild sqlite3 for ARM64 (Critical Step)

This is the most important step - rebuild sqlite3 native bindings for Raspberry Pi's ARM64 architecture:

```bash
npm rebuild sqlite3 --build-from-source
```

**Note**: This will take 5-10 minutes on the Raspberry Pi as it compiles sqlite3 from source. Wait for it to complete.

You should see output like:
```
> sqlite3@5.1.6 install
> node-gyp rebuild
...
[compilation output]
...
rebuilt '/home/mbarilla/deployment/backend/node_modules/sqlite3'
```

## Step 6: Verify sqlite3 Bindings

```bash
# Test that sqlite3 loads correctly
node -e "const sqlite3 = require('sqlite3'); console.log('✓ sqlite3 loaded successfully');"
```

If this prints "✓ sqlite3 loaded successfully", you're good to go!

## Step 7: Configure Environment Variables

```bash
# Check if .env exists
if [ ! -f .env ]; then
    cp .env.example .env
    nano .env
fi
```

Make sure your .env contains:
```
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=204768
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
```

## Step 8: Start Backend

```bash
pm2 start server.js --name tempest-backend
pm2 save
```

## Step 9: Update Dashboard (Frontend)

```bash
sudo cp -r ~/deployment/dashboard/* /var/www/html/
```

## Step 10: Verify Deployment

Check backend status:
```bash
pm2 status
```

Should show:
```
│ tempest-backend │ online │ 1.3.5 │
```

Check logs (should show NO errors):
```bash
pm2 logs tempest-backend --lines 30
```

Test API:
```bash
curl http://localhost:3001/api/weather/current
```

Should return JSON weather data.

Test dashboard:
```bash
curl http://localhost/
```

Should return HTML.

## Step 11: Monitor for Stability

Watch logs for any crashes:
```bash
pm2 logs tempest-backend
```

Leave this running for a minute to ensure no crash loops. Press `Ctrl+C` to exit.

## Troubleshooting

### If sqlite3 rebuild fails:

```bash
# Install build dependencies
sudo apt-get update
sudo apt-get install -y build-essential python3

# Clean and rebuild
cd ~/deployment/backend
rm -rf node_modules
npm install --production
npm rebuild sqlite3 --build-from-source
```

### If backend still crashes:

```bash
# Check detailed error
pm2 logs tempest-backend --err --lines 50

# Try running directly to see errors
cd ~/deployment/backend
node server.js
```

Press `Ctrl+C` to stop, then restart with pm2.

### If API returns no data:

```bash
# Verify .env credentials
cat ~/deployment/backend/.env

# Check database
ls -lh ~/deployment/backend/data/weather.db

# Restart backend
pm2 restart tempest-backend
```

## Quick Status Check Commands

```bash
# Backend status
pm2 status

# Recent logs
pm2 logs tempest-backend --lines 20 --nostream

# Disk space
df -h

# Memory usage
free -h

# Process restarts (should be 0)
pm2 describe tempest-backend | grep restarts
```

## Success Indicators

✓ `pm2 status` shows "online" with 0 restarts
✓ `pm2 logs` shows no errors
✓ API returns weather data
✓ Dashboard loads in browser at http://192.168.1.160
✓ Weather data updates on dashboard

## Rollback (if needed)

If something goes wrong:

```bash
pm2 stop tempest-backend
rm -rf ~/deployment
cp -r ~/deployment-backup-[timestamp] ~/deployment
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
```

## Post-Deployment

Once everything is working:

```bash
# Save pm2 configuration
pm2 save

# Enable pm2 startup on boot (if not already done)
pm2 startup
# Follow the command it gives you
```

---

## Summary

The key issue was that sqlite3 native bindings were missing for ARM64. The critical step is **Step 5** where you rebuild sqlite3 from source on the Raspberry Pi.

After deployment, the backend should run stably without crash loops.
