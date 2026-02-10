# Raspberry Pi Operations & Maintenance Guide

**Version**: 1.8.1  
**Last Updated**: 2026-01-30  
**Prepared for**: mbarilla

---

## 1. Overview

A modern, high-performance weather dashboard designed for Raspberry Pi. It utilizes the Tempest Weather API for real-time data and is optimized for 24/7 kiosk operation.

---

## 2. Technical Stack

- **Hardware**: Raspberry Pi 4 (2GB+ RAM recommended)
- **OS**: Raspberry Pi OS (64-bit preferred)
- **Backend**: Node.js 20.x, Express, PM2 (Process Management)
- **Frontend**: React-based dashboard served via Nginx
- **Networking**: Configured for towerhill.local via Avahi/mDNS

---

## 3. Operations & Maintenance

### CRITICAL: Terminal Visibility

If text is too small to read on a high-res display:

- **Desktop Terminal**: Click window → Control + Shift + +
- **Permanent Fix**: Right-click Terminal → Preferences → Style → Font Size 24+

### Post-Reboot / Post Power-Outage Recovery

**From your Mac (recommended):** run the project’s restart script over SSH so backend, nginx, and kiosk all come back:

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

3. **Launch kiosk** (if display is blank):
   ```bash
   export DISPLAY=:0
   chromium --kiosk http://towerhill.local &
   ```

### System Hardening (Stability Fixes)

These settings are applied to prevent system freezes:

- **Emergency Reboot**: Enabled via `kernel.sysrq=1` in `/etc/sysctl.conf`
- **GPU Memory**: Set to 256MB in `/boot/firmware/config.txt`
- **Clean Start**: Run `rm -rf ~/.cache/chromium` before launching if the browser acts sluggish

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

**Vilros case fan (aluminum case with pre-installed fan):**

- The fan is powered from the Pi’s GPIO (typically **pin 4 = 5V** and **pin 6 = GND**). It runs whenever the Pi is on; there is no software switch.
- **Confirm it’s working:** With the Pi powered and case closed, you should hear a light whir and feel warm exhaust from the vents. If you can open the case safely (power off first), power back on and watch the fan — the blade should spin.
- **If the fan doesn’t spin:** Power off, unplug the 2-pin connector from the GPIO header, then plug it firmly onto **pin 4 (5V)** and **pin 6 (GND)** — the two pins in the top-right of the 40-pin header (pins 4 and 6 are the second pair from the top). Ensure the red wire is on 5V and black on GND if the cable is marked.
- **Cooling tips:** Keep the case vents clear, avoid enclosed cabinets, and ensure the official 5V 3A power supply is used.

**Reduce heat by disabling the LLM (condition summary):** If the condition summary is not mission critical, stopping the weather-bridge (Ollama) greatly reduces CPU load and heat:

```bash
sudo systemctl stop weather-bridge
sudo systemctl disable weather-bridge   # optional: don’t start it on boot
```

The dashboard will show “Condition summary unavailable” but all other weather data stays. Re-enable with `sudo systemctl enable weather-bridge` and `sudo systemctl start weather-bridge` when desired.

### Sudden Kiosk Crash

1. Clear Locks:
   ```bash
   sudo pkill -9 chromium
   rm -f ~/.config/chromium/SingletonLock
   ```

2. Relaunch:
   ```bash
   export DISPLAY=:0
   chromium --kiosk --noerrdialogs --disable-infobars --disable-restore-session-state --disable-dev-shm-usage http://towerhill.local &
   ```

---

## 5. Hardware & Emergency Controls

- **Safe Reboot (Keyboard)**: Hold Alt + PrintScreen, then slowly type R E I S U B
- **Terminal Toggle**: Ctrl + Alt + F2 (Console) / Ctrl + Alt + F7 (Desktop)
- **Hard Reset**: Only unplug power if the "Safe Reboot" fails and the system is unresponsive to Ping/SSH

---

## 6. Final System Health Check

Run these to verify a healthy setup:

```bash
free -m                  # Verify Swap (e.g. 1024 or 2047 MB)
pm2 list                  # Verify tempest-backend is online
vcgencmd get_mem gpu      # Verify gpu=256M
vcgencmd measure_temp     # Under 80°C is healthy; over 80 = throttling
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

---

**Last Updated**: 2026-01-30
