# Tempest Rebuild & Deploy Walkthrough

Use this when you're stuck or want a full rebuild. Two paths: **auto script** or **manual via SSH**.

**Pi:** your host (e.g. `your-pi.local` or your Pi IP)  
**Paths on Pi:** `~/deployment/backend`, `~/deployment/dashboard` (nginx serves the latter)

---

## Option A: Auto-build script (recommended)

From your **Mac**, in the project root:

```bash
cd /path/to/tempest-dashboard
./scripts/auto-build-and-deploy.sh network
```

**What it does:**
1. Cleans `build-output/`, builds the React dashboard
2. Packages `deployment/` (backend + dashboard) into `build-output/tempest-v{VERSION}-{DATE}.tar.gz`
3. Copies the tarball to the Pi
4. On the Pi: backs up `~/deployment`, extracts tarball → `~/deployment/`, runs `npm install --production` in `~/deployment/backend`, restarts `tempest-backend` with pm2

**Your `backend/.env` is not in the tarball** — it stays on the Pi. The script only creates `.env` from `.env.example` if `.env` is missing.

**If the Pi is unreachable** (e.g. different network), use build-only and deploy manually:

```bash
./scripts/auto-build-and-deploy.sh build-only
```

Then follow **Option B** from "Transfer to Pi" onward, using the tarball in `build-output/`.

**Modes:**
- `network` (default) — build + scp + run deploy on Pi
- `build-only` — build + create tarball in `build-output/`; you transfer and run the rest yourself
- `usb` — prepare `build-output/usb-deploy/` for USB stick; run `deploy-from-usb.sh` on the Pi

---

## Option B: Manual rebuild via SSH

Do this if the script fails or you want to run each step yourself.

### On your Mac

**1. Build and create the tarball**

```bash
cd /path/to/tempest-dashboard
./scripts/auto-build-and-deploy.sh build-only
```

Tarball: `build-output/tempest-v*-*.tar.gz`

**2. Transfer to Pi**

```bash
scp build-output/tempest-v*.tar.gz user@your-pi.local:~/
# or: scp build-output/tempest-v*.tar.gz user@<your-pi-ip>:~/
```

### On the Pi (SSH)

```bash
ssh user@your-pi.local
```

**3. Backup existing deployment and .env (optional but safe)**

```bash
# full backup
[ -d ~/deployment ] && cp -r ~/deployment ~/deployment-backup-$(date +%Y%m%d-%H%M%S)

# keep .env if you're nervous
[ -f ~/deployment/backend/.env ] && cp ~/deployment/backend/.env ~/deployment-backup-.env
```

**4. Extract (overwrites `~/deployment` code; does not remove `backend/.env`)**

```bash
cd ~
tar -xzf tempest-v*.tar.gz
```

This creates/overwrites `~/deployment/` with `backend/` and `dashboard/`.  
`~/deployment/backend/.env` is **not** in the tarball, so it stays.

**5. Backend: install deps and restart**

```bash
cd ~/deployment/backend
npm install --production
pm2 restart tempest-backend
pm2 save
```

If you see "tempest-backend" doesn't exist:

```bash
pm2 start server.js --name tempest-backend
pm2 save
```

**6. (First time only) Create and edit .env**

```bash
# only if .env is missing
[ ! -f .env ] && cp .env.example .env && nano .env
```

Set at least: `TEMPEST_API_TOKEN`, `TEMPEST_STATION_ID`, `PORT=3001`, `NODE_ENV=production`. Then:

```bash
pm2 restart tempest-backend
pm2 save
```

**7. Reload nginx (only if you changed dashboard or nginx config)**

```bash
sudo systemctl reload nginx
```

nginx serves `~/deployment/dashboard`; the extract in step 4 already updated those files.

---

## Quick checks (on Pi or from Mac)

```bash
# from Mac
ssh user@your-pi.local "pm2 status"
ssh user@your-pi.local "pm2 logs tempest-backend --lines 20"

# API
curl http://your-pi.local:3001/api/weather/current

# Dashboard (through nginx)
curl -s -o /dev/null -w "%{http_code}" http://your-pi.local/
# expect 200
```

---

## If something's still wrong

- **502 / API down:** `pm2 status` and `pm2 logs tempest-backend`; ensure `~/deployment/backend/.env` has a valid `TEMPEST_API_TOKEN` and `TEMPEST_STATION_ID`.
- **Old dashboard / wrong files:**  
  - nginx should use `root /home/<your-user>/deployment/dashboard;`  
  - Check: `ssh user@your-pi.local "grep root /etc/nginx/sites-available/tempest"`  
  - If it points to `/var/www/html`, fix nginx to use `~/deployment/dashboard` and `sudo systemctl reload nginx`.
- **.env lost:**  
  - Restore from `~/deployment-backup-.env` if you made that copy, or  
  - `cp ~/deployment/backend/.env.example ~/deployment/backend/.env` and fill in token/station, then `pm2 restart tempest-backend`.

---

## One-liner (manual path, from Mac)

Assumes you already ran `build-only` and have `build-output/tempest-v*.tar.gz`:

```bash
cd /path/to/tempest-dashboard && \
F="$(ls build-output/tempest-v*.tar.gz 2>/dev/null | head -1)" && \
[ -n "$F" ] && scp "$F" user@your-pi.local:~/ && \
ssh user@your-pi.local "cd ~ && tar -xzf tempest-v*.tar.gz && cd deployment/backend && npm install --production && pm2 restart tempest-backend && pm2 save"
```

Then, if needed: `ssh user@your-pi.local "sudo systemctl reload nginx"`
