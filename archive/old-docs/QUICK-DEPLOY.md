# Tempest Quick Deployment Guide

## 🚀 Quick Start - Choose Your Method

### Method 1: Network Deployment (Recommended)
**Prerequisites**: Pi on network, SSH configured

```bash
# From Mac, in project root:
./scripts/auto-build-and-deploy.sh network
```

That's it! The script will:
- Build the React dashboard
- Package everything
- Transfer to Pi via SSH
- Install dependencies
- Restart services

**If .env needs credentials, you'll need to SSH once:**
```bash
ssh mbarilla@192.168.1.160
cd ~/deployment/backend
nano .env  # Add TEMPEST_API_TOKEN and TEMPEST_STATION_ID
pm2 restart tempest-backend
```

---

### Method 2: USB Deployment (No Network Needed)
**Prerequisites**: USB drive

```bash
# 1. On Mac, build and prepare USB files:
./scripts/auto-build-and-deploy.sh usb

# 2. Copy to USB:
cp -r build-output/usb-deploy/* /Volumes/YOUR_USB/

# 3. On Pi, insert USB and run:
sudo mkdir -p /mnt/usb
sudo mount /dev/sda1 /mnt/usb
cd /mnt/usb
./deploy-from-usb.sh

# 4. Follow prompts to edit .env
# 5. Unmount USB:
cd ~
sudo umount /mnt/usb
```

---

## 🔍 Quick Verification

After deployment, verify everything works:

```bash
# On Pi or via SSH:
pm2 status                                    # Should show "tempest-backend" as online
pm2 logs tempest-backend --lines 20          # Check for errors
curl http://localhost:3001/api/weather/current  # Test API

# From Mac browser:
open http://192.168.1.160                    # Should show dashboard
```

---

## ⚠️ Common Issues

### Can't SSH to Pi?
```bash
# Find Pi's IP:
# (On Pi terminal): hostname -I

# Test connection:
ping 192.168.1.160

# If fails, use USB method instead:
./scripts/auto-build-and-deploy.sh usb
```

### Need to add credentials after deployment?
```bash
ssh mbarilla@192.168.1.160
cd ~/deployment/backend

# Quick .env update without nano:
cat > .env << 'EOF'
TEMPEST_API_TOKEN=YOUR_TOKEN_HERE
TEMPEST_STATION_ID=YOUR_STATION_ID
TEMPEST_LATITUDE=42.3725
TEMPEST_LONGITUDE=-71.3161
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/weather.db
CACHE_CURRENT_WEATHER=60
CACHE_FORECAST=300
EOF

pm2 restart tempest-backend
```

### npm install fails?
```bash
# Free up space on Pi:
sudo journalctl --vacuum-time=7d
npm cache clean --force

# Retry deployment
```

### Dashboard not loading?
```bash
# Copy dashboard to nginx:
sudo cp -r ~/deployment/dashboard/* /var/www/html/
sudo systemctl restart nginx
```

---

## 📚 Full Documentation

- **Troubleshooting**: See `TROUBLESHOOTING-DEPLOY.md` (comprehensive guide)
- **Deployment Details**: See `DEPLOYMENT.md`
- **Pi Setup**: See `docs/raspberry-pi-setup.md`

---

## 🔄 Version History

Current version: **v1.3.2** (Jan 19, 2026)

Previous deployments:
```bash
ls tempest-v*.tar.gz  # See all built versions
```

---

## 💡 Pro Tips

### Automate future deploys
After first successful deployment, future deploys are one command:
```bash
./scripts/auto-build-and-deploy.sh network
```

### Keep USB as backup
Always keep latest USB deployment ready in case network fails:
```bash
./scripts/auto-build-and-deploy.sh usb
# Leave USB files on drive as emergency backup
```

### Check before deploying
```bash
# Verify Pi is accessible:
ping 192.168.1.160 && echo "✓ Pi is reachable"

# Verify SSH works:
ssh mbarilla@192.168.1.160 "echo '✓ SSH works'"
```

### Monitor after deployment
```bash
# Watch logs live:
ssh mbarilla@192.168.1.160 "pm2 logs tempest-backend"

# Check status periodically:
ssh mbarilla@192.168.1.160 "pm2 status && df -h"
```

---

## 🆘 Need Help?

1. Check `TROUBLESHOOTING-DEPLOY.md` - Covers all common issues
2. Run diagnostics:
   ```bash
   ssh mbarilla@192.168.1.160
   pm2 logs tempest-backend --lines 50
   pm2 describe tempest-backend
   ```
3. Verify .env credentials are correct
4. Check disk space: `df -h` (need 500MB+ free)
5. Restart services: `pm2 restart tempest-backend`

---

## 🎯 Deployment Checklist

Before deploying:
- [ ] Know Pi's IP address (default: 192.168.1.160)
- [ ] Have Tempest API token ready
- [ ] Have Tempest station ID ready
- [ ] SSH to Pi works (or have USB drive ready)
- [ ] Pi has at least 500MB free space

After deploying:
- [ ] `pm2 status` shows "online"
- [ ] `pm2 logs` shows no errors
- [ ] API responds: `curl http://localhost:3001/api/weather/current`
- [ ] Dashboard loads: `http://192.168.1.160`
- [ ] Weather data appears on dashboard

---

**Ready to deploy?** Run:
```bash
./scripts/auto-build-and-deploy.sh network
```

**Having network issues?** Run:
```bash
./scripts/auto-build-and-deploy.sh usb
```

**Just want to build?** Run:
```bash
./scripts/auto-build-and-deploy.sh build-only
```
