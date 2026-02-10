# Quick Start Guide - Tempest v2.0.0

## What's New

1. **Manual Precipitation Logging** - Log snow, rain, and other precipitation with notes
2. **Persistent Condition Corrections** - Corrections now last all day across all devices
3. **Offline Detection** - See when Tempest is offline, with automatic fallback to cached data

---

## Immediate Next Steps

### Step 1: Review Changes
✅ Read `IMPLEMENTATION_SUMMARY.md` for detailed changes
✅ Review `TESTING.md` for test cases

### Step 2: Test Locally (If you have a dev environment)

```bash
# Start backend
cd backend
npm install  # In case any dependencies changed
npm start    # Or: pm2 restart tempest-backend

# Start frontend dev server
cd apps/dashboard
npm install  # In case any dependencies changed
npm start    # Opens at http://localhost:3000
```

**Test these features:**
1. Open browser to http://localhost:3000
2. Click "Log Precipitation" on Precipitation card
3. Log a snow entry with amount and notes
4. Verify it saves and displays
5. Click "Report Different" on conditions
6. Select a different condition
7. Reload page - should persist
8. Stop backend server - verify offline banner appears
9. Start backend - verify connection restores

### Step 3: Build for Production

```bash
cd apps/dashboard
npm run build

# Build folder is ready at: apps/dashboard/build/
```

### Step 4: Deploy to Raspberry Pi

```bash
# 1. Backup current system
ssh pi@[your-pi-ip]
cd ~/tempest/backend/data
cp weather.db weather.db.backup.$(date +%Y%m%d)

# 2. Copy new backend files from your Mac
# (From your Mac terminal)
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Projects/Tempest/backend
rsync -avz --exclude 'node_modules' --exclude 'data' ./ pi@[your-pi-ip]:~/tempest/backend/

# 3. Restart backend (database auto-migrates)
ssh pi@[your-pi-ip]
cd ~/tempest/backend
pm2 restart tempest-backend
pm2 logs --lines 50

# Look for: "✅ Database schema initialized"

# 4. Verify new table exists
sqlite3 ~/tempest/backend/data/weather.db "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_precipitation';"
# Should return: manual_precipitation

# 5. Deploy frontend build
# (From your Mac terminal)
cd ~/Library/Mobile\ Documents/com~apple~CloudDocs/Projects/Tempest/apps/dashboard
rsync -avz build/ pi@[your-pi-ip]:~/tempest/apps/dashboard/build/

# 6. Verify deployment
curl http://[your-pi-ip]:3001/api/weather/complete
# Should return JSON with weather data

# 7. Open in browser
open http://[your-pi-ip]:3000
```

### Step 5: Test in Production

**Test Manual Precipitation:**
1. Open dashboard
2. Find Precipitation metric card
3. Click "Log Precipitation"
4. Select "Snow"
5. Enter amount: 1.5
6. Enter notes: "Testing new feature"
7. Click Submit
8. Verify it displays correctly

**Test Condition Correction:**
1. Click "Report Different" on current conditions
2. Select a different condition
3. Click Submit
4. Refresh page (Cmd+R)
5. Verify correction persists

**Test Offline Detection:**
1. Disconnect Tempest from WiFi (or unplug temporarily)
2. Wait 60 seconds for refresh cycle
3. Red banner should appear: "Tempest station offline"
4. Data should still display (cached)
5. Reconnect Tempest
6. Wait 1-2 minutes
7. Banner should disappear

### Step 6: Monitor for 24 Hours

```bash
# Check backend logs
ssh pi@[your-pi-ip]
pm2 logs tempest-backend --lines 100

# Watch for errors
pm2 logs tempest-backend --err

# Check database growth
ls -lh ~/tempest/backend/data/weather.db
```

---

## Quick Reference - New Features

### Manual Precipitation

**Where:** Precipitation metric card
**Button:** "Log Precipitation" (or "Manual Entry" if already logged)
**Types:** Snow, Rain, Sleet, Freezing Rain, Hail, Mixed
**Saved:** Backend database + syncs to all devices

### Condition Corrections

**Where:** Current weather conditions
**Button:** "Report Different" (or "Corrected" if already corrected)
**Persists:** All day until midnight
**Syncs:** Across all devices automatically

### Offline Detection

