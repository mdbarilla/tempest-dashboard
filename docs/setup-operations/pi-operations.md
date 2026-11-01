# Raspberry Pi Operations & Maintenance Guide

**Version**: 1.9.0  
**Last Updated**: 2026-11-01  
**Prepared for**: mbarilla

---

## 1. Overview

A modern, high-performance weather dashboard designed for Raspberry Pi. It utilizes the Tempest Weather API for real-time data. The Pi is mounted on the back of a Pimoroni Inky Impression 7.3 (Spectra 6 e-ink) and redraws the `/eink` page every 5 minutes; it boots to console with no HDMI display or desktop.

---

## 2. Technical Stack

- **Hardware**: Raspberry Pi 4 (2GB+ RAM recommended)
- **OS**: Raspberry Pi OS (64-bit preferred)
- **Backend**: Node.js 20.x, Express, PM2 (Process Management)
- **Frontend**: React-based dashboard served via Nginx
- **Display**: Inky Impression 7.3 (800x480, 6-colour Spectra). `eink-update.timer` runs `~/deployment/eink/inky_push.py`, which screenshots `http://localhost/eink` with headless Chromium and pushes it to the panel
- **Networking**: Configured for towerhill.local via Avahi/mDNS (`use-ipv6=no` avoids a host-name conflict at boot). Fallback: `ssh towerhill-ip` (192.168.1.163)

---

## 3. Operations & Maintenance

### E-ink Display

The panel redraws on boot (+90s) and every 5 minutes on the clock. A redraw takes ~30s and the panel flashes while it updates; this is normal. Refreshes are skipped when nothing visible changed (the "Updated" time is ignored), but the screen is always redrawn at least every 30 minutes. The page switches to a white-on-black theme between sunset and sunrise.

**A stale "Updated" time means the renderer isn't running.** If the data fails to load, the last good image is kept for up to an hour before the error page is shown.

```bash
systemctl list-timers eink-update.timer        # next/last run
journalctl -u eink-update -n 20                # recent results ("refreshed panel", "no visible change", errors)
sudo systemctl start eink-update.service       # refresh now (skips if unchanged)
~/.virtualenvs/pimoroni/bin/python ~/deployment/eink/inky_push.py --force   # always redraw
~/.virtualenvs/pimoroni/bin/python ~/deployment/eink/inky_push.py --force --url "http://localhost/eink?theme=dark"  # preview a theme
sudo systemctl stop eink-update.timer          # pause refreshes (start to resume)
```

The last captured and last shown images are in `~/.local/state/eink/` (`capture.png`, `last.png`). Preview layout changes on the Mac with `raspberry-pi/eink/preview.sh`.

**Hardware check:** `cd ~/Pimoroni/inky/examples && ~/.virtualenvs/pimoroni/bin/python identify.py` should report "Spectra 6 7.3 800 x 480 (E673)". "Failed to detect an Inky board" means I2C is off or the header isn't fully seated. The side buttons A–D are on GPIO 5/6/16/24 (`spectra6/buttons.py` prints presses to the terminal).

### Post-Reboot / Post Power-Outage Recovery

**From your Mac (recommended):** run the project’s restart script over SSH so the backend, nginx, and e-ink display all come back:

```bash
cd /path/to/Tempest
ssh mbarilla@towerhill.local 'bash -s' < scripts/restart-pi-after-power.sh
```

**Or on the Pi (SSH in first):**

1. **Start Backend** (fixes “Unable to fetch weather data” when tempest-backend isn’t running):
   ```bash
   cd ~/deployment/backend
   pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
   pm2 save
   ```

2. **Restart nginx** (dashboard):
   ```bash
   sudo systemctl restart nginx
   ```

3. **Redraw the e-ink display**:
   ```bash
   ~/.virtualenvs/pimoroni/bin/python ~/deployment/eink/inky_push.py --force
   ```

### System Hardening (Stability Fixes)

These settings are applied to prevent system freezes:

- **Emergency Reboot**: Enabled via `kernel.sysrq=1` in `/etc/sysctl.conf`
- **Boot to console**: No desktop session or Chromium kiosk (`raspi-config` Boot → Console). The old autostart entry is kept as `~/.config/autostart/dashboard.desktop.disabled-20261101`
- **PM2 on boot**: `pm2-mbarilla.service` resurrects `tempest-backend` after a reboot
- **GPU Memory**: `gpu_mem=256` is commented out in `/boot/firmware/config.txt`; it was only needed for the HDMI kiosk

---

## 4. Troubleshooting (CRITICAL)

### Preventative: Memory Optimization (OOM Prevention)

**REQUIRED**: To prevent "Hard Freezes" where the clock stops and SSH fails:

1. Open config:
   ```bash
   sudo nano /etc/dphys-swapfile
   ```

2. Set `CONF_SWAPSIZE=1024`

3. Restart service:
   ```bash
   sudo /etc/init.d/dphys-swapfile restart
   ```

### "Unable to fetch weather data" (Dashboard loads but no data)

Usually means **tempest-backend** is not running (e.g. after power loss or reboot):

1. Check PM2:
   ```bash
   pm2 list
   ```

2. Start or restart the backend:
   ```bash
   cd ~/deployment/backend
   pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
   pm2 save
   ```

3. Reload the dashboard in the browser; data should appear.

