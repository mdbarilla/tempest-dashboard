# Raspberry Pi Terminal Commands - Quick Reference

This guide is for working on the Raspberry Pi **without a mouse**, using only the terminal.

## 🖥️ Terminal Basics (No Mouse Needed)

### Essential Keyboard Shortcuts
| Action | Keys |
|--------|------|
| Copy text | `Ctrl+Shift+C` |
| Paste text | `Ctrl+Shift+V` |
| Cancel command | `Ctrl+C` |
| Exit program | `Ctrl+D` or `q` |
| Search in nano | `Ctrl+W` |
| Save in nano | `Ctrl+O`, then `Enter` |
| Exit nano | `Ctrl+X` |

---

## 📡 Network & Connection

### Find Pi's IP Address
```bash
hostname -I
# or
ip addr show wlan0 | grep inet
# or (ethernet)
ip addr show eth0 | grep inet
```

### Test Internet Connection
```bash
ping -c 3 8.8.8.8
ping -c 3 google.com
```

### Check Network Status
```bash
ifconfig
# or
ip addr
```

### Restart Network
```bash
sudo systemctl restart networking
# or for WiFi specifically
sudo systemctl restart wpa_supplicant
```

---

## 📦 Deployment Commands

### Deploy from Network (when build is ready)
**This happens automatically from Mac, but if you need to manually complete:**

```bash
# 1. Extract package
cd ~
tar -xzf tempest-v*.tar.gz

# 2. Install backend
cd deployment/backend
npm install --production

# 3. Configure environment (quick method, no editor)
cat > .env << 'EOF'
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=your_station_id
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
EOF

# 4. Edit credentials with sed (no editor needed)
sed -i 's/your_token_here/YOUR_ACTUAL_TOKEN/' .env
sed -i 's/your_station_id/YOUR_ACTUAL_STATION_ID/' .env

# 5. Start/restart backend
pm2 restart tempest-backend || pm2 start server.js --name tempest-backend
pm2 save

# 6. Update dashboard
sudo cp -r ../dashboard/* /var/www/html/
```

### Deploy from USB
```bash
# 1. Insert USB drive

# 2. Find USB device
lsblk
# Usually shows as /dev/sda1

# 3. Create mount point
sudo mkdir -p /mnt/usb

# 4. Mount USB
sudo mount /dev/sda1 /mnt/usb

# 5. Check files
ls /mnt/usb

# 6. Run deployment script
cd /mnt/usb
./deploy-from-usb.sh

# 7. Unmount when done
cd ~
sudo umount /mnt/usb
```

---

## 🔧 PM2 Process Management

### View All Processes
```bash
pm2 list
# or for more detail
pm2 status
```

### View Logs
```bash
# Live logs (Ctrl+C to exit)
pm2 logs tempest-backend

# Last 50 lines
pm2 logs tempest-backend --lines 50

# Specific number of lines
pm2 logs tempest-backend --lines 100
```

### Start Backend
```bash
cd ~/deployment/backend
pm2 start server.js --name tempest-backend
pm2 save
```

### Restart Backend
```bash
pm2 restart tempest-backend
```

### Stop Backend
```bash
pm2 stop tempest-backend
```

### Delete Process from PM2
```bash
pm2 delete tempest-backend
```

### Clear Logs
```bash
pm2 flush
```

### Detailed Process Info
```bash
pm2 describe tempest-backend
```

### Monitor Resources
```bash
pm2 monit
# Press 'q' to exit
```

### Save PM2 Configuration
```bash
pm2 save
```

---

## 📝 File Editing Without Mouse

### Edit .env File (nano method)
```bash
cd ~/deployment/backend
nano .env

# Inside nano:
# - Use arrow keys to navigate
# - Type to edit
# - Ctrl+O to save (then press Enter)
# - Ctrl+X to exit
```

### Edit .env File (no editor method)
```bash
cd ~/deployment/backend

# Create/overwrite entire file:
cat > .env << 'EOF'
TEMPEST_API_TOKEN=your_token_here
TEMPEST_STATION_ID=your_station_id
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
EOF

# Replace specific values:
sed -i 's/your_token_here/abc123xyz/' .env
sed -i 's/your_station_id/12345/' .env
```

### View File Contents
```bash
# View entire file
cat .env

# View with line numbers
cat -n .env

# View first 20 lines
head -20 .env

# View last 20 lines
tail -20 .env

# View with pagination (space=next page, q=quit)
less .env
```

### Search in File
```bash
# Search for text
grep "TEMPEST_API" .env

# Search case-insensitive
grep -i "token" .env
```

