# Fix Raspberry Pi Deployment - Step by Step

**From your Mac terminal**, follow these steps to fix the Pi deployment and reset the Chrome viewport.

## Part 1: Fix Chrome Viewport (Cropped Display)

The display is cropped on the left because Chrome needs to be reset. Run these commands from your Mac:

```bash
# Reset Chrome viewport and clear cache - run from Mac
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && xdotool search --name 'Chromium' windowactivate && xdotool key F11 && sleep 1 && xdotool key F11"

# Alternative: Force Chrome to reload in fullscreen with correct dimensions
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && killall chromium-browser; sleep 2 && chromium-browser --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-features=TranslateUI http://localhost:3000"

# If the above doesn't work, try a hard reset of X11:
ssh mbarilla@192.168.1.160 "sudo systemctl restart lightdm"
```

**Note**: The last command (restart lightdm) will restart the display manager and may take 10-15 seconds. The display will go black briefly then come back.

---

## Part 2: Diagnose Current State

Let's check what's actually running on the Pi:

```bash
# 1. Check if backend is running
ssh mbarilla@192.168.1.160 "pm2 status"

# 2. Check backend logs for errors
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend --lines 50 --nostream"

# 3. Check if database tables exist
ssh mbarilla@192.168.1.160 "cd ~/tempest/backend && sqlite3 data/weather.db '.tables'"

# 4. Test the API directly
ssh mbarilla@192.168.1.160 "curl -s http://localhost:3001/api/weather/complete | head -c 200"

# 5. Check which files are in the frontend build directory
ssh mbarilla@192.168.1.160 "ls -lah ~/tempest/apps/dashboard/build/ | head -20"
```

Copy and paste each command above into your Mac terminal and **share the output with me** so I can diagnose the specific issue.

---

## Part 3: Deploy Fixed Version from Mac

Once we understand the issue, run these commands to deploy the working local build:

### Step 3.1: Backup current Pi deployment

```bash
# Create backup of Pi's current backend database
ssh mbarilla@192.168.1.160 "cd ~/tempest/backend/data && cp weather.db weather.db.backup.$(date +%Y%m%d-%H%M%S)"

# Verify backup was created
ssh mbarilla@192.168.1.160 "ls -lh ~/tempest/backend/data/weather.db*"
```

### Step 3.2: Deploy backend files

```bash
# Navigate to your local backend directory on Mac
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Projects/Tempest/backend

# Copy backend files to Pi (excludes node_modules and data)
rsync -avz --progress --exclude 'node_modules' --exclude 'data' ./ mbarilla@192.168.1.160:~/tempest/backend/

# Verify files were copied
ssh mbarilla@192.168.1.160 "ls -lah ~/tempest/backend/ | head -20"
```

### Step 3.3: Restart backend and check database migration

```bash
# Restart the backend server (this will auto-migrate the database)
ssh mbarilla@192.168.1.160 "cd ~/tempest/backend && pm2 restart tempest-backend"

# Wait 5 seconds for startup
sleep 5

# Check logs to verify startup and migration
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend --lines 30 --nostream"

# Verify new database tables were created
ssh mbarilla@192.168.1.160 "cd ~/tempest/backend && sqlite3 data/weather.db \"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;\""

# You should see: condition_corrections, manual_precipitation, weather_data
```

### Step 3.4: Deploy frontend build

```bash
# Navigate to your local dashboard directory on Mac
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Projects/Tempest/apps/dashboard

# Copy the built files to Pi
rsync -avz --progress --delete build/ mbarilla@192.168.1.160:~/tempest/apps/dashboard/build/

# Verify files were copied
ssh mbarilla@192.168.1.160 "ls -lah ~/tempest/apps/dashboard/build/"
```

### Step 3.5: Clear browser cache and reload

```bash
# Clear Chrome cache and force reload
ssh mbarilla@192.168.1.160 "rm -rf ~/.cache/chromium && export DISPLAY=:0 && xdotool search --name 'Chromium' windowactivate && xdotool key ctrl+shift+r"

# Alternative: Restart Chrome completely
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && killall chromium-browser && sleep 2 && chromium-browser --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-features=TranslateUI http://localhost:3000"
```

---

## Part 4: Verify Deployment

