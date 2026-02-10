# Quick Start Guide

Get your Tempest Weather Suite up and running in minutes.

## For Local Development (Mac/PC)

### 1. Get Your Tempest Credentials

1. Go to [tempestwx.com](https://tempestwx.com) and sign in
2. Navigate to **Settings** → **Data Authorizations** → **Create Token**
3. Copy your API token
4. Get your Station ID:
   - Visit: `https://swd.weatherflow.com/swd/rest/stations?token=YOUR_TOKEN`
   - Look for the `station_id` number

### 2. Setup Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env file with your credentials
nano .env  # or use any text editor
```

In `.env`, set:
```env
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=your_station_id_here
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
```

Start the backend:
```bash
npm run dev
```

Backend will run on http://localhost:3001

Test it:
```bash
curl http://localhost:3001/api/weather/current
```

### 3. Setup Dashboard

Open a new terminal:

```bash
cd apps/dashboard

# Install dependencies
npm install

# Start development server
npm start
```

Dashboard will open automatically at http://localhost:3000

## For Raspberry Pi

**Production Instance**: http://towerhill.local

See the complete [Raspberry Pi Setup Guide](./raspberry-pi-setup.md) for full instructions including **critical stability fixes**.

### Critical Requirements (MUST DO)

Before deploying, ensure these system hardening steps are completed:

1. **Increase Swap to 1024MB** (prevents system freezes)
2. **Set GPU memory to 256MB** (improves stability)
3. **Enable emergency reboot keys** (Alt+PrtScr+REISUB)
4. **Configure hostname as towerhill** (for towerhill.local access)

Quick deployment version:

```bash
# On your Pi (deployed to ~/deployment/)
cd ~/deployment/backend

# Setup backend
npm install --production  # Rebuilds native modules for ARM
cp .env.example .env
nano .env  # Add your credentials

# Install PM2 for auto-start
sudo npm install -g pm2

# Start backend service
pm2 start server.js --name tempest-backend
pm2 save
pm2 startup  # Follow the instructions

# Verify it's running
pm2 status
curl http://localhost:3001/health
```

**Note**: Dashboard is served by nginx from `~/deployment/dashboard/build/`. Access at http://towerhill.local

## For Google Home Integration

See the complete [Google Home Setup Guide](../integrations/google-home-setup.md)

Quick version:

1. Expose your backend with ngrok:
   ```bash
   ngrok http 3001
   ```

2. Create Dialogflow agent at [dialogflow.cloud.google.com](https://dialogflow.cloud.google.com/)

3. Configure webhook URL: `https://your-ngrok-url/webhooks/google-home`

4. Test: "Hey Google, ask Tempest what's the weather"

## Verify Everything Works

### Backend Health Check

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-16T...",
  "uptime": 123.45
}
```

### Get Current Weather

```bash
curl http://localhost:3001/api/weather/current
```

### Get Forecast

```bash
curl http://localhost:3001/api/weather/forecast
```

### Get Complete Weather Data

```bash
curl http://localhost:3001/api/weather/complete
```

## Troubleshooting

### Backend won't start

**Error: TEMPEST_API_TOKEN must be set**
- Make sure `.env` file exists in `backend/` directory
- Check that your API token is correctly set

**Error: EADDRINUSE (port already in use)**
- Another process is using port 3001
- Change PORT in `.env` or stop the other process

### Dashboard shows "Unable to fetch weather data"

1. Verify backend is running: `curl http://localhost:3001/health`
2. Check browser console for errors (F12)
3. Verify API token is valid at tempestwx.com

### No data showing

1. Check your Tempest station is online at tempestwx.com
2. Verify station ID is correct
3. Check backend logs for errors

## Next Steps

- Customize the dashboard appearance in `apps/dashboard/src/styles/`
- Add more weather metrics in `apps/dashboard/src/components/Metrics.js`
- Set up automatic backups of weather data
- Deploy to production with HTTPS
- Create the analytics app for historical data visualization

## Useful Commands

### Development

