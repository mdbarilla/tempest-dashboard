# Tempest Deployment Cheat Sheet

**Quick Reference Card** - Keep this handy during deployment

---

## 🚀 DEPLOYMENT COMMANDS

### From Mac (Project Root)
```bash
# Network deploy (automatic)
./scripts/auto-build-and-deploy.sh network

# USB deploy (prepare files)
./scripts/auto-build-and-deploy.sh usb
```

### From Pi (USB Method)
```bash
sudo mount /dev/sda1 /mnt/usb
cd /mnt/usb
./deploy-from-usb.sh
```

---

## ✅ VERIFICATION (After Deploy)

```bash
# On Pi or via SSH:
pm2 status                                      # Should show "online"
pm2 logs tempest-backend --lines 20            # Check for errors
curl http://localhost:3001/api/weather/current # Should return JSON
```

---

## 🔑 ADD CREDENTIALS (Required)

```bash
ssh mbarilla@192.168.1.160
cd ~/deployment/backend

# Quick method (no editor):
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

# Replace placeholders:
sed -i 's/your_token_here/YOUR_ACTUAL_TOKEN/' .env
sed -i 's/your_station_id/YOUR_ACTUAL_ID/' .env

# Restart:
pm2 restart tempest-backend
```

---

## 🛠️ COMMON FIXES

| Problem | Command |
|---------|---------|
| Backend not running | `pm2 restart tempest-backend` |
| Dashboard blank | `sudo cp -r ~/deployment/dashboard/* /var/www/html/` |
| Out of space | `sudo journalctl --vacuum-time=7d && npm cache clean --force` |
| Check logs | `pm2 logs tempest-backend --lines 50` |
| Check status | `pm2 status && df -h && free -h` |

---

## 📡 CONNECTION TESTS

```bash
# From Mac - test Pi connection:
ping 192.168.1.160
ssh mbarilla@192.168.1.160 "echo OK"

# On Pi - test internet:
ping -c 3 8.8.8.8
curl https://api.weatherflow.com/
```

---

## 🎯 KEY FILES & LOCATIONS

| What | Location |
|------|----------|
| Backend code | `~/deployment/backend/` |
| Dashboard files | `~/deployment/dashboard/` |
| Environment config | `~/deployment/backend/.env` |
| Database | `~/deployment/backend/data/weather.db` |
| Nginx web root | `/var/www/html/` |
| Nginx config | `/etc/nginx/sites-available/default` |

---

## 🔄 SERVICE MANAGEMENT

```bash
# PM2 (backend)
pm2 restart tempest-backend
pm2 logs tempest-backend
pm2 status

# Nginx (frontend)
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

## 📊 SYSTEM STATUS

```bash
pm2 status           # Process status
df -h               # Disk space
free -h             # Memory
pm2 monit           # Live monitoring (q to quit)
```

---

## 🆘 EMERGENCY ROLLBACK

```bash
ssh mbarilla@192.168.1.160
pm2 stop tempest-backend
mv ~/deployment ~/deployment-broken
mv ~/deployment-backup-* ~/deployment
cd ~/deployment/backend
pm2 restart tempest-backend
```

---

## 🌐 ACCESS URLs

- **Dashboard**: http://192.168.1.160
- **API**: http://192.168.1.160:3001/api/weather/current
- **Local (on Pi)**: http://localhost

---

## 📝 DOCUMENTATION

1. **QUICK-DEPLOY.md** - Start here
2. **TROUBLESHOOTING-DEPLOY.md** - All issues covered
3. **PI-TERMINAL-COMMANDS.md** - Terminal reference
4. **build-output/DEPLOYMENT-SUMMARY.md** - Current build info

---

## ⌨️ KEYBOARD SHORTCUTS (Pi Terminal)

| Action | Keys |
|--------|------|
| Copy | `Ctrl+Shift+C` |
| Paste | `Ctrl+Shift+V` |
| Cancel | `Ctrl+C` |
| Save in nano | `Ctrl+O` then `Enter` |
| Exit nano | `Ctrl+X` |
| Search history | `Ctrl+R` |

---

## 🔍 QUICK DIAGNOSTIC

```bash
# Run this anytime to check everything:
ssh mbarilla@192.168.1.160 "pm2 status && echo '' && df -h | head -2 && echo '' && curl -s http://localhost:3001/api/weather/current | head -1"
```

---

## 💡 PRO TIPS

- **Tab completion**: Press Tab while typing to autocomplete
- **Command history**: Press ↑ to see previous commands
- **Long output**: Add `| less` to paginate (q to quit)
- **Multiple commands**: Chain with `&&`
- **Background tasks**: Add `&` at end

---

**Version**: v1.3.2
**Build**: 2026-01-19
**Pi IP**: 192.168.1.160
**Pi User**: mbarilla
