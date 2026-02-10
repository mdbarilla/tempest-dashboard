# Tempest Deployment Troubleshooting Guide

This guide addresses common issues encountered when deploying to Raspberry Pi, especially when working without a mouse and only terminal access.

## Quick Reference: Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Can't SSH to Pi | Check IP with `ping 192.168.1.160`, verify Pi is on network |
| SSH asks for password | Run `./setup-ssh-key.sh` to configure passwordless login |
| npm install fails | Check disk space: `df -h`, clear cache: `npm cache clean --force` |
| pm2 not found | Install: `sudo npm install -g pm2` |
| Backend won't start | Check logs: `pm2 logs tempest-backend`, verify .env file |
| Dashboard not loading | Check nginx: `sudo systemctl status nginx`, verify files in `/var/www/html/` |
| API returns 500 errors | Check .env credentials, verify database: `ls -la ~/deployment/backend/data/` |
| Out of memory | Increase swap: `sudo dphys-swapfile swapoff && sudo nano /etc/dphys-swapfile` |

---

## Pre-Deployment Checklist

Before starting deployment, verify:

### On Your Mac
- [ ] Project builds successfully: `cd apps/dashboard && npm run build`
- [ ] Backend dependencies installed: `cd backend && npm install`
- [ ] You have Tempest API credentials ready
- [ ] You know the Pi's IP address (default: 192.168.1.160)
- [ ] SSH works: `ssh mbarilla@192.168.1.160` (should not ask for password)

### On Raspberry Pi (if accessible)
- [ ] Pi is powered on and connected to network
- [ ] Sufficient disk space: `df -h` (need at least 500MB free)
- [ ] Node.js installed: `node --version` (should be v18+)
- [ ] npm available: `npm --version`
- [ ] PM2 installed: `pm2 --version` (if not: `sudo npm install -g pm2`)
- [ ] Nginx installed: `nginx -v` (if not: `sudo apt-get install nginx`)

---

## Deployment Method Selection

### When to Use Network Deployment
✅ Use when:
- Pi is on the same network as your Mac
- SSH is working
- You want fastest deployment
- You want automated deployment

❌ Don't use when:
- Pi is not on network or you don't know its IP
- SSH is not configured or not working
- Network is unstable

### When to Use USB Deployment
✅ Use when:
- Network deployment fails
- Pi is not on network
- SSH issues are difficult to resolve
- You prefer physical media transfer
- You want offline deployment capability

❌ Don't use when:
- You don't have a USB drive available
- Pi's USB ports are not accessible

---

## Issue 1: Cannot Connect to Raspberry Pi

### Symptoms
- `ssh: connect to host 192.168.1.160 port 22: Connection refused`
- `ssh: connect to host 192.168.1.160 port 22: No route to host`
- `ssh: Could not resolve hostname: Name or service not known`

### Diagnosis Steps

1. **Verify Pi is powered on**
   - Check power LED is lit
   - Check activity LED blinks occasionally

2. **Find Pi's IP address** (without mouse, from Pi terminal):
   ```bash
   # On Pi terminal:
   hostname -I
   # or
   ip addr show wlan0 | grep inet
   # or (for ethernet)
   ip addr show eth0 | grep inet
   ```

3. **Verify network connectivity from Mac**:
   ```bash
   ping 192.168.1.160
   # Should see replies
   ```

4. **Check if SSH is running on Pi**:
   ```bash
   # On Pi terminal:
   sudo systemctl status ssh
   # Should show "active (running)"
   ```

### Solutions

**Solution A: Restart SSH service on Pi**
```bash
# On Pi terminal:
sudo systemctl restart ssh
sudo systemctl enable ssh
```

**Solution B: Re-enable SSH on Pi**
```bash
# On Pi terminal:
sudo raspi-config
# Navigate to: Interface Options → SSH → Enable
```

**Solution C: Switch to USB deployment**
```bash
# On Mac:
./scripts/auto-build-and-deploy.sh usb
```

**Solution D: Use static IP on Pi**
```bash
# On Pi terminal:
sudo nano /etc/dhcpcd.conf

# Add at bottom:
interface wlan0
static ip_address=192.168.1.160/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Save and reboot:
sudo reboot
```

---

## Issue 2: SSH Asks for Password / Key Issues

### Symptoms
- SSH prompts for password every time
- `Permission denied (publickey,password)`
- Auto-deploy script fails at transfer step

