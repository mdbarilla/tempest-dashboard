# Raspberry Pi 4 Setup Guide

Complete guide to set up your Tempest Weather Dashboard on Raspberry Pi 4 with kiosk mode for a dedicated display.

**Last Updated**: 2026-01-22 (Includes critical stability fixes)

## Prerequisites

- Raspberry Pi 4 (2GB RAM minimum, 4GB recommended)
- MicroSD card (16GB or larger)
- Power supply (official Raspberry Pi USB-C power supply recommended)
- Monitor/Display with HDMI input
- Keyboard and mouse (for initial setup)
- Internet connection (WiFi or Ethernet)

## Important Notes

- The Pi is configured with hostname **towerhill.local** for easy network access
- Critical stability fixes have been applied to prevent system freezes
- The dashboard runs on Node.js 20.x with PM2 process management

## Step 1: Install Raspberry Pi OS

### Option A: Using Raspberry Pi Imager (Recommended)

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Insert SD card into your computer
3. Open Raspberry Pi Imager
4. Choose OS: **Raspberry Pi OS (64-bit)** or **Raspberry Pi OS Lite** (for headless)
5. Choose Storage: Select your SD card
6. Click Settings (gear icon):
   - Set hostname: `towerhill` (for towerhill.local access)
   - Enable SSH
   - Set username and password
   - Configure WiFi (optional)
7. Click "Write" and wait for completion

### Option B: Manual Download