```bash
# 1. Test backend API
ssh mbarilla@192.168.1.160 "curl -s http://localhost:3001/api/weather/complete | python3 -c \"import sys, json; d=json.load(sys.stdin); print('✓ API OK') if d.get('success') else print('✗ API Error')\""

# 2. Check backend is running
ssh mbarilla@192.168.1.160 "pm2 status"

# 3. Check recent backend logs
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend --lines 20 --nostream"

# 4. Test manual precipitation endpoint
ssh mbarilla@192.168.1.160 "curl -s http://localhost:3001/api/weather/precipitation/manual?limit=5"

# 5. Test condition corrections endpoint
ssh mbarilla@192.168.1.160 "curl -s http://localhost:3001/api/weather/corrections?limit=5"
```

---

## Part 5: If Deployment Still Has Issues

### Option A: Check if it's a network issue

```bash
# From Mac, try accessing the Pi's dashboard directly
open http://192.168.1.160:3000

# Or test with curl from Mac
curl -I http://192.168.1.160:3000
```

### Option B: Check file permissions

```bash
# Ensure correct permissions on backend
ssh mbarilla@192.168.1.160 "chmod -R 755 ~/tempest/backend && chmod 644 ~/tempest/backend/data/weather.db"

# Restart backend
ssh mbarilla@192.168.1.160 "pm2 restart tempest-backend"
```

### Option C: Full backend reinstall

```bash
# Stop backend
ssh mbarilla@192.168.1.160 "pm2 stop tempest-backend"

# Reinstall dependencies on Pi
ssh mbarilla@192.168.1.160 "cd ~/tempest/backend && rm -rf node_modules && npm install --production"

# Start backend
ssh mbarilla@192.168.1.160 "pm2 start tempest-backend"

# Check logs
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend --lines 30 --nostream"
```

---

## Quick Diagnostics (All-in-One Command)

Run this single command to get a full system report:

```bash
ssh mbarilla@192.168.1.160 'echo "=== PM2 Status ===" && pm2 list && echo "" && echo "=== Backend Logs ===" && pm2 logs tempest-backend --lines 15 --nostream && echo "" && echo "=== Database Tables ===" && cd ~/tempest/backend && sqlite3 data/weather.db ".tables" && echo "" && echo "=== API Test ===" && curl -s http://localhost:3001/api/weather/current | head -c 300 && echo "" && echo "=== Disk Space ===" && df -h | grep -E "Filesystem|/dev/root" && echo "" && echo "=== Memory ===" && free -h'
```

---

## Chrome Viewport Commands Reference

```bash
# Toggle fullscreen (F11 twice to reset)
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && xdotool search --name 'Chromium' windowactivate && xdotool key F11 && sleep 1 && xdotool key F11"

# Hard refresh (Ctrl+Shift+R)
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && xdotool search --name 'Chromium' windowactivate && xdotool key ctrl+shift+r"

# Move window to 0,0 position (fix offset issue)
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && xdotool search --name 'Chromium' windowmove 0 0"

# Resize window to full screen
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && xdotool search --name 'Chromium' windowsize --sync 1920 1080"

# Kill and restart Chrome in kiosk mode
ssh mbarilla@192.168.1.160 "export DISPLAY=:0 && killall chromium-browser && sleep 2 && chromium-browser --kiosk --window-position=0,0 --window-size=1920,1080 --disable-infobars --noerrdialogs http://localhost:3000 &"

# Nuclear option: Restart display manager (screen will go black briefly)
ssh mbarilla@192.168.1.160 "sudo systemctl restart lightdm"
```

---

## Expected Success Output

After deployment, you should see:

1. **PM2 Status**: `tempest-backend` shows `online` status
2. **Database Tables**: Should list `condition_corrections`, `manual_precipitation`, `weather_data`
3. **API Test**: Should return JSON starting with `{"success":true...`
4. **Dashboard**: Should show all features including:
   - Manual precipitation logging button (three dots on precipitation card)
   - Condition correction (three dots near weather icon)
   - "CORRECTED" badge if you change conditions
   - Precipitation notes displayed

---

## Troubleshooting Common Issues

### Issue: "pm2: command not found"
```bash
# Install pm2 globally on Pi
ssh mbarilla@192.168.1.160 "npm install -g pm2"
```

### Issue: "xdotool: command not found"
```bash
# Install xdotool on Pi
ssh mbarilla@192.168.1.160 "sudo apt-get update && sudo apt-get install -y xdotool"
```

### Issue: Backend starts but crashes immediately
```bash
# Check detailed error logs
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend --err --lines 50"
```

### Issue: Database locked error
```bash
# Kill any processes holding the database
ssh mbarilla@192.168.1.160 "fuser -k ~/tempest/backend/data/weather.db; pm2 restart tempest-backend"
```

---

## Need Help?

Run the "Quick Diagnostics" command above and share the output so I can help troubleshoot specific issues.