### Diagnosis
```bash
# Check if SSH key exists on Mac:
ls -la ~/.ssh/id_ed25519.pub

# Try manual SSH with verbose:
ssh -v mbarilla@192.168.1.160
```

### Solutions

**Solution A: Set up SSH keys**
```bash
# On Mac, from project root:
./setup-ssh-key.sh

# Or manually:
ssh-keygen -t ed25519 -C "tempest-deploy"
ssh-copy-id mbarilla@192.168.1.160
```

**Solution B: Fix SSH directory permissions on Pi**
```bash
# On Pi terminal:
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

**Solution C: Use password authentication temporarily**
```bash
# On Pi terminal:
sudo nano /etc/ssh/sshd_config
# Ensure this line exists:
PasswordAuthentication yes

sudo systemctl restart ssh
```

---

## Issue 3: npm install Fails on Pi

### Symptoms
- `ENOSPC: no space left on device`
- `npm ERR! code EACCES`
- Package installation hangs or times out
- `gyp ERR!` errors during sqlite3 installation

### Diagnosis
```bash
# On Pi terminal:
df -h          # Check disk space
free -h        # Check memory
npm cache verify   # Check npm cache
```

### Solutions

**Solution A: Free up disk space**
```bash
# On Pi terminal:
# Clean old logs
sudo journalctl --vacuum-time=7d

# Clean old deployments
rm -rf ~/deployment-backup-*
rm -f ~/tempest-v*.tar.gz

# Clean npm cache
npm cache clean --force

# Check space again
df -h
```

**Solution B: Increase swap space**
```bash
# On Pi terminal:
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Change: CONF_SWAPSIZE=2048

sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

**Solution C: Use --no-optional flag**
```bash
# On Pi terminal, in deployment/backend:
npm install --production --no-optional
```

**Solution D: Pre-build sqlite3 (if gyp errors)**
```bash
# On Pi terminal:
sudo apt-get install -y python3 make g++
cd ~/deployment/backend
npm install --build-from-source --production
```

---

## Issue 4: PM2 Not Found or Won't Start

### Symptoms
- `bash: pm2: command not found`
- `pm2 start server.js` fails
- Backend process won't stay running

### Diagnosis
```bash
# On Pi terminal:
which pm2
pm2 --version
pm2 list
```

### Solutions

**Solution A: Install PM2 globally**
```bash
# On Pi terminal:
sudo npm install -g pm2

# Configure PM2 to start on boot:
pm2 startup
# Follow the displayed command (will be something like):
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u mbarilla --hp /home/mbarilla
```

**Solution B: Fix PM2 permissions**
```bash
# On Pi terminal:
rm -rf ~/.pm2
pm2 kill
pm2 start ~/deployment/backend/server.js --name tempest-backend
pm2 save
```

**Solution C: Check PM2 logs for errors**
```bash
# On Pi terminal:
pm2 logs tempest-backend --lines 50
pm2 describe tempest-backend
```

**Solution D: Start backend manually (troubleshooting)**
```bash
# On Pi terminal:
cd ~/deployment/backend
NODE_ENV=production node server.js
# Watch for errors in output
```

---

## Issue 5: Environment Variables Not Set

### Symptoms
- Backend starts but API returns errors
- `Error: TEMPEST_API_TOKEN is required`
- Weather data not loading

### Diagnosis
```bash
# On Pi terminal:
cd ~/deployment/backend
cat .env  # Check if file exists
pm2 env tempest-backend  # Check PM2's environment
```

### Solutions

**Solution A: Create .env file (terminal-only, no nano)**
```bash
# On Pi terminal:
cd ~/deployment/backend

# Create .env using heredoc (no editor needed):
cat > .env << 'EOF'
TEMPEST_API_TOKEN=your_actual_token_here
TEMPEST_STATION_ID=your_station_id_here
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
EOF

# Replace the placeholder values:
sed -i 's/your_actual_token_here/YOUR_REAL_TOKEN/' .env
sed -i 's/your_station_id_here/YOUR_REAL_STATION_ID/' .env

# Restart backend:
pm2 restart tempest-backend
```

**Solution B: Use nano editor**
```bash
# On Pi terminal:
cd ~/deployment/backend
cp .env.example .env
nano .env
# Edit values, then: Ctrl+X, Y, Enter to save

pm2 restart tempest-backend
```

