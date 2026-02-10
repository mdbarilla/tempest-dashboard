# Tempest Weather Dashboard - Quick Start Guide

## TL;DR - Get Running in 3 Steps

### Step 1: Build on Your Mac

```bash
./scripts/build-for-deploy.sh
```

### Step 2: Transfer to Raspberry Pi

```bash
scp tempest-deploy.tar.gz pi@tempest-weather.local:~/
scp raspberry-pi/setup/install.sh pi@tempest-weather.local:~/
```

### Step 3: Install on Raspberry Pi

```bash
ssh pi@tempest-weather.local
chmod +x install.sh
./install.sh
```

Done! Visit `http://tempest-weather.local` to see your dashboard.

---

## Detailed Instructions

### Before You Start

You'll need:
- ✅ Tempest API token (get from [tempestwx.com](https://tempestwx.com/settings/tokens))
- ✅ Your station ID (204768 for your station)
- ✅ Raspberry Pi with Raspberry Pi OS installed
- ✅ SSH enabled on your Pi
- ✅ Pi connected to your network

### 1. Prepare the Deployment Package

On your Mac, from the project root:

```bash
# Make the build script executable (first time only)
chmod +x scripts/build-for-deploy.sh

# Build the deployment package
./scripts/build-for-deploy.sh
```

This creates `tempest-deploy.tar.gz` containing everything needed for the Pi.

### 2. Set Up Your Raspberry Pi SD Card

#### Option A: Using Raspberry Pi Imager (Recommended)

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Insert your SD card
3. Choose "Raspberry Pi OS (64-bit)" or "Raspberry Pi OS Lite (64-bit)"
4. Click the gear icon ⚙️ for advanced settings:
   - Set hostname: `tempest-weather`
   - Enable SSH (use password authentication)
   - Set username: `pi`
   - Set password: (your choice - remember this!)
   - Configure WiFi (if needed)
5. Write to SD card

#### Option B: Manual Setup

Flash Raspberry Pi OS, then create empty `ssh` file on boot partition.

### 3. Transfer Files to Pi

```bash
# Transfer deployment package
scp tempest-deploy.tar.gz pi@tempest-weather.local:~/

# Transfer installation script
scp raspberry-pi/setup/install.sh pi@tempest-weather.local:~/
```

If `.local` doesn't work, find your Pi's IP address and use that instead.

### 4. Run Installation on Pi

```bash
# SSH into your Pi
ssh pi@tempest-weather.local

# Make install script executable
chmod +x install.sh

# Run installation
./install.sh
```

The installer will:
- ✅ Extract the deployment package
- ✅ Install Node.js, nginx, and PM2
- ✅ Install dependencies
- ✅ Prompt for your API token
- ✅ Set up the database
- ✅ Configure nginx web server
- ✅ Start the backend service
- ✅ Configure auto-start on boot

### 5. Access Your Dashboard

Open a browser and go to:
- `http://tempest-weather.local`
- Or use your Pi's IP address: `http://192.168.x.x`

You should see your weather dashboard! 🌤️

---

## Optional: Kiosk Mode Setup

To make your Pi boot directly into the weather dashboard:

### Install Display Server

```bash
sudo apt install -y --no-install-recommends \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  openbox \
  chromium-browser \
  unclutter
```

### Configure Auto-login

```bash
sudo raspi-config
# System Options > Boot / Auto Login > Console Autologin
```

### Create Kiosk Configuration

```bash
mkdir -p ~/.config/openbox
cat > ~/.config/openbox/autostart << 'EOF'
# Disable screensaver
xset s off
xset s noblank
xset -dpms

# Hide mouse cursor
unclutter -idle 0.1 &

# Start browser in kiosk mode
chromium-browser \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  http://localhost &
EOF
```

### Auto-start X Server

```bash
cat >> ~/.bash_profile << 'EOF'
if [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then
  startx
fi
EOF
```

### Reboot

```bash
sudo reboot
```

Your Pi will now boot directly into the weather dashboard in full-screen mode!

---

## Troubleshooting

### Can't connect to Pi

```bash
# Find your Pi's IP
ping tempest-weather.local
# Or check your router's DHCP clients list
```

### Dashboard shows "Unable to fetch weather data"

```bash
# Check backend logs
ssh pi@tempest-weather.local
pm2 logs tempest-backend

# Verify environment variables
cat ~/deployment/backend/.env

# Restart backend
pm2 restart tempest-backend
```

### Nginx errors

```bash
# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### Need to update

```bash
# On your Mac: rebuild
./scripts/build-for-deploy.sh

# Transfer new build
scp tempest-deploy.tar.gz pi@tempest-weather.local:~/

# On Pi: extract and update
cd ~
tar -xzf tempest-deploy.tar.gz
rm -rf deployment/dashboard/*
mv deployment/build/* deployment/dashboard/
cd deployment/backend
npm install --production
pm2 restart tempest-backend
sudo systemctl reload nginx
```

---

## Performance Tips

- **Use Lite OS**: Raspberry Pi OS Lite uses less memory
- **Enable GPU memory split**: Allocate more RAM to system
- **Disable unnecessary services**: `sudo systemctl disable bluetooth`
- **Monitor resources**: Install `htop` to watch CPU/RAM usage
- **Set up log rotation**: Prevent PM2 logs from filling disk

---

## What's Next?

- Set up automatic database backups
- Configure Grafana for historical weather tracking
- Add weather alerts/notifications
- Create custom views for different metrics
- Set up remote access with Tailscale or WireGuard

For detailed information, see the full [DEPLOYMENT.md](DEPLOYMENT.md) guide.
