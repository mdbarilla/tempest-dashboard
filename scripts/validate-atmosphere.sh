#!/bin/bash
# Validate the AI atmosphere flow: bridge, backend, and /complete.
# Run this on your Mac (where the Node backend runs). The Pi is reached via AI_BRIDGE_URL (e.g. towerhill.local:5000).
# If you run from an SSH session on the Pi, localhost:3001 is the Pi (no backend there) and you will get 404.
#
# Prereqs: backend running (e.g. ./scripts/run-local.sh or node backend/server.js), Pi bridge at towerhill.local:5000.
#
# Usage: ./scripts/validate-atmosphere.sh [BACKEND_URL]
#   BACKEND_URL defaults to http://localhost:3001

set -e
BACKEND="${1:-http://localhost:3001}"
BRIDGE="${AI_BRIDGE_URL:-http://towerhill.local:5000}"

echo "=== 0. Pi bridge (raw) — from Mac, BRIDGE=$BRIDGE ==="
curl -s "${BRIDGE}/weather" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print('ai_prompt:', d.get('ai_prompt'))
    print('condition:', d.get('condition'))
except Exception as e:
    print('Failed to parse or reach bridge:', e)
" 2>/dev/null || curl -s "${BRIDGE}/weather" | head -c 300
echo -e "\nIf ai_prompt is still poetic (e.g. 'Dark, silent, and deep.'): deploy raspberry-pi/weather_bridge/weather_bridge.py to the Pi, then: sudo systemctl restart weather-bridge; wait 1–2 min."

echo -e "\n=== 1. Backend health ==="
curl -s "${BACKEND}/health" | head -c 200
echo -e "\n"

echo "=== 2. Atmosphere (debug, bypasses cache) — run from Mac; 404 means backend not on this machine or /atmosphere missing ==="
curl -s "${BACKEND}/api/weather/atmosphere?debug=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if 'error' in d and d.get('error')=='Not Found':
    print('ERROR: 404 Not Found. Run this script on your Mac (where the backend runs). On the Pi, localhost:3001 is the Pi, not the Mac.')
    sys.exit(1)
if 'debug' in d:
    db=d['debug']
    print('url:', db.get('url'))
    print('status:', db.get('status'), 'error:', db.get('error'))
    if db.get('body'):
        print('body.ai_prompt:', db['body'].get('ai_prompt'))
if 'data' in d and d['data']:
    print('data.description:', d['data'].get('description'))
else:
    print('data: (null)')
" 2>/dev/null || curl -s "${BACKEND}/api/weather/atmosphere?debug=1"

echo -e "\n=== 3. /complete?refresh_atmosphere=1 (forces fresh atmosphere, fixes stale cache) ==="
curl -s "${BACKEND}/api/weather/complete?refresh_atmosphere=1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if not d.get('success'):
    print('success: false', d.get('error'))
    sys.exit(1)
atm=d.get('data',{}).get('atmosphere')
if atm:
    print('atmosphere.description:', atm.get('description'))
    print('atmosphere.condition:', atm.get('condition'))
else:
    print('atmosphere: (null) — bridge unreachable, AI_BRIDGE_ENABLED=false, or bridge returned no ai_prompt')
" 2>/dev/null || curl -s "${BACKEND}/api/weather/complete?refresh_atmosphere=1" | head -c 500

echo -e "\n=== 4. UI ==="
echo "Open http://localhost:3000 (or the URL where the dashboard runs)."
echo "The 'Summary: <italic text>' appears only when: (1) host is local (localhost/towerhill.local/private IP), (2) data.atmosphere.description is non‑null."
echo "If it's missing: ensure backend runs on this Mac, AI_BRIDGE_URL=towerhill.local:5000 in backend/.env, and try ?refresh_atmosphere=1 on /complete or restart the backend to clear a cached null."
