#!/bin/bash
# Restart Pi services after power outage (run on the Pi via SSH).
# Fixes: display "no signal", "unable to fetch weather data" (backend not running), "condition summary unavailable" (LLM/weather-bridge).
# Usage from Mac: ssh mbarilla@towerhill.local 'bash -s' < scripts/restart-pi-after-power.sh
# Or SSH in first, then: bash ~/deployment/scripts/restart-pi-after-power.sh

set -e
echo "=== Tempest Pi recovery (post power-outage) ==="

# 1. Restart backend (PM2)
echo ""
echo "1. Restarting backend..."
cd ~/deployment/backend || { echo "   Error: ~/deployment/backend not found"; exit 1; }
pm2 restart tempest-backend 2>/dev/null || pm2 start server.js --name tempest-backend
pm2 save
echo "   Backend: $(pm2 jlist | grep -o '"status":"[^"]*"' | head -1)"

# 2. Weather-bridge (Ollama/LLM) — skipped when disabled to reduce heat; re-enable with: sudo systemctl start weather-bridge && sudo systemctl enable weather-bridge
# if sudo systemctl restart weather-bridge 2>/dev/null; then echo "   Weather-bridge: $(systemctl is-active weather-bridge)"; else echo "   Weather-bridge: skipped (disabled)"; fi

# 2. Restart nginx (frontend)
echo ""
echo "2. Restarting nginx (dashboard)..."
sudo systemctl restart nginx
echo "   Nginx: $(systemctl is-active nginx)"

# 3. Relaunch kiosk (brings display back if X is running)
echo ""
echo "3. Relaunching kiosk..."
sudo pkill -9 chromium 2>/dev/null || true
rm -f ~/.config/chromium/SingletonLock 2>/dev/null || true
# Optional: clear cache if browser was sluggish (uncomment if needed)
# rm -rf ~/.cache/chromium 2>/dev/null || true
export DISPLAY=:0
nohup chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-restore-session-state --disable-dev-shm-usage http://localhost/ > /tmp/kiosk.log 2>&1 &
# Some Pi images use 'chromium' instead of 'chromium-browser'
if ! pgrep -x chromium-browser >/dev/null 2>&1; then
  nohup chromium --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-restore-session-state --disable-dev-shm-usage http://localhost/ > /tmp/kiosk.log 2>&1 &
fi
echo "   Kiosk started (check display)."

echo ""
echo "=== Quick health check ==="
curl -s -o /dev/null -w "   API (3001): %{http_code}\n" http://localhost:3001/api/weather/current || echo "   API: failed"
curl -s -o /dev/null -w "   Dashboard (80): %{http_code}\n" http://localhost/ || echo "   Dashboard: failed"
# Bridge/LLM (5000) skipped when Ollama disabled
# curl -s -o /dev/null -w "   Bridge/LLM (5000): %{http_code}\n" http://localhost:5000/weather 2>/dev/null || echo "   Bridge (5000): not running or failed"
echo ""
echo "Done. If display still shows 'no signal', try: sudo reboot"
