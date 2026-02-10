# Tempest Weather Dashboard

A modern, beautiful weather dashboard for Raspberry Pi, powered by the Tempest Weather API.

![Version](https://img.shields.io/badge/version-1.4.11-blue)
![Node](https://img.shields.io/badge/node-20.x-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Deploy](https://img.shields.io/badge/deploy-Raspberry%20Pi-brightgreen)

**Live example:** [towerhill.app](https://towerhill.app)

## Features
- **Optimized for Pi** — Runs on Raspberry Pi 4 in kiosk mode; Chromium-friendly; swap and GPU tuning documented
- **Beautiful Design** — Boutique weather app aesthetics with crisp typography, dynamic theming, golden vertical alignment, design tokens (radius, opacity, colors, spacing)
- **Real-time Weather** — Current conditions with feels-like temperature; hourly and 10-day forecast; condition corrections (override observed conditions, persists 30 minutes)
- **Historical Trends** — 6-hour sparklines for pressure, humidity, wind, and precipitation; 3-day and 7-day metric charts; analytics view with time-range selector
- **Metrics Dashboard** — Barometric pressure, humidity with dew point, wind speed and gusts, precipitation tracking, solar radiation, sunrise/sunset; tappable cards with metric detail modals
- **Manual Precipitation Logging** — Manually og snow, rain, sleet, hail with amounts; view and edit history; graph and time-range views
- **NWS Integration** — U.S. National Weather Service alerts and storm warnings with detail modal
- **Optional LLM “Atmosphere”** — Short natural-language summary of conditions (via optional weather bridge service); thumbs up/down feedback
- **Dark/Light Mode** — Automatic theme switching based on time of day (sunrise/sunset); manual theme toggle
- **Accessibility** — WCAG AA/AAA contrast (21:1); 2px stroke icons; staggered entrance animations

## Quick Start

### Prerequisites
- Node.js 20.x or higher
- Tempest Weather API token ([Get yours here](https://tempestwx.com))
- Your Tempest station ID
- For deployment: Raspberry Pi 4 (2GB+ RAM)

### Local Development

1. **Clone and install backend**:
```bash
cd backend
npm install
```

2. **Configure environment**:
```bash
# Create .env file
cat > .env << 'EOF'
PORT=3001
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=your_station_id
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
NODE_ENV=development
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
EOF
```

3. **Start backend**:
```bash
npm run dev
```

4. **Install and start dashboard** (in a new terminal):
```bash
cd apps/dashboard
npm install
npm start
```

5. **Open browser**: http://localhost:3000

## Deployment

### Production Instance

Example: the dashboard can be deployed on a Raspberry Pi 4 (e.g. at `http://your-host.local` or your Pi’s IP).

**Critical Stability Fixes Applied**:
- ✅ Swap increased to 1024MB (prevents OOM freezes)
- ✅ GPU memory set to 256MB (improved rendering)
- ✅ Emergency reboot keys enabled (Alt+PrtScr+REISUB)
- ✅ Chromium cache management (prevents crashes)

### Automated Deployment (Recommended)

The automated script handles everything including rebuilding native modules on the Pi:

```bash
# Network deployment (set TEMPEST_PI_IP and TEMPEST_PI_USER, or enter when prompted)
./scripts/auto-build-and-deploy.sh network

# USB deployment (for offline Pi)
./scripts/auto-build-and-deploy.sh usb
```

**Important**: The script automatically:
- ✅ Excludes Mac's node_modules from deployment package
- ✅ Runs `npm install --production` on the Pi to rebuild native modules for ARM architecture
- ✅ Restarts PM2 backend service
- ✅ Updates dashboard files served by nginx

**Why this matters**: Native Node.js modules (like sqlite3) must be compiled for the target architecture. The Mac builds x64 binaries, but the Raspberry Pi needs ARM binaries. The deployment script ensures dependencies are installed directly on the Pi.

### Manual Deployment

```bash
# Build and package (creates build-output/build-YYYYMMDD-HHMMSS/ or use TEMPEST_BUILD_DIR)
./scripts/auto-build-and-deploy.sh build-only

# Transfer to Pi (use the tarball from the build output dir; replace user@host with your Pi SSH)
scp build-output/build-*/tempest-v*.tar.gz user@your-pi.local:~/

# On the Pi (extract in home directory to get ~/deployment)
tar -xzf tempest-v*.tar.gz
cd ~/deployment/backend
npm install --production  # Critical: rebuilds native modules for ARM
pm2 restart tempest-backend
```

See [DEPLOYMENT.md](DEPLOYMENT.md) and [REBUILD-WALKTHROUGH.md](REBUILD-WALKTHROUGH.md) for full instructions.

## Project Structure

```
Tempest/
├── apps/
│   └── dashboard/              # React weather dashboard
├── backend/                    # Node.js API server
│   ├── api/                   # REST endpoints
│   ├── services/              # Weather data processing
│   └── data/                  # SQLite database
├── build-output/              # Production builds
├── scripts/                   # Build and deployment scripts
├── archive/                   # Old deployments and docs
├── CHANGELOG.md              # Version history
└── DEPLOYMENT.md             # Deployment guide
```

## Technology Stack

- **Frontend**: React, CSS3 with custom design system
- **Backend**: Node.js, Express
- **Database**: SQLite for historical data
- **Process Manager**: PM2
- **Web Server**: nginx
- **Platform**: Raspberry Pi OS Lite (64-bit)

## Key Features

### Real-time Weather
- Current conditions with feels-like temperature
- Hourly forecast with temperature trendlines
- 10-day forecast cards

### Metrics Dashboard
- Barometric pressure with 6-hour trend
- Humidity with dew point
- Wind speed and gusts
- Precipitation tracking
- Solar radiation
- Sunrise/sunset times

### User Controls
- **Manual Precipitation Logging**: Log snow, rain, sleet, hail with amounts
- **Condition Corrections**: Override observed conditions (persists 30 minutes)
- **Offline Indicators**: Visual banners for offline station or stale data

### Design System
- Golden vertical alignment with optical kerning
- Consistent 48px gutters (32px tablet, 24px mobile)
- Staggered entrance animations
- Sparkline hover effects
- 2px stroke weight icons
- WCAG AAA contrast (21:1)

## API Endpoints

### Weather Data
- `GET /api/weather/current` - Current observations
- `GET /api/weather/forecast` - 10-day forecast
- `GET /api/weather/recent?hours=6` - Historical data for sparklines

### Precipitation
- `GET /api/weather/precipitation/today` - Today's precipitation entries
- `POST /api/weather/precipitation` - Log precipitation
- `DELETE /api/weather/precipitation/:id` - Delete entry

### Condition Corrections
- `POST /api/weather/correction` - Override condition
- `DELETE /api/weather/correction/:id` - Cancel correction

## Maintenance

### Daily
```bash
pm2 status                # Check backend status
df -h                     # Monitor disk space
```

### Weekly
```bash
pm2 logs --lines 100      # Review logs
pm2 flush                 # Clear old logs
```

### Monthly
```bash
sudo apt update && sudo apt upgrade -y    # System updates
rm -f ~/tempest-v*.tar.gz                 # Clean old deployments
```

## Troubleshooting

### Dashboard shows old version
```bash
# Hard refresh browser (Cmd+Shift+R)
# Or verify nginx path:
sudo cat /etc/nginx/sites-available/tempest | grep "root"
# Should show: root /home/<your-user>/deployment/dashboard;
```

### Backend not responding
```bash
pm2 logs tempest-backend --lines 50
pm2 restart tempest-backend
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete troubleshooting guide.

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

### Latest: v1.4.11
- Tappable metric cards with detail modals; 3-day and 7-day charts; design tokens; conditions list view. See [CHANGELOG.md](CHANGELOG.md) for full history.

## Resources

- **Tempest API Documentation**: https://weatherflow.github.io/Tempest/api/
- **Project Documentation**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Archived Docs**: `archive/old-docs/`

## License

MIT License — see [LICENSE](LICENSE) for details.

## Publishing to GitHub

To publish this project as a public repository, see **[docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md)** for repository name ideas, a pre-push checklist, and step-by-step push instructions.

## Credits

Weather data provided by [Tempest Weather](https://tempestwx.com)