**Solution C: Verify .env is loaded**
```bash
# On Pi terminal:
cd ~/deployment/backend
pm2 restart tempest-backend --update-env
pm2 logs tempest-backend --lines 20
# Should NOT see "TEMPEST_API_TOKEN is required"
```

---

## Issue 6: Dashboard Not Loading (Nginx Issues)

### Symptoms
- `curl http://192.168.1.160` returns 404 or connection refused
- White screen when accessing Pi's IP in browser
- Dashboard shows "Cannot reach server"

### Diagnosis
```bash
# On Pi terminal:
sudo systemctl status nginx
curl http://localhost
ls -la /var/www/html/
```

### Solutions

**Solution A: Install/restart Nginx**
```bash
# On Pi terminal:
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**Solution B: Copy dashboard files to nginx**
```bash
# On Pi terminal:
sudo cp -r ~/deployment/dashboard/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
sudo systemctl restart nginx
```

**Solution C: Configure Nginx for Tempest**
```bash
# On Pi terminal:
sudo nano /etc/nginx/sites-available/default

# Replace contents with:
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;
    index index.html;

    server_name _;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Save and test config:
sudo nginx -t
sudo systemctl reload nginx
```

**Solution D: Check firewall**
```bash
# On Pi terminal:
sudo ufw status
# If active, allow HTTP:
sudo ufw allow 80/tcp
sudo ufw allow 3001/tcp
```

---

## Issue 7: API Works But Returns Empty/Error Data

### Symptoms
- `curl http://192.168.1.160:3001/api/weather/current` returns `{}`
- API returns 500 errors
- PM2 logs show API errors

### Diagnosis
```bash
# On Pi terminal:
pm2 logs tempest-backend --lines 50
cd ~/deployment/backend
cat .env  # Verify credentials
curl -v http://localhost:3001/api/weather/current
```

### Solutions

**Solution A: Verify Tempest API credentials**
```bash
# Test API manually:
TOKEN="your_token_here"
STATION_ID="your_station_id"

curl "https://swd.weatherflow.com/swd/rest/observations/station/${STATION_ID}?token=${TOKEN}"

# Should return JSON with weather data
```

**Solution B: Check database**
```bash
# On Pi terminal:
cd ~/deployment/backend
ls -la data/
# Should see weather.db

# If missing, initialize:
node scripts/init-database.js
```

**Solution C: Clear cache and restart**
```bash
# On Pi terminal:
pm2 restart tempest-backend
pm2 flush  # Clear PM2 logs
sleep 5
pm2 logs tempest-backend --lines 30
```

**Solution D: Check network connectivity from Pi**
```bash
# On Pi terminal:
ping -c 3 8.8.8.8  # Test internet
curl https://api.weatherflow.com/  # Test Tempest API access
```

---

## Issue 8: Out of Memory / Pi Freezes

### Symptoms
- Pi becomes unresponsive during npm install
- SSH connection drops during deployment
- `ENOMEM` errors in logs

### Solutions

**Solution A: Increase swap before deployment**
```bash
# On Pi terminal (before deploying):
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Set: CONF_SWAPSIZE=2048

sudo dphys-swapfile setup
sudo dphys-swapfile swapon
free -h  # Verify swap is active
```

**Solution B: Close other processes**
```bash
# On Pi terminal:
# Stop Chromium if running:
pkill chromium

# Stop old PM2 processes:
pm2 stop all
pm2 delete all

# Check memory:
free -h
```

**Solution C: Deploy in stages**
```bash
# On Pi terminal:
# 1. Extract only
tar -xzf tempest-vX.X.X-*.tar.gz

# 2. Install backend deps with limited concurrency:
cd deployment/backend
npm install --production --prefer-offline --no-audit --maxsockets 1

# 3. Start backend:
pm2 start server.js --name tempest-backend
```

---

## USB Deployment Walkthrough (Terminal Only)

If network deployment fails, use USB method:

### Step 1: Prepare USB on Mac
```bash
# On Mac:
./scripts/auto-build-and-deploy.sh usb

# This creates: build-output/usb-deploy/
# Copy that folder to USB drive:
cp -r build-output/usb-deploy/* /Volumes/YOUR_USB/
```

### Step 2: Mount USB on Pi
```bash
# On Pi terminal:
# Find USB device:
lsblk
# Usually /dev/sda1

# Create mount point:
sudo mkdir -p /mnt/usb

# Mount USB:
sudo mount /dev/sda1 /mnt/usb

# Verify:
ls /mnt/usb
# Should see tempest-vX.X.X-*.tar.gz and deploy-from-usb.sh
```

