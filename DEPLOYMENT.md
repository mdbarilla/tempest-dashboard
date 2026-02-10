# Tempest Weather Dashboard - Deployment Guide

Complete guide for deploying the Tempest Weather Dashboard to your Raspberry Pi.

**Production**: Deploy to your Pi (e.g. http://your-host.local or your Pi IP)
**Version**: 1.4.8
**Last Updated**: 2026-02-08

## Quick Links
- [Initial Setup](#initial-setup) - First time Pi configuration (includes **critical stability fixes**)
- [Standard Deployment](#standard-deployment) - Deploy new versions
- [**docs/setup-operations/rebuild-walkthrough.md**](docs/setup-operations/rebuild-walkthrough.md) - Step-by-step: auto-build script or manual rebuild via SSH (use when stuck)
- [Terminal Commands](#essential-commands) - Common operations
- [Troubleshooting](#troubleshooting) - Fix common issues (including system freezes)

---

## Initial Setup

### Prerequisites
- Raspberry Pi 4 (2GB+ RAM recommended)
- MicroSD card (16GB+ recommended)
- Your Tempest API token and station ID
- Network connectivity

### 1. Install Raspberry Pi OS

1. Download [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Flash Raspberry Pi OS (64-bit preferred) to your SD card
3. Enable SSH in the imager settings
4. **Set hostname** (e.g. `towerhill` for your-host.local access)
5. Configure WiFi credentials if needed
6. Insert SD card and boot the Pi

### 2. Initial Pi Configuration

SSH into your Pi:
```bash
ssh user@your-pi.local
# Or: ssh user@<your-pi-ip>
```

Update the system:
```bash
sudo apt update && sudo apt upgrade -y
```

### 2.1: CRITICAL System Hardening (Required for Stability)

**These settings prevent system freezes and crashes:**

**Increase Swap Memory** (prevents OOM freezes):
```bash
sudo nano /etc/dphys-swapfile
# Change: CONF_SWAPSIZE=1024
sudo /etc/init.d/dphys-swapfile restart
free -m  # Verify swap is ~1024MB
```

**Increase GPU Memory** (improves rendering stability):
```bash
sudo nano /boot/firmware/config.txt
# Add or modify: gpu_mem=256
```

**Enable Emergency Reboot Keys**:
```bash
sudo nano /etc/sysctl.conf
# Add at end: kernel.sysrq=1
sudo sysctl -p
```

**Emergency Reboot**: If system freezes, hold Alt+PrintScreen, then slowly type: R E I S U B

**Install Avahi for hostname access**:
```bash
sudo apt install -y avahi-daemon
sudo systemctl enable avahi-daemon
sudo systemctl start avahi-daemon
hostname  # Should show: towerhill
```

### 3. Install Required Software

Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verify installation
```

Install nginx:
```bash
sudo apt install -y nginx
```

Install PM2 (Process Manager):
```bash
sudo npm install -g pm2
```

### 4. Configure nginx

Create the nginx configuration:
```bash
sudo nano /etc/nginx/sites-available/tempest
```

Paste this configuration (⚠️ **CRITICAL**: Use correct path):
```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # ⚠️ IMPORTANT: Point to deployment directory, not apps/dashboard/build
    root /home/<your-user>/deployment/dashboard;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/tempest /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## Standard Deployment

### From Your Mac

**1. Build the Project**
```bash
cd /path/to/Tempest
./scripts/auto-build-and-deploy.sh network
```

Or `build-only` to only create the tarball (then transfer and run the Pi steps yourself). The script:
- Builds the React dashboard
- Packages backend and frontend into `deployment/`
- Creates `build-output/tempest-v{VERSION}-{TIMESTAMP}.tar.gz`
- With `network`: copies to Pi, extracts to `~/deployment/`, runs `npm install --production` in `~/deployment/backend`, restarts `tempest-backend`

**2. Transfer to Pi**
```bash
cd build-output
scp tempest-v*.tar.gz user@your-pi.local:~/
# Or: scp tempest-v*.tar.gz user@<your-pi-ip>:~/
```

### On the Raspberry Pi

**3. Extract and Deploy**
```bash
# Extract the archive
cd ~
tar -xzf tempest-v*.tar.gz

# Install/update backend dependencies
cd deployment/backend
npm install --production

# Configure environment (first time only)
nano .env
```

Add your configuration:
```env
PORT=3001
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=204768
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
NODE_ENV=production
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
```

**4. Restart Backend**
```bash
pm2 restart tempest-backend
# Or first time:
pm2 start server.js --name tempest-backend
pm2 save
```

**5. Refresh Browser**

Hard refresh your browser (Cmd+Shift+R or Ctrl+Shift+R) to clear cache and load the new version.

---

## Essential Commands

### Backend Management
```bash
# Check status
pm2 status

# View logs (live)
pm2 logs tempest-backend

# View last 50 lines
pm2 logs tempest-backend --lines 50

# Restart backend
pm2 restart tempest-backend

# Process details
pm2 describe tempest-backend
```

### nginx Management
```bash
# Check status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx

# Reload (no downtime)
sudo systemctl reload nginx

# View error logs
sudo tail -50 /var/log/nginx/error.log
```

### Testing
```bash
# Test backend API
curl http://localhost:3001/api/weather/current

# Pretty print JSON
curl http://localhost:3001/api/weather/current | python3 -m json.tool

# Test dashboard
curl http://localhost/

# Get Pi's IP address
hostname -I
```

### System Health
```bash
# Disk space
df -h

# Memory usage (verify swap is ~1024MB)
free -m

# CPU temperature
vcgencmd measure_temp

# GPU memory (should be 256MB)
vcgencmd get_mem gpu

# Find large files
du -h ~/deployment | sort -h | tail -20

# Complete health check
echo "=== System Health ==="
free -m | grep Swap
vcgencmd get_mem gpu
vcgencmd measure_temp
df -h | grep /dev/root
pm2 status
```

---

## Troubleshooting

### CRITICAL: System Freezes / SSH Timeout

**Symptom**: Clock stops, SSH fails, system completely unresponsive, ping may still work

**Cause**: Out of memory (OOM) - Chromium consuming all RAM without sufficient swap

**Prevention** (if not already done):
```bash
# Increase swap to 1024MB
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=1024
sudo /etc/init.d/dphys-swapfile restart
free -m  # Verify ~1024MB swap
```

**Recovery**:
```bash
# 1. Try emergency reboot (if you have keyboard access)
# Hold Alt + PrintScreen, then slowly type: R E I S U B

# 2. If that fails, hard power cycle (unplug power)

# 3. After boot, clear Chromium cache:
rm -rf ~/.cache/chromium

# 4. Verify swap is active:
free -m
```

### 502 Bad Gateway

**Symptom**: nginx loads but dashboard shows 502 error

**Cause**: Backend server not running

**Solution**:
```bash
pm2 status  # Check if tempest-backend is running

# If not running:
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
pm2 save

# Check logs:
pm2 logs tempest-backend
```

### Chromium Kiosk Crashes

**Symptom**: Browser closes unexpectedly or won't start

**Solution**:
```bash
# Clear locks and cache
sudo pkill -9 chromium
rm -f ~/.config/chromium/SingletonLock
rm -rf ~/.cache/chromium

# Relaunch with full options
export DISPLAY=:0
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --disable-restore-session-state --disable-dev-shm-usage \
  http://towerhill.local &
```

### Post-Reboot Service Recovery

**If Pi restarts unexpectedly:**
```bash
# 1. Backend should auto-start via PM2
pm2 status

# 2. If not running:
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
pm2 save

# 3. Launch kiosk (if desktop environment)
export DISPLAY=:0
chromium-browser --kiosk http://towerhill.local &
```

### Cannot Access towerhill.local

**Solution**:
```bash
# Check Avahi is running
sudo systemctl status avahi-daemon

# Verify hostname
hostname  # Should show: towerhill

# If needed, set hostname
sudo hostnamectl set-hostname towerhill
sudo reboot
```

### Dashboard Shows Old Version

**Symptom**: Browser shows old version even after deployment

**Cause**: Browser cache or nginx serving old files

**Solution**:
1. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. Verify nginx path:
   ```bash
   sudo cat /etc/nginx/sites-available/tempest | grep "root"
   ```
   Should show: `root /home/<your-user>/deployment/dashboard;`
3. If wrong, fix it:
   ```bash
   sudo sed -i 's|root .*|root /home/<your-user>/deployment/dashboard;|' /etc/nginx/sites-available/tempest
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Backend Not Responding

**Check if running**:
```bash
pm2 status
```

**View error logs**:
```bash
pm2 logs tempest-backend --lines 50
```

**Common fixes**:
```bash
# Restart backend
pm2 restart tempest-backend

# If that fails, delete and restart
pm2 delete tempest-backend
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
pm2 save
```

### Dashboard Won't Load

**Check nginx**:
```bash
sudo systemctl status nginx
sudo nginx -t
```

**Check files exist**:
```bash
ls -la ~/deployment/dashboard/
```

**View nginx errors**:
```bash
sudo tail -50 /var/log/nginx/error.log
```

### API Errors

**Check environment variables**:
```bash
cd ~/deployment/backend
cat .env
```

**Test API token**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://swd.weatherflow.com/swd/rest/observations/station/YOUR_STATION_ID?token=YOUR_TOKEN"
```

**Check database**:
```bash
cd ~/deployment/backend
ls -lh data/weather.db
sqlite3 data/weather.db "SELECT COUNT(*) FROM weather_data;"
```

### Out of Disk Space

**Clean old files**:
```bash
# Remove old deployments
rm -f ~/tempest-v*.tar.gz

# Clean logs
pm2 flush
sudo journalctl --vacuum-time=7d

# Clean npm cache
npm cache clean --force

# Clean apt cache
sudo apt-get clean
```

**Check what's using space**:
```bash
du -sh ~/* | sort -h | tail -20
```

### High Memory Usage

**Check memory**:
```bash
free -m
pm2 monit  # Press 'q' to exit
```

**Note**: Swap should already be set to 1024MB from initial setup. If experiencing issues:

**Verify swap configuration**:
```bash
free -m  # Check current swap
cat /etc/dphys-swapfile | grep CONF_SWAPSIZE
```

**If swap is not 1024MB, fix it**:
```bash
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=1024
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -m  # Verify change
```

---

## Deployment Checklist

After every deployment, verify:

- [ ] Backend is running: `pm2 status`
- [ ] No errors in logs: `pm2 logs tempest-backend --lines 20`
- [ ] API responds: `curl http://localhost:3001/api/weather/current`
- [ ] Dashboard loads: `curl http://localhost/`
- [ ] Hard refresh browser to clear cache
- [ ] Check version number in browser console or UI
- [ ] System health check: `free -m` (verify swap ~1024MB)
- [ ] GPU memory check: `vcgencmd get_mem gpu` (should be 256MB)

---

## Emergency Recovery

If something goes wrong:

**1. Check system status**:
```bash
pm2 status
sudo systemctl status nginx
df -h
free -h
```

**2. View recent logs**:
```bash
pm2 logs tempest-backend --lines 50
sudo journalctl -n 50
```

**3. Nuclear option - restart everything**:
```bash
pm2 restart all
sudo systemctl restart nginx
```

**4. Last resort - reboot**:
```bash
sudo reboot
```

---

## Maintenance

### Daily
- Monitor PM2 status: `pm2 status`
- Check disk space: `df -h`

### Weekly
- Review logs: `pm2 logs tempest-backend --lines 100`
- Clean old logs: `pm2 flush`

### Monthly
- Update system: `sudo apt update && sudo apt upgrade -y`
- Clean old deployments: `rm -f ~/tempest-v*.tar.gz`
- Vacuum database: `sqlite3 ~/deployment/backend/data/weather.db "VACUUM;"`

---

## Security Notes

- Change default Pi password immediately
- Keep system updated regularly
- Keep your Tempest API token secure (don't commit .env to git)
- Consider setting up UFW firewall for production use
- Use SSH keys instead of passwords for better security

---

## Additional Resources

- **Tempest API**: https://weatherflow.github.io/Tempest/api/
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/usage/quick-start/
- **nginx Documentation**: https://nginx.org/en/docs/
- **Raspberry Pi Documentation**: https://www.raspberrypi.com/documentation/

---

## Quick Reference Commands

```bash
# Most common operations
pm2 restart tempest-backend           # Restart backend
pm2 logs tempest-backend              # View logs
sudo systemctl reload nginx           # Reload nginx
df -h                                 # Check disk space
curl http://localhost:3001/api/weather/current  # Test API

# Deployment from Mac
./scripts/auto-build-and-deploy.sh network   # Build + deploy to Pi
# Or build-only, then: scp build-output/tempest-v*.tar.gz user@your-pi.local:~/

# On Pi after transfer
tar -xzf tempest-v*.tar.gz
cd deployment/backend
npm install --production
pm2 restart tempest-backend

# Health check
free -m && vcgencmd get_mem gpu && pm2 status
```
