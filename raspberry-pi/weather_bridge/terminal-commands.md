# Weather Bridge — terminal-commands (Mac vs Pi)

**Scope:** Weather-bridge (deploy/update `weather_bridge.py`, restart bridge, **restart Node backend**, logs, **see LLM output**, prompt, Mac curl/validate).  
For **general Pi terminal commands** (PM2, nginx, USB deploy, Chromium, etc.) see **`PI-TERMINAL-COMMANDS.md`** in the project root.

---

Run **Mac** commands from your Mac (Tempest project or any terminal that can reach the Pi).  
Run **Pi** commands over SSH: `ssh mbarilla@towerhill.local` (or from a shell already on the Pi).

---

## See the latest LLM output

The LLM writes to the `ai_prompt` field. It updates about every 10 minutes.

**On the Pi:**
```bash
curl -s http://localhost:5000/weather
# The JSON includes "ai_prompt": "Cold, clear, and calm at night" (or whatever the model returned).
```

**Just the ai_prompt (Pi):**
```bash
curl -s http://localhost:5000/weather | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ai_prompt',''))"
```

**On the Mac** (bridge at towerhill.local:5000):
```bash
curl -s "http://towerhill.local:5000/weather"
# or only ai_prompt:
curl -s "http://towerhill.local:5000/weather" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ai_prompt',''))"
```

**Via Node backend** (includes cache; use `?debug=1` or `?refresh_atmosphere=1` to reduce staleness):
```bash
curl -s "http://localhost:3001/api/weather/atmosphere?debug=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('debug',{}).get('body',{}).get('ai_prompt') or d.get('data',{}).get('description',''))"
```

**Why it’s stuck on "Conditions summary loading…"** — Use `?debug=1` and check `debug.body`:
- `art_engine_status: "waiting_udp"` → UDP 50222 has not received Tempest data; LLM loop is blocked.
- `art_engine_status: "running"` and `last_ai_error` set → Ollama/model failing; see `journalctl -u weather-bridge` and **README → Debugging: Dashboard stuck on "Conditions summary loading…"**.

---

## Deploy / update the bridge (Mac only)

From the **Tempest project root on your Mac**:

```bash
# Project root (quotes needed if path has spaces)
cd "/Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest"

# Copy the script to the Pi
scp raspberry-pi/weather_bridge/weather_bridge.py mbarilla@towerhill.local:/home/mbarilla/weather_bridge/

# Restart the service on the Pi
ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge"

# Confirm: ./scripts/ping-atmosphere.sh should show ollama_model (e.g. gemma3:270m). Then: ./scripts/ping-atmosphere.sh --reset
```

`scp` reads from **your Mac** and writes to the Pi. If you run `scp` from an SSH session on the Pi, the path `raspberry-pi/weather_bridge/weather_bridge.py` does not exist there, so the command fails.

---

## Pi commands (weather-bridge only)

```bash
# Restart the bridge (after deploying new weather_bridge.py)
sudo systemctl restart weather-bridge

# Status
sudo systemctl status weather-bridge

# Recent logs (including "AI Error" if the LLM fails)
sudo journalctl -u weather-bridge -n 80 --no-pager

# Follow logs
sudo journalctl -u weather-bridge -f

# Raw bridge output (JSON with ai_prompt, condition, temp, etc.)
curl -s http://localhost:5000/weather

# View the prompt (input to the LLM) in the installed script
grep -A 30 "def generate_ai_prompt" /home/mbarilla/weather_bridge/weather_bridge.py
```

---

## Restart the Node backend (after pulling backend changes)

After you pull changes to the **backend** (e.g. `backend/api/weather.js`, `backend/services/ai-bridge.js`), restart the Node backend so `/atmosphere?debug=1` builds `data` from the same response as `debug.body`. Otherwise you may see `data` and `debug.body` out of sync.

**If using `./scripts/run-local.sh`:**
```bash
# In the terminal where it’s running: Ctrl+C, then:
./scripts/run-local.sh
```

**If running backend alone** (e.g. `cd backend && node server.js`): Ctrl+C, then start it again.

**If using PM2 on the Pi:** see **`PI-TERMINAL-COMMANDS.md`** for `pm2 restart` (or `pm2 restart all`).

Check that the fix is in effect: `curl -s "http://localhost:3001/api/weather/atmosphere?debug=1"` and confirm `debug.dataSource === 'raw.body'`.

---

## Mac commands (weather-bridge + atmosphere)

```bash
# Backend + dashboard (from project root)
./scripts/run-local.sh

# Raw bridge output (Mac must reach the Pi; AI_BRIDGE_URL or default towerhill.local:5000)
curl -s "http://towerhill.local:5000/weather"

# Atmosphere from the Node backend (bypasses cache when debug=1)
curl -s "http://localhost:3001/api/weather/atmosphere?debug=1"

# Full /complete with forced fresh atmosphere
curl -s "http://localhost:3001/api/weather/complete?refresh_atmosphere=1" | head -c 2000

# Validation script (checks bridge, backend, /complete)
./scripts/validate-atmosphere.sh

# Ping LLM response (bridge + backend); --reset clears backend cache
./scripts/ping-atmosphere.sh
./scripts/ping-atmosphere.sh --reset
```

---

## Latest LLM prompt (input to the model, as of this doc)

**System message (s_msg):**

> You write brief, factual weather summaries. Output exactly one full sentence of 8–15 words. Do not start with 'The weather is' or 'The weather is currently' — state conditions directly. Forbidden: replying with only the condition name (e.g. 'Night.' 'Sunny.' 'Overcast.' 'Cloudy.') — that is wrong. Describe the feel: temperature, moisture, wind, sky. No numbers in your output. When an NWS alert or headline is provided, you MUST work it into the sentence (e.g. 'ahead of tomorrow's winter storm', 'with a winter storm warning in effect').

**User message (u_msg) — template; `{...}` are filled from the bridge:**

> Sensor condition: {condition}. Temp {temp}°C, humidity {humidity}%, wind {wind} m/s, precip {precip} mm. Write one full sentence (8–15 words). Bad: 'Night.' Good: 'Cold, clear, and calm at night.' Or: 'Overcast and humid with light wind.'
>
> *(If NWS:)* Active NWS: {nws_for_prompt}.  
> *(If NWS headline:)* NWS headline: {nws_headline_for_prompt}  
> *(If NWS:)* Good with NWS: 'The night is cold, clear and calm ahead of tomorrow's winter storm.'

**Safeguard:** If the model replies with only the condition (e.g. `Night.`), the bridge retries once with: *"Your last reply was only the condition name. Wrong. Write one full sentence of 8–15 words. Example: 'Cold, clear, and calm at night.'"* (retry uses temperature 0.6).

**To see the exact prompt in code:**

```bash
# On the Pi (installed script)
sed -n '/def generate_ai_prompt/,/threading.Event().wait/p' /home/mbarilla/weather_bridge/weather_bridge.py
```

```bash
# On the Mac (repo)
sed -n '/def generate_ai_prompt/,/threading.Event().wait/p' raspberry-pi/weather_bridge/weather_bridge.py
```

---

## One-liner: deploy from Mac

From **Mac**, project root:

```bash
scp raspberry-pi/weather_bridge/weather_bridge.py mbarilla@towerhill.local:/home/mbarilla/weather_bridge/ && ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge"
```