```bash
# Backend
cd backend
npm run dev          # Start with auto-reload

# Dashboard
cd apps/dashboard
npm start            # Start dev server
npm run build        # Build for production

# Both
npm install          # Install dependencies
```

### Production (Raspberry Pi - towerhill.local)

```bash
pm2 status           # Check service status
pm2 logs             # View logs
pm2 restart tempest-backend      # Restart backend
pm2 stop tempest-backend         # Stop backend
pm2 start tempest-backend        # Start backend

# System health checks
free -m              # Verify swap is ~1024MB
vcgencmd get_mem gpu # Verify GPU memory is 256MB
vcgencmd measure_temp # Check CPU temperature
```

## 1.4.2 Debug on localhost for the LLM

For 1.4.2 work (Reset to API, atmosphere, runtime checks), run backend and dashboard on your Mac and use the Pi's weather bridge for the LLM.

**1. Reset and start**

```bash
./scripts/reset-backends.sh
./scripts/run-local.sh
```

Then open http://localhost:3000

**2. Point backend at the Pi's LLM bridge**

In `backend/.env` (when running on Mac):

```env
AI_BRIDGE_URL=http://towerhill.local:5000
AI_BRIDGE_ENABLED=1
AI_BRIDGE_TIMEOUT=3000
```

Omit or use `AI_BRIDGE_URL=http://localhost:5000` only if you run the weather bridge locally (e.g. on Mac with Ollama; the bridge normally runs on the Pi).

**3. Check LLM / atmosphere**

- **Atmosphere (no cache):**  
  `curl -s "http://localhost:3001/api/weather/atmosphere?debug=1"`
- **Full validation (bridge + backend + /complete):**  
  `./scripts/validate-atmosphere.sh`
- **Ping (and clear backend cache):**  
  `./scripts/ping-atmosphere.sh --reset`

If the UI shows **"Conditions summary loading…"**, use `?debug=1` and inspect `debug.body`: `art_engine_status`, `last_ai_error`. See `raspberry-pi/weather_bridge/README.md` and `raspberry-pi/weather_bridge/terminal-commands.md`.

**4. 1.4.2 testing (Reset to API)**

- Test-plan: [reference/test-plan.md](../reference/test-plan.md) → §2.2 Reset to API.
- Plan: [release-planning.md](../release-planning.md) → runtime verification (frontend `correctionId`, `current.timestamp`, DELETE URL; backend `obs_timestamp`, `deleteCorrectionsInWindow`, `clearCache`; GET /complete after reset).

**5. Optional: reset Pi backends too**

```bash
ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge; (cd ~/deployment/backend 2>/dev/null && pm2 restart tempest-backend 2>/dev/null) || true"
```

## Getting Help

If you run into issues:

1. Check the documentation in `docs/`
2. Review backend logs: `pm2 logs tempest-backend`
3. Check browser console for frontend errors
4. Verify your Tempest station is reporting data at tempestwx.com

## Development Tips

### Hot Reload

Both backend and frontend support hot reload in development mode:
- Backend: Uses nodemon (automatically reloads on file changes)
- Frontend: React dev server (automatically reloads on file changes)

### Environment Variables

Create `.env.local` in the dashboard for local overrides:

```env
REACT_APP_API_URL=http://192.168.1.100:3001/api/weather
```

### Testing Different Devices

Access dashboard from other devices on your network:
```
http://YOUR_IP:3000
```

Find your IP:
```bash
# Mac/Linux
ifconfig | grep inet

# Raspberry Pi
hostname -I
```

## Project Structure Reference

```
Tempest/
├── backend/              # Node.js API server
│   ├── api/             # REST endpoints
│   ├── services/        # Tempest API integration
│   ├── webhooks/        # Google Home webhook
│   └── server.js        # Main server file
├── apps/
│   ├── dashboard/       # React dashboard
│   └── legacy/          # Original HTML dashboard
├── docs/                # Documentation
│   ├── setup-operations/
│   │   ├── quick-start.md
│   │   └── raspberry-pi-setup.md
│   └── integrations/
│       └── google-home-setup.md
└── README.md            # Project overview
```