**Where:** Top banner (only appears when offline/stale)
**States:**
- Red banner: Tempest offline - showing cached data
- Yellow banner: Data may be stale - last updated [time]
**Cache:** Keeps last 10 minutes of data in browser

---

## Troubleshooting Quick Fixes

### Manual Precipitation Not Saving
```bash
# Check database permissions
ssh pi@[your-pi-ip]
ls -la ~/tempest/backend/data/weather.db
# Should be: -rw-r--r--

# Check logs
pm2 logs tempest-backend --lines 50
```

### Offline Banner Stuck
```bash
# Check Tempest WiFi connection
# Check backend is running:
pm2 status

# Restart backend:
pm2 restart tempest-backend

# Test API:
curl http://localhost:3001/api/weather/current
```

### Condition Corrections Not Persisting
```bash
# Check database for corrections
sqlite3 ~/tempest/backend/data/weather.db "SELECT * FROM condition_corrections ORDER BY created_at DESC LIMIT 5;"

# Should see your corrections with today's date
```

### Cached Data Not Loading
- Open browser DevTools (F12)
- Go to Application → Local Storage
- Find your domain
- Check for `weatherData` and `weatherDataTimestamp`
- If missing, data will load fresh on next fetch
- If corrupt, clear: `localStorage.clear()` in console

---

## File Locations Reference

### Backend:
- **Database:** `~/tempest/backend/data/weather.db`
- **Server:** `~/tempest/backend/server.js`
- **API Routes:** `~/tempest/backend/api/weather.js`
- **Database Service:** `~/tempest/backend/services/database.js`

### Frontend:
- **Built Files:** `~/tempest/apps/dashboard/build/`
- **Main App:** `~/tempest/apps/dashboard/src/App.js`
- **Metrics:** `~/tempest/apps/dashboard/src/components/Metrics.js`
- **New Logger:** `~/tempest/apps/dashboard/src/components/PrecipitationLogger.js`

### Documentation:
- **This Guide:** `QUICK_START.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **Test Plan:** `TESTING.md`

---

## API Quick Reference

### Manual Precipitation

**Create:**
```bash
curl -X POST http://localhost:3001/api/weather/precipitation/manual \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": '$(date +%s)',
    "amountInches": 1.5,
    "precipType": "snow",
    "notes": "Testing API"
  }'
```

**Get:**
```bash
curl http://localhost:3001/api/weather/precipitation/manual?limit=10
```

**Delete:**
```bash
curl -X DELETE http://localhost:3001/api/weather/precipitation/manual/1
```

### Condition Corrections

**Get All:**
```bash
curl http://localhost:3001/api/weather/corrections?limit=10
```

---

## Success Checklist

After deployment, verify:

- [ ] Backend running: `pm2 status`
- [ ] Database has new table: `manual_precipitation`
- [ ] Frontend loads without errors
- [ ] Manual precipitation logging works
- [ ] Condition corrections persist across reload
- [ ] Offline banner appears when Tempest disconnected
- [ ] Cached data loads when offline
- [ ] Connection restores automatically
- [ ] No console errors (F12 → Console)
- [ ] Works on mobile devices
- [ ] Works on different browsers

---

## Support

**Issues?**
1. Check `pm2 logs tempest-backend`
2. Check browser console (F12)
3. Review `TESTING.md` troubleshooting section
4. Check `IMPLEMENTATION_SUMMARY.md` for architecture details

**Database Issues?**
```bash
# Interactive database inspection
sqlite3 ~/tempest/backend/data/weather.db

# Commands:
.tables                          # List all tables
.schema manual_precipitation     # Show table schema
SELECT * FROM manual_precipitation ORDER BY created_at DESC LIMIT 5;
.quit                           # Exit
```

---

## Summary

**Implementation Status:** ✅ Complete
**Deployment Status:** ⏳ Pending your deployment
**Testing Status:** ⏳ Pending your testing

**What You Need to Do:**
1. ✅ Read this guide (you're doing it!)
2. ⏳ Deploy to your Raspberry Pi (Step 4 above)
3. ⏳ Test features (Step 5 above)
4. ⏳ Monitor for 24 hours (Step 6 above)
5. ⏳ Report any issues

**Estimated Time:**
- Deployment: 15 minutes
- Testing: 30 minutes
- Monitoring: Ongoing

---

**Ready to deploy!** 🚀

Start with Step 4 above when you're ready.