1. Download [Raspberry Pi OS](https://www.raspberrypi.com/software/operating-systems/)
2. Use Etcher or similar tool to flash the image to SD card

## Step 2: Initial Pi Setup

1. Insert SD card into Raspberry Pi
2. Connect monitor, keyboard, and mouse
3. Power on the Pi
4. Complete initial setup wizard:
   - Set country, language, timezone
   - Change password (if not set in imager)
   - Connect to WiFi
   - Update software (this may take a while)

5. Open Terminal and update system:

```bash
sudo apt update && sudo apt upgrade -y
```

## Step 3: Install Node.js

Install Node.js 20.x (LTS):

```bash
# Download and install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 4: Clone and Setup Project

```bash
# Create projects directory
mkdir -p ~/projects
cd ~/projects

# If using git, clone your repository
# git clone <your-repo-url> tempest
# OR copy your project files to ~/projects/tempest

cd tempest

# Install backend dependencies
cd backend
npm install

# Create and configure environment
cp .env.example .env
nano .env  # Edit with your API credentials

# Build the backend
npm start  # Test that it works, then Ctrl+C to stop

# Install dashboard dependencies
cd ../apps/dashboard
npm install

# Build the dashboard for production
npm run build
```

## Step 5: Install and Configure Web Server

We'll use a simple HTTP server to serve the built React app:

```bash
# Install serve globally
sudo npm install -g serve pm2

# Test serving the dashboard
cd ~/projects/tempest/apps/dashboard
serve -s build -l 3000
# Open browser to http://localhost:3000 to verify
# Press Ctrl+C to stop
```

## Step 6: Critical System Hardening (REQUIRED)

**These settings prevent system freezes and ensure stability:**

### 6.1: Increase Swap Memory (Prevents OOM Freezes)

```bash
# Edit swap configuration
sudo nano /etc/dphys-swapfile

# Change CONF_SWAPSIZE from 100 to 1024
# Find this line: CONF_SWAPSIZE=100
# Change to: CONF_SWAPSIZE=1024

# Save and exit (Ctrl+X, Y, Enter)

# Restart swap service
sudo /etc/init.d/dphys-swapfile restart

# Verify swap is active
free -m  # Should show ~1024MB swap
```

### 6.2: Increase GPU Memory

```bash
# Edit boot configuration
sudo nano /boot/firmware/config.txt

# Add or modify this line:
gpu_mem=256

# Save and exit (Ctrl+X, Y, Enter)
```

### 6.3: Enable Emergency Reboot Keys

```bash
# Edit sysctl configuration
sudo nano /etc/sysctl.conf

# Add this line at the end:
kernel.sysrq=1

# Save and exit (Ctrl+X, Y, Enter)

# Apply immediately
sudo sysctl -p
```

**Emergency Reboot Sequence**: If the system freezes, hold Alt + PrintScreen, then slowly type: R E I S U B

## Step 7: Setup Auto-Start with PM2

PM2 will keep your backend and frontend running, and restart them if they crash:

```bash
# Start backend (use deployment path)
cd ~/deployment/backend
pm2 start server.js --name tempest-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Copy and run the command that PM2 outputs

# Check status
pm2 status
```

## Step 8: Configure Chromium for Kiosk Mode

### 8.1: Install Required Packages

```bash
sudo apt install -y unclutter
```

### 8.2: Configure Terminal Font (High-Res Displays)

If terminal text is too small to read:

```bash
# Permanent fix: Right-click Terminal → Preferences → Style → Font Size 24+
# Or temporary: In terminal window, Ctrl + Shift + + (to increase size)
```

### 8.3: Create Autostart Script

```bash
# Create autostart directory
mkdir -p ~/.config/lxsession/LXDE-pi

# Create autostart file
nano ~/.config/lxsession/LXDE-pi/autostart
```

Add the following content:

```bash
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xscreensaver -no-splash

# Disable screen blanking
@xset s off
@xset -dpms
@xset s noblank

# Hide mouse cursor after inactivity
@unclutter -idle 3 -root

# Start Chromium in kiosk mode (accessing via hostname)
@chromium-browser --noerrdialogs --disable-infobars --kiosk http://towerhill.local --incognito --disable-translate --no-first-run --fast --fast-start --disable-features=TranslateUI --disable-dev-shm-usage --disable-restore-session-state
```

Save and exit (Ctrl+X, Y, Enter).

## Step 9: Disable Screen Blanking

Edit the lightdm configuration:

```bash
sudo nano /etc/lightdm/lightdm.conf
```

Find the `[Seat:*]` section and add:

```ini
[Seat:*]
xserver-command=X -s 0 -dpms
```

## Step 10: Setup mDNS/Avahi for hostname access

Ensure Avahi is installed for towerhill.local access:

```bash
# Install Avahi daemon
sudo apt install -y avahi-daemon

# Enable and start
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon

# Verify hostname
hostname  # Should show: towerhill
```

## Step 11: Auto-Login (Optional)

For a true kiosk experience:

```bash
sudo raspi-config
```

Navigate to:
- **System Options** → **Boot / Auto Login** → **Desktop Autologin**

## Step 12: Test and Reboot

```bash
# Reboot to test everything
sudo reboot
```

After reboot, the dashboard should automatically:
1. Start the backend server
2. Start the frontend server
3. Open Chromium in fullscreen kiosk mode
4. Display your weather dashboard

## Troubleshooting

### CRITICAL: System Freezes / SSH Timeout

**Symptoms**: Clock stops, SSH fails, system completely unresponsive

**Cause**: Out of memory (OOM) - Chromium consuming all RAM without sufficient swap

**Solution**:
```bash
# 1. Increase swap (if not already done)
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=1024
sudo /etc/init.d/dphys-swapfile restart

# 2. Verify swap is active
free -m  # Should show ~1024MB swap

# 3. Clear Chromium cache before launching
rm -rf ~/.cache/chromium

# 4. If system is frozen, use emergency reboot:
# Hold Alt + PrintScreen, then slowly type: R E I S U B
```

### 502 Bad Gateway Error

**Symptoms**: Nginx loads but dashboard shows 502 error

**Cause**: Backend server not running

**Solution**:
```bash
# Check if backend is running
pm2 status

# If not running, start it
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
pm2 save

# Check logs for errors
pm2 logs tempest-backend
```

### Post-Reboot Recovery

If the Pi restarts, restore services with these steps:

```bash
# 1. Start backend
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
pm2 save

# 2. Launch kiosk UI
export DISPLAY=:0
chromium-browser --kiosk http://towerhill.local &
```

### Chromium Kiosk Crashes

**Symptoms**: Browser closes unexpectedly or won't start

**Solution**:
```bash
# Clear locks and cache
sudo pkill -9 chromium
rm -f ~/.config/chromium/SingletonLock
rm -rf ~/.cache/chromium

# Relaunch with full options
export DISPLAY=:0
chromium-browser --kiosk --noerrdialogs --disable-infobars --disable-restore-session-state --disable-dev-shm-usage http://towerhill.local &
```

### Dashboard not loading

Check if services are running:

```bash
pm2 status
pm2 logs tempest-backend
```

Restart services:

```bash
pm2 restart tempest-backend
```

### Screen goes black

Check power settings:

```bash
xset q | grep timeout
```

Disable screensaver:

```bash
sudo apt remove xscreensaver
```

### Display resolution issues

Edit boot config:

```bash
sudo nano /boot/config.txt
```

Uncomment and adjust:

```ini
hdmi_group=2
hdmi_mode=82  # 1920x1080 @ 60Hz
```

### Cannot access towerhill.local

**Solution**:
```bash
# Verify Avahi is running
sudo systemctl status avahi-daemon

# Verify hostname
hostname  # Should show: towerhill

# If needed, set hostname
sudo hostnamectl set-hostname towerhill
sudo reboot
```

### Terminal Text Too Small

**Solution**:
```bash
# Temporary: In terminal window
# Press: Ctrl + Shift + +

# Permanent: Right-click Terminal → Preferences → Style → Font Size 24+
```

## Maintenance

### Update the dashboard

```bash
cd ~/projects/tempest
git pull  # If using git

cd apps/dashboard
npm install
npm run build

pm2 restart tempest-dashboard
```

### View logs

```bash
pm2 logs tempest-backend
pm2 logs tempest-dashboard
```

### Monitor system resources

```bash
pm2 monit
htop
```

## Performance Optimization

For Raspberry Pi 4, these settings help:

```bash
# Reduce GPU memory (more RAM for apps)
sudo nano /boot/config.txt

# Add or modify:
gpu_mem=128

# Disable Bluetooth if not needed
sudo systemctl disable bluetooth
sudo systemctl disable hciuart

# Disable WiFi if using Ethernet
sudo nano /boot/config.txt
# Add: dtoverlay=disable-wifi
```

## Network Configuration

### Static IP (Recommended for dedicated display)

```bash
sudo nano /etc/dhcpcd.conf
```

Add at the end:

```ini
interface eth0  # or wlan0 for WiFi
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8 8.8.4.4
```

## Remote Access

### SSH Access

```bash
# Enable SSH if not already enabled
sudo systemctl enable ssh
sudo systemctl start ssh

# Connect from another computer
ssh pi@tempest-weather.local
```

### VNC Access (Optional)

```bash
sudo raspi-config
# Interface Options → VNC → Enable

# Access via VNC Viewer from another computer
```

## Security Recommendations

1. Change default password
2. Keep system updated: `sudo apt update && sudo apt upgrade`
3. Configure firewall if exposed to internet
4. Use SSH keys instead of password authentication
5. Keep API tokens secure in `.env` file

## Helpful Commands

```bash
# Restart Pi
sudo reboot

# Shutdown Pi
sudo shutdown -h now

# Check temperature
vcgencmd measure_temp

# Check system info
neofetch

# Check disk space
df -h

# PM2 commands
pm2 status
pm2 restart all
pm2 stop all
pm2 logs
```

## Next Steps

- Set up automatic backups of your SD card
- Configure HTTPS if accessing remotely
- Set up Google Home integration (see [Google Home Setup Guide](../integrations/google-home-setup.md))
- Explore analytics dashboard for historical data analysis
