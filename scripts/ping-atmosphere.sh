#!/bin/bash
# Ping the current LLM/atmosphere response from the bridge and backend. Optionally reset the backend cache.
#
# Usage: ./scripts/ping-atmosphere.sh [BACKEND_URL]
#        ./scripts/ping-atmosphere.sh --reset [BACKEND_URL]
#
# Prereqs: backend on Mac (e.g. ./scripts/run-local.sh). Bridge from AI_BRIDGE_URL or towerhill.local:5000.
# Run from the Tempest project (or pass BACKEND_URL).

RESET=0
while [[ "$1" == --reset ]]; do RESET=1; shift; done
BACKEND="${1:-http://localhost:3001}"
BRIDGE="${AI_BRIDGE_URL:-http://towerhill.local:5000}"

echo "=== 1. Bridge (raw) — $BRIDGE/weather ==="
curl -s --max-time 5 "${BRIDGE}/weather" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print('ai_prompt:    ', repr(d.get('ai_prompt')))
    print('condition:    ', d.get('condition'))
    print('art_engine_status:', d.get('art_engine_status'))
    print('last_ai_error:', d.get('last_ai_error'))
    if d.get('ollama_model'): print('ollama_model:  ', d.get('ollama_model'), '  ← if missing, Pi may be on old bridge code')
except Exception as e:
    print('Failed to reach or parse bridge:', e)
"

echo ""
echo "=== 2. Backend /atmosphere?debug=1 — $BACKEND ==="
curl -s --max-time 15 "${BACKEND}/api/weather/atmosphere?debug=1" -o /tmp/ping-atm.json
if [[ -f /tmp/ping-atm.json ]]; then
  python3 -c "
import json
raw=open('/tmp/ping-atm.json').read()
try:
    d=json.loads(raw)
    if d.get('debug',{}).get('body'):
        b=d['debug']['body']
        print('debug.body.ai_prompt:     ', repr(b.get('ai_prompt')))
        print('debug.body.condition:     ', b.get('condition'))
        print('debug.body.art_engine_status:', b.get('art_engine_status'))
        print('debug.body.last_ai_error: ', b.get('last_ai_error'))
        if b.get('ollama_model'): print('debug.body.ollama_model:', b.get('ollama_model'), '  ← confirms Pi has new bridge code')
    if d.get('data'):
        print('data.description (→ UI): ', repr(d['data'].get('description')))
    if d.get('error'):
        print('error:', d['error'])
except Exception as e:
    print('Failed:', e)
    print('Raw (first 900 chars):', repr(raw[:900]))
    if not raw or not raw.strip():
        print('(empty response — backend may have timed out or /atmosphere not reachable)')
" || (echo "Raw output:"; head -c 900 /tmp/ping-atm.json; echo "")
else
  echo "No response saved (curl may have failed)."
fi

if [[ "$RESET" == 1 ]]; then
  echo ""
  echo "=== 3. Reset (clear backend cache) ==="
  curl -s -X POST "${BACKEND}/api/weather/atmosphere/reset" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
    print(d.get('message', d.get('error', d)))
except: print(sys.stdin.read())
"
  echo ""
  echo "Backend cache cleared. Next /complete or /atmosphere will fetch fresh from the bridge."
  echo "To reset the bridge on the Pi (restart LLM loop): ssh mbarilla@towerhill.local \"sudo systemctl restart weather-bridge\""
fi