---

## 🌐 Nginx Web Server

### Check Nginx Status
```bash
sudo systemctl status nginx
# Press 'q' to exit
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

### Reload Nginx (no downtime)
```bash
sudo systemctl reload nginx
```

### Test Nginx Configuration
```bash
sudo nginx -t
```

### View Nginx Error Logs
```bash
sudo tail -50 /var/log/nginx/error.log
```

### Copy Dashboard Files
```bash
sudo cp -r ~/deployment/dashboard/* /var/www/html/
```

---

## 🧪 Testing & Verification

### Test Backend API
```bash
# Test current weather
curl http://localhost:3001/api/weather/current

# Pretty print JSON
curl http://localhost:3001/api/weather/current | python3 -m json.tool

# Test with full output
curl -v http://localhost:3001/api/weather/current
```

### Test Dashboard
```bash
# Check if HTML loads
curl http://localhost/

# Check specific file
curl http://localhost/index.html
```

### Test External Access
```bash
# Get your IP
hostname -I

# Test from Pi to itself
curl http://192.168.1.160/
curl http://192.168.1.160:3001/api/weather/current
```

---

## 💾 Disk & Memory Management

### Check Disk Space
```bash
# Overview
df -h

# Check specific directory size
du -sh ~/deployment
du -sh ~/deployment/*

# Find large files
du -h ~/deployment | sort -h | tail -20
```

### Free Up Space
```bash
# Clean old logs
sudo journalctl --vacuum-time=7d

# Clean old deployments
rm -rf ~/deployment-backup-*

# Clean old packages
rm -f ~/tempest-v*.tar.gz

# Clean npm cache
npm cache clean --force

# Clean apt cache
sudo apt-get clean
```

### Check Memory
```bash
# Show memory usage
free -h

# Show swap usage
swapon --show

# Detailed memory info
cat /proc/meminfo
```

### Increase Swap
```bash
# Stop swap
sudo dphys-swapfile swapoff

# Edit swap config
sudo nano /etc/dphys-swapfile
# Change: CONF_SWAPSIZE=2048
# Save: Ctrl+O, Enter, Ctrl+X

# Recreate swap
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Verify
free -h
```

---

## 🔍 System Monitoring

### Check Running Processes
```bash
# Simple list
ps aux

# Filter for node
ps aux | grep node

# Interactive view (press 'q' to exit)
top
# or better:
htop
```

### Check System Resources
```bash
# CPU temperature (under 80°C is healthy)
vcgencmd measure_temp

# Throttling history (0x0 = OK; non-zero = throttling or undervoltage since boot)
vcgencmd get_throttled

# CPU frequency
vcgencmd measure_clock arm

# Memory split
vcgencmd get_mem arm
vcgencmd get_mem gpu
```

### View System Logs
```bash
# Last 50 system log entries
sudo journalctl -n 50

# Follow system logs live
sudo journalctl -f
# Press Ctrl+C to stop

# Logs from last boot
sudo journalctl -b
```

---

## 🔄 Service Management

### View Service Status
```bash
sudo systemctl status nginx
sudo systemctl status ssh
```

### Restart Services
```bash
sudo systemctl restart nginx
sudo systemctl restart ssh
```

### Enable Service at Boot
```bash
sudo systemctl enable nginx
```

### Disable Service at Boot
```bash
sudo systemctl disable nginx
```

---

## 🛠️ Database Commands

### Check Database
```bash
cd ~/deployment/backend

# Check if database exists
ls -lh data/weather.db

# Get database info
sqlite3 data/weather.db "SELECT COUNT(*) FROM weather_data;"

# View recent entries
sqlite3 data/weather.db "SELECT * FROM weather_data ORDER BY timestamp DESC LIMIT 5;"

# Exit sqlite3 prompt
# Type: .quit
```

### Initialize Database
```bash
cd ~/deployment/backend
node scripts/init-database.js
```

---

## 📋 Quick Diagnostics Script

Save this as a single command to get full system status:

```bash
cat > ~/check-tempest.sh << 'EOF'
#!/bin/bash
echo "╔════════════════════════════════════════════════╗"
echo "║   Tempest System Status                        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "=== PM2 Status ==="
pm2 list
echo ""
echo "=== Disk Space ==="
df -h | grep -E "Filesystem|/dev/root"
echo ""
echo "=== Memory ==="
free -h
echo ""
echo "=== Backend Logs (last 10 lines) ==="
pm2 logs tempest-backend --lines 10 --nostream
echo ""
echo "=== Nginx Status ==="
sudo systemctl status nginx --no-pager -l
echo ""
echo "=== API Test ==="
curl -s http://localhost:3001/api/weather/current | python3 -c "import sys, json; data=json.load(sys.stdin); print('✓ API responding' if data else '✗ API error')"
echo ""
echo "=== Network ==="
hostname -I
echo ""
EOF

chmod +x ~/check-tempest.sh
```

Run anytime with:
```bash
~/check-tempest.sh
```

---

## 🆘 Emergency Commands

### Condition summary unavailable (LLM / weather-bridge)
Restart the weather-bridge service (Ollama + Flask on port 5000):
```bash
sudo systemctl restart weather-bridge
```
From Mac: `ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge"`. Then reload the dashboard or use Reset atmosphere so the backend fetches fresh data.

### Dashboard shows "Unable to fetch weather data"
Backend (tempest-backend) is not running—common after power outage or reboot:
```bash
cd ~/deployment/backend
pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
pm2 save
```
Reload the dashboard; data should appear. From Mac in one shot:
```bash
ssh mbarilla@towerhill.local "cd ~/deployment/backend && (pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend) && pm2 save"
```

### Restart Pi services after power outage (from Mac)
```bash
cd /Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest
ssh mbarilla@towerhill.local 'bash -s' < scripts/restart-pi-after-power.sh
```

### If System is Unresponsive
```bash
# Force restart PM2
pm2 kill
pm2 start ~/deployment/backend/server.js --name tempest-backend

# Restart nginx
sudo systemctl restart nginx

# Reboot Pi (last resort)
sudo reboot
```

### If Deployment Failed
```bash
# Restore backup
mv ~/deployment ~/deployment-broken
mv ~/deployment-backup-* ~/deployment
cd ~/deployment/backend
pm2 restart tempest-backend
```

### If Out of Space
```bash
# Nuclear option - clean everything
sudo apt-get autoremove -y
sudo apt-get clean
npm cache clean --force
sudo journalctl --vacuum-time=3d
rm -rf ~/deployment-backup-*
rm -f ~/tempest-v*.tar.gz
```

---

## 📤 Remote Access from Mac

### SSH to Pi
```bash
ssh mbarilla@192.168.1.160
```

### Run Single Command
```bash
ssh mbarilla@192.168.1.160 "pm2 status"
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend --lines 20"
```

### Copy File to Pi
```bash
scp file.tar.gz mbarilla@192.168.1.160:~/
```

### Copy File from Pi
```bash
scp mbarilla@192.168.1.160:~/deployment/backend/.env ~/Desktop/
```

---

## 🎯 Most Common Commands (Cheat Sheet)

```bash
# === After every deployment ===
pm2 status                                          # Check if running
pm2 logs tempest-backend --lines 20                # Check for errors
curl http://localhost:3001/api/weather/current     # Test API

# === Edit credentials ===
cd ~/deployment/backend
nano .env                                           # Ctrl+O to save, Ctrl+X to exit
pm2 restart tempest-backend                        # Restart after changes

# === Check system health ===
df -h                                               # Disk space
free -h                                             # Memory
pm2 monit                                           # Live monitoring (q to quit)

# === Fix common issues ===
pm2 restart tempest-backend                        # Backend not responding
sudo systemctl restart nginx                        # Dashboard not loading
npm cache clean --force                             # npm issues
sudo journalctl --vacuum-time=7d                   # Free space

# === View logs ===
pm2 logs tempest-backend                           # Live logs (Ctrl+C to stop)
sudo tail -50 /var/log/nginx/error.log            # Nginx errors
```

---

## 💡 Tips for Terminal-Only Work

1. **Use tab completion**: Start typing and press Tab to autocomplete
2. **Use history**: Press ↑ arrow to see previous commands
3. **Search history**: Press `Ctrl+R` then type to search command history
4. **Use `less` for long output**: `pm2 logs --lines 200 | less` (q to quit)
5. **Chain commands**: `cd ~/deployment/backend && pm2 restart tempest-backend`
6. **Save common commands**: Add aliases to `~/.bashrc`
   ```bash
   echo "alias check-tempest='pm2 status && df -h'" >> ~/.bashrc
   source ~/.bashrc
   ```

---

**Need to see this file on Pi?**
```bash
# View this guide on Pi:
cat ~/deployment/raspberry-pi/terminal-commands-reference.md | less
# or
nano ~/deployment/raspberry-pi/terminal-commands-reference.md
```
