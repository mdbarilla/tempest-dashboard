# Getting Started with Tempest Weather Suite

Welcome! This guide will get you up and running quickly.

## 🎯 Choose Your Path

### Path 1: Local Development (Mac/PC)
**Best for**: Testing and development before deploying to Raspberry Pi

**Time needed**: 10 minutes

**Steps**:
1. Run the setup script: `./setup.sh`
2. Configure `backend/.env` with your Tempest credentials
3. Start backend: `cd backend && npm run dev`
4. Start dashboard: `cd apps/dashboard && npm start`
5. Open http://localhost:3000

📖 **Full guide**: [docs/quick-start.md](docs/quick-start.md)

---

### Path 2: Raspberry Pi Deployment
**Best for**: Dedicated weather display on TV/monitor

**Time needed**: 1-2 hours

**Prerequisites**: Raspberry Pi 4, SD card, display

**Steps**:
1. Flash Raspberry Pi OS to SD card
2. Install Node.js and dependencies
3. Clone/copy this project to Pi
4. Configure environment variables
5. Set up auto-start with PM2
6. Configure Chromium kiosk mode

📖 **Full guide**: [docs/raspberry-pi-setup.md](docs/raspberry-pi-setup.md)

---

### Path 3: Google Home Integration
**Best for**: Voice-activated weather queries

**Time needed**: 30-45 minutes

**Prerequisites**: Google account, backend server running

**Steps**:
1. Expose backend with ngrok (development) or deploy to cloud
2. Create Dialogflow agent
3. Configure intents and webhook
4. Test with "Hey Google, ask Tempest what's the weather"

📖 **Full guide**: [docs/google-home-setup.md](docs/google-home-setup.md)

---

## 📋 Prerequisites

### Required
- **Node.js 18+** - [Download here](https://nodejs.org)
- **npm** (comes with Node.js)
- **Tempest Weather Station** with API access
- **Tempest API Token** - Get from [tempestwx.com](https://tempestwx.com)

### Optional
- **Raspberry Pi 4** (for dedicated display)
- **Google account** (for Google Home integration)
- **ngrok** (for testing Google Home locally)

---

## 🔑 Get Your Tempest Credentials

Before starting, you'll need:

### 1. API Token

1. Go to [tempestwx.com](https://tempestwx.com)
2. Sign in
3. Navigate to **Settings** → **Data Authorizations**
4. Click **Create Token**
5. Copy the token (starts with letters and numbers like `3e59d995-...`)

### 2. Station ID

Option A - From Tempest website:
1. Look at your station URL
2. The ID is in the URL: `tempestwx.com/station/XXXXXX`

Option B - From API:
1. Visit in browser: `https://swd.weatherflow.com/swd/rest/stations?token=YOUR_TOKEN`
2. Look for `"station_id": XXXXXX`

### 3. Coordinates (Optional)

Your station's latitude and longitude:
- Check tempestwx.com station page
- Or use the values from the API response above
- Example: `42.3725, -71.3161`

---

## ⚡ Quick Start Commands

### All-in-One Setup
```bash
# Run automated setup
./setup.sh
```

### Manual Setup
```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev

# Dashboard (new terminal)
cd apps/dashboard
npm install
npm start
```

### Check Everything Works
```bash
# Test backend
curl http://localhost:3001/health

# Test weather endpoint
curl http://localhost:3001/api/weather/current

# Dashboard opens automatically at http://localhost:3000
```

---

## 📁 Project Structure Overview

```
Tempest/
├── backend/              # API server (Node.js + Express)
├── apps/
│   ├── dashboard/       # Weather dashboard (React)
│   └── legacy/          # Your original HTML dashboard
├── docs/                # Documentation
│   ├── quick-start.md
│   ├── raspberry-pi-setup.md
│   ├── google-home-setup.md
│   └── api-reference.md
├── setup.sh             # Quick setup script
├── README.md            # Project overview
└── PROJECT_SUMMARY.md   # What's been created
```

---

## 🎨 What You'll See

### Dashboard Features
- **Large temperature display** with feels-like temperature
- **Current conditions** with weather icon
- **Today's high/low** temperatures
- **Weather metrics**: humidity, wind, pressure, UV
- **5-day forecast** with precipitation chances
- **Auto-refresh** every 60 seconds
- **Calm, minimalist design** perfect for always-on displays

### Color Palette
- Deep blue/purple gradients
- High contrast white text
- Accent colors for metrics (blue, teal, orange)
- Smooth transitions and animations

---

## 🔧 Configuration

### Environment Variables (backend/.env)

```env
# Required
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=your_station_id

# Optional
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
PORT=3001
DATABASE_PATH=./data/weather.db
```

---

## 🚀 Deployment Options

### Option 1: Keep it local
Run on your computer, access from any device on your network

### Option 2: Raspberry Pi
Dedicated display, kiosk mode, auto-start on boot

### Option 3: Cloud deployment
Deploy backend to Heroku, Vercel, or AWS
Deploy frontend to Netlify or Vercel

---

## 🆘 Troubleshooting

### "Backend won't start"
- Check Node.js version: `node -v` (need 18+)
- Verify `.env` file exists in `backend/`
- Check API token is correct

### "Dashboard shows no data"
- Verify backend is running: `curl http://localhost:3001/health`
- Check browser console (F12) for errors
- Confirm Tempest station is online at tempestwx.com

### "Port already in use"
- Change `PORT=3001` to another port in `.env`
- Or stop the other process using that port

---

## 📚 Documentation

- **[Quick Start](docs/quick-start.md)** - Local development setup
- **[Raspberry Pi Setup](docs/raspberry-pi-setup.md)** - Dedicated display
- **[Google Home Setup](docs/google-home-setup.md)** - Voice integration
- **[API Reference](docs/api-reference.md)** - API endpoints
- **[Roadmap](docs/roadmap.md)** - Future features
- **[Project Summary](PROJECT_SUMMARY.md)** - What's been created

---

## 🎯 Next Steps After Setup

1. ✅ **Verify everything works** locally
2. 📱 **Test on mobile** devices on your network
3. 🖥️ **Deploy to Raspberry Pi** when SD card arrives
4. 🗣️ **Set up Google Home** integration
5. 📊 **Plan analytics dashboard** for historical data
6. 🎨 **Customize** colors and layout to your preference

---

## 💡 Tips

- **Development**: Use `npm run dev` for auto-reload on changes
- **Production**: Use PM2 for process management
- **Monitoring**: Check logs with `pm2 logs`
- **Updates**: Pull latest code and run `npm install` in both folders
- **Backups**: Regularly backup your SQLite database (in `backend/data/`)

---

## 🌟 Features Ready to Use

✅ Real-time weather data from Tempest API
✅ Beautiful minimalist dashboard
✅ Historical data storage in SQLite
✅ RESTful API with caching
✅ Google Home voice integration
✅ Raspberry Pi kiosk mode ready
✅ Auto-refresh every 60 seconds
✅ Responsive design for all screens

---

## 📞 Support

Questions? Check the documentation in `docs/` folder!

---

**Ready? Let's get started!**

Choose your path above and follow the guide. Within minutes, you'll have your Tempest weather data displayed beautifully on your screen.

🌤️ Happy weather tracking!