### Step 3: Run deployment
```bash
# On Pi terminal:
cd /mnt/usb
./deploy-from-usb.sh

# Follow prompts to edit .env
```

### Step 4: Unmount USB
```bash
# On Pi terminal:
cd ~
sudo umount /mnt/usb
# Now safe to remove USB
```

---

## Post-Deployment Verification

After any deployment method, verify everything works:

```bash
# On Pi terminal:

# 1. Check PM2 status
pm2 status
# Should show "tempest-backend" as "online"

# 2. Check backend logs
pm2 logs tempest-backend --lines 20
# Should NOT show errors

# 3. Test API locally
curl http://localhost:3001/api/weather/current
# Should return JSON with weather data

# 4. Test dashboard locally
curl http://localhost/
# Should return HTML

# 5. Check nginx
sudo systemctl status nginx
# Should show "active (running)"

# 6. Verify database
ls -la ~/deployment/backend/data/weather.db
# Should exist and have recent timestamp

# 7. Check disk space
df -h
# Should have at least 200MB free
```

From your Mac:
```bash
# Test from external network
curl http://192.168.1.160:3001/api/weather/current
curl http://192.168.1.160/

# Or open in browser:
open http://192.168.1.160
```

---

## Emergency Rollback

If deployment fails and you need to restore previous version:

```bash
# On Pi terminal:
pm2 stop tempest-backend

# Find backup
ls -d ~/deployment-backup-* | tail -1

# Restore
mv ~/deployment ~/deployment-broken
mv $(ls -d ~/deployment-backup-* | tail -1) ~/deployment

# Restart
cd ~/deployment/backend
pm2 restart tempest-backend || pm2 start server.js --name tempest-backend
```

---

## Getting Help

If issues persist:

1. **Gather diagnostic info**:
```bash
# On Pi, run:
cat > ~/tempest-diagnostics.txt << 'EOF'
=== SYSTEM INFO ===
$(uname -a)
$(cat /etc/os-release)

=== DISK SPACE ===
$(df -h)

=== MEMORY ===
$(free -h)

=== NODE/NPM ===
$(node --version)
$(npm --version)

=== PM2 STATUS ===
$(pm2 list)

=== PM2 LOGS ===
$(pm2 logs tempest-backend --lines 50 --nostream)

=== NGINX STATUS ===
$(sudo systemctl status nginx)

=== ENV FILE ===
$(ls -la ~/deployment/backend/.env)
$(cat ~/deployment/backend/.env | sed 's/TEMPEST_API_TOKEN=.*/TEMPEST_API_TOKEN=***REDACTED***/g')

=== NETWORK ===
$(ip addr show)
$(ping -c 3 8.8.8.8)
EOF

cat ~/tempest-diagnostics.txt
```

2. **Review this diagnostics file**
3. **Check project documentation**:
   - `DEPLOYMENT.md`
   - `docs/raspberry-pi-setup.md`
   - `CHANGELOG.md`

---

## Common Commands Reference

### Deployment
```bash
# Network deploy (from Mac):
./scripts/auto-build-and-deploy.sh network

# USB deploy (from Mac):
./scripts/auto-build-and-deploy.sh usb

# Build only (from Mac):
./scripts/auto-build-and-deploy.sh build-only
```

### PM2 Management
```bash
pm2 list                          # Show all processes
pm2 logs tempest-backend          # Show live logs
pm2 logs tempest-backend --lines 50  # Show last 50 lines
pm2 restart tempest-backend       # Restart backend
pm2 stop tempest-backend          # Stop backend
pm2 delete tempest-backend        # Remove from PM2
pm2 monit                        # Monitor resources
pm2 save                         # Save process list
```

### Nginx Management
```bash
sudo systemctl status nginx       # Check status
sudo systemctl restart nginx      # Restart nginx
sudo systemctl reload nginx       # Reload config
sudo nginx -t                    # Test config
```

### SSH
```bash
ssh mbarilla@192.168.1.160       # Connect to Pi
scp file.tar.gz mbarilla@192.168.1.160:~/  # Copy file
```

### Disk Management
```bash
df -h                            # Disk usage
du -sh ~/deployment              # Folder size
ncdu ~/deployment                # Interactive disk usage
```