### "Condition summary unavailable" (LLM / weather-bridge)

The condition summary line comes from the **weather-bridge** service on the Pi (Ollama LLM). If it shows "Condition summary unavailable" or stays on "loading", restart the bridge:

```bash
sudo systemctl restart weather-bridge
```

Check status: `sudo systemctl status weather-bridge`. Then reload the dashboard or use "Reset atmosphere" in the UI so the backend fetches fresh data from the bridge.

### The "502 Bad Gateway" Error

If Nginx loads but the dashboard is empty or shows 502:

1. Check if backend is running:
   ```bash
   pm2 status
   ```

2. Restart backend:
   ```bash
   pm2 restart tempest-backend
   ```

### Thermal and fan (overheating / throttling)

If the Pi feels very hot or the display freezes, check temperature and throttling:

```bash
vcgencmd measure_temp      # e.g. temp=83.2'C — above 80°C means throttling
vcgencmd get_throttled     # 0x0 = OK; non-zero = throttling or undervoltage occurred
```

**Decode `get_throttled`:** `0x50000` = throttled (temp); `0x50005` = throttling + undervoltage. Any non-zero means the Pi has reduced CPU/GPU due to heat or weak power.

**No fan (since 2026-11-01):** The Vilros case and its GPIO fan were removed when the Pi was mounted on the Inky Impression, which uses the whole 40-pin header. Without the kiosk the load is light (35–45°C observed after the swap).

- **Target:** under 70°C with `get_throttled` = `0x0`. Check regularly during the first week, and again after the Pi goes into a frame.
- **Cooling tips:** Keep stick-on heatsinks on the Pi, leave vents in the frame's back panel, and use the official 5V 3A power supply.
- **If it throttles:** Add a USB-powered 5V fan (the GPIO pins are taken) and keep weather-bridge disabled.

**Reduce heat by disabling the LLM (condition summary):** If the condition summary is not mission critical, stopping the weather-bridge (Ollama) greatly reduces CPU load and heat:

```bash
sudo systemctl stop weather-bridge
sudo systemctl disable weather-bridge   # optional: don’t start it on boot
```

The dashboard will show “Condition summary unavailable” but all other weather data stays. Re-enable with `sudo systemctl enable weather-bridge` and `sudo systemctl start weather-bridge` when desired.

### E-ink Display Not Updating

1. Check the last runs: `journalctl -u eink-update -n 20`
   - `capture failed: page not ready` → the dashboard or backend isn't serving; check `curl -I localhost/eink` and `pm2 list`.
   - `Failed to detect an Inky board` → reseat the header (power off first).
   - `no visible change; skipping refresh` → working as intended.
2. Make sure the timer is enabled: `sudo systemctl enable --now eink-update.timer`
3. Force a redraw: `~/.virtualenvs/pimoroni/bin/python ~/deployment/eink/inky_push.py --force`

Captures normally take ~3s. If they take ~25s, Chromium is waiting for a desktop keyring; `inky_push.py` passes `--password-store=basic` to avoid this.

---

## 5. Hardware & Emergency Controls

- **Safe Reboot (Keyboard)**: Hold Alt + PrintScreen, then slowly type R E I S U B
- **Hard Reset**: Only unplug power if the "Safe Reboot" fails and the system is unresponsive to Ping/SSH

---

## 6. Final System Health Check

Run these to verify a healthy setup:

```bash
free -m                  # Verify Swap (e.g. 1024 or 2047 MB)
pm2 list                  # Verify tempest-backend is online
systemctl list-timers eink-update.timer   # Verify the e-ink refresh is scheduled
vcgencmd measure_temp     # Under 70°C is the target without a fan; over 80 = throttling
vcgencmd get_throttled    # 0x0 = no throttling; non-zero = heat or undervoltage
```

---

## 7. Log of Successful Remediation (2026-01-22)

The following steps were performed to resolve the "SSH Timeout/Hard Freeze" issue:

1. **Emergency Hardware Power Cycle**: Performed to regain initial access
2. **Swap Expansion**: Increased `CONF_SWAPSIZE` from 100 to 1024 to provide sufficient virtual memory for Chromium
3. **Kernel Hardening**: Enabled `sysctl kernel.sysrq` to allow keyboard-based emergency reboots
4. **GPU Memory Reallocation**: Manually edited `/boot/firmware/config.txt` to set `gpu_mem=256` for improved UI rendering stability
5. **Cache Purge**: Cleared `~/.cache/chromium` to ensure a clean browser state
6. **Persistence Check**: Successfully verified `pm2 save` to ensure the weather backend auto-starts on boot

## 8. E-ink Migration (2026-11-01)

1. Backed up the Pi to the Mac (`~/Backups/towerhill-pi/2026-11-01-pre-inky/`)
2. Installed the Pimoroni inky library (`~/.virtualenvs/pimoroni`) and enabled SPI/I2C (`config.txt` backed up)
3. Removed the Vilros case and fan; mounted the Pi on the Inky Impression standoffs
4. Deployed the `/eink` page and installed `eink-update.service`/`.timer`
5. Disabled the Chromium kiosk autostart, switched boot to console, and commented out `gpu_mem=256`
6. Pointed `GARDEN_DB_PATH` at `~/deployment/garden-data/data/garden.db` (merged Mac + Pi garden data)

---

**Last Updated**: 2026-11-01
