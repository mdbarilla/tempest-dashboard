# Tempest v1.4.3 Deployment Guide

**Release Date**: January 27, 2026  
**Version**: 1.4.3

## What's New

### Local News Headlines Carousel
- Hyper-local news from Wayland Post and Weston Observer
- Intelligent prioritization: weather/environment/public safety → events/community → politics/taxes
- Filters out obituaries, newsletters, and print editions
- **Opt-in News**: News is disabled by default everywhere. Enable with `?news=1` URL parameter on any version (towerhill.app or towerhill.local).

### Enhanced Features
- Full headline display (no truncation)
- 1x1 thumbnails positioned to the right of headlines
- Bottom-aligned timestamps across all cards
- Subtle background color shifts on hover (60% → 100% opacity)
- Enhanced image extraction from multiple sources

## Deployment Instructions

### 1. Build and Package

From your Mac:

```bash
cd /path/to/Tempest
./scripts/auto-build-and-deploy.sh network
```

Or build-only:

```bash
./scripts/auto-build-and-deploy.sh build-only
```

### 2. Transfer to Pi (if using build-only)

```bash
scp deployment/tempest-v1.4.3-*.tar.gz mbarilla@towerhill.local:~/
```

### 3. On Raspberry Pi

```bash
# Backup current deployment
cp -r ~/deployment ~/deployment.backup.$(date +%Y%m%d-%H%M%S)

# Extract new version
cd ~
tar -xzf tempest-v1.4.3-*.tar.gz

# Install backend dependencies (including new news dependencies)
cd ~/deployment/backend
npm install --production

# Restart backend
pm2 restart tempest-backend

# Verify backend is running
pm2 status
pm2 logs tempest-backend --lines 20
```

### 4. Verify Deployment

1. **Check backend health**:
   ```bash
   curl http://localhost:3001/api/weather/complete
   ```

2. **Test news endpoint** (should return articles):
   ```bash
   curl http://localhost:3001/api/weather/news
   ```

3. **Hard refresh browser** (Cmd+Shift+R or Ctrl+Shift+R) to load new dashboard

4. **Verify news carousel**:
   - News is disabled by default. Visit `https://towerhill.app/?news=1` or `http://towerhill.local/?news=1` to enable

## New Dependencies

The news feature requires two new backend dependencies:
- `rss-parser@^3.13.0`
- `cheerio@^1.0.0-rc.12`

These are automatically installed with `npm install --production`. If the backend fails to start, manually install:

```bash
cd ~/deployment/backend
npm install rss-parser cheerio --save
pm2 restart tempest-backend
```

## Troubleshooting

### News carousel not appearing

1. **Check backend logs**:
   ```bash
   pm2 logs tempest-backend --lines 50
   ```

2. **Verify dependencies**:
   ```bash
   cd ~/deployment/backend
   npm list rss-parser cheerio
   ```

3. **Test news endpoint directly**:
   ```bash
   curl http://localhost:3001/api/weather/news?refresh=1
   ```

4. **Check URL parameter**:
   - News requires `?news=1` URL parameter to enable (disabled by default everywhere)
   - Verify the URL includes `?news=1` (e.g., `https://towerhill.app/?news=1`)

### Backend fails to start

If backend crashes on startup:

1. Check for missing dependencies:
   ```bash
   cd ~/deployment/backend
   npm install
   ```

2. Verify Node.js version (should be 20.x):
   ```bash
   node --version
   ```

3. Check PM2 logs:
   ```bash
   pm2 logs tempest-backend --err --lines 50
   ```

### News shows "4d ago" for all articles

This indicates timestamp parsing issues. Check backend logs for warnings about invalid dates. The service will fall back to current time if dates can't be parsed.

## Rollback

If issues occur, restore previous deployment:

```bash
# Stop backend
pm2 stop tempest-backend

# Restore backup
rm -rf ~/deployment
cp -r ~/deployment.backup.* ~/deployment

# Restart backend
cd ~/deployment/backend
pm2 restart tempest-backend
```

## Files Changed

- `backend/services/news-service.js` (new)
- `backend/api/weather.js` (added `/news` endpoint)
- `apps/dashboard/src/components/NewsCarousel.js` (new)
- `apps/dashboard/src/components/NewsCarousel.css` (new)
- `apps/dashboard/src/App.js` (news fetching logic)
- `backend/package.json` (new dependencies)
- `apps/dashboard/package.json` (version bump)

## Post-Deployment Checklist

- [ ] Backend starts without errors
- [ ] News endpoint returns articles (`/api/weather/news`)
- [ ] News is disabled by default (no carousel visible without `?news=1`)
- [ ] News appears when `?news=1` is added to URL (works on both external and local)
- [ ] News carousel displays correctly
- [ ] Images load for articles
- [ ] Timestamps display correctly
- [ ] Hover effects work on cards
- [ ] No console errors in browser

## Notes

- News data is cached for 1 hour to reduce API load
- Use `?refresh=1` on the news endpoint to bypass cache
- News carousel refreshes automatically every 10 minutes when enabled
- LLM updates deferred to next build (1.4.4)
