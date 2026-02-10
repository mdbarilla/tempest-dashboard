# Tempest v1.3.2 Deployment Guide

**Release Date**: January 19, 2026  
**Package**: `tempest-v1.3.2-deploy.tar.gz` (753 KB)

## What's New in v1.3.2

### Critical Fixes
- ✅ Precipitation menu now fully functional (previously unusable)
- ✅ Menu buttons clickable without being cut off by card boundaries
- ✅ Hover animations no longer cause layout shifting
- ✅ Mobile-optimized experience (no hover effects on touch devices)

### Technical Improvements
- Portal-based menu rendering for proper z-index stacking
- Fixed event propagation issues
- Smooth animations without layout reflow

## Deployment Instructions for Raspberry Pi

### 1. Transfer Package
```bash
scp tempest-v1.3.2-deploy.tar.gz pi@raspberrypi:~/
```

### 2. On the Raspberry Pi
```bash
# Extract
cd ~
tar -xzf tempest-v1.3.2-deploy.tar.gz

# Install backend dependencies
cd backend
npm install --production

# Install dashboard (if serving locally)
cd ../apps/dashboard
npm install --production

# Restart services
sudo systemctl restart tempest-backend
sudo systemctl restart tempest-dashboard
```

### 3. Verify Deployment
```bash
# Check backend
curl http://localhost:3001/api/weather/current

# Check frontend (if applicable)
curl http://localhost:3000
```

## What Works Now

### Precipitation Logger
1. Click three-dot menu button in Precipitation card
2. Select "Add Entry" - modal opens properly
3. Enter precipitation data (type, amount, notes)
4. Save - data persists to backend database
5. View history - shows all entries for today

### Metrics Cards
- Hover animation slides content up smoothly (desktop only)
- No layout shift or content jumping
- Mobile users see static cards (better for touch)

## Files Included

- `backend/` - Complete backend server with database
- `apps/dashboard/build/` - Production-ready React build
- `deployment/` - Nginx configs and systemd services
- `raspberry-pi/` - Pi-specific setup scripts

## Notes for Tomorrow

- Backend server must be running on port 3001
- Frontend expects backend at `/api/weather/*`
- Database file: `backend/data/weather.db`
- Logs: Check systemd journal for errors

## Rollback Plan

If issues occur:
```bash
# Stop services
sudo systemctl stop tempest-backend tempest-dashboard

# Restore previous version
tar -xzf tempest-v1.3.1-deploy.tar.gz

# Restart
sudo systemctl start tempest-backend tempest-dashboard
```

