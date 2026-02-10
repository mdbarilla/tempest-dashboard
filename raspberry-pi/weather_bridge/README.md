# Weather Bridge (LLM / AI atmosphere)

Runs on the Pi: listens for Tempest UDP on 50222, runs Ollama (Gemma 3 270m by default) to generate short “atmospheric” descriptions, and serves `/weather` on port 5000. The Node backend `ai-bridge` calls `http://localhost:5000/weather` and merges `atmosphere` into `/api/weather/complete`.

**→ Mac vs Pi commands, how to see the latest LLM output, validate atmosphere, and current prompt:** **`terminal-commands.md`** (in this folder).

**→ Restart the Node backend** (after pulling backend changes): **`terminal-commands.md`** → section **"Restart the Node backend"**.

## Run on your Mac (no Pi)

To iterate on the LLM with the dashboard at localhost:3000 without the Pi:

1. In **backend/.env** set `AI_BRIDGE_URL=http://localhost:5000`.
2. In one terminal: `./scripts/run-weather-bridge-local.sh` (starts the bridge on port 5000 with mock data; requires Ollama + `gemma3:270m`).
3. In another: `./scripts/run-local.sh`. Open http://localhost:3000.

The script sets `USE_MOCK_OBS=1` so the bridge doesn’t wait for Tempest UDP and the LLM runs with mock observations. To use the Pi again, set `AI_BRIDGE_URL=http://towerhill.local:5000` and ensure the bridge is running on the Pi.

---

## Quick start from your Mac (deploy to Pi)

```bash
# 1) Copy the bridge to the Pi
scp -r raspberry-pi/weather_bridge mbarilla@towerhill.local:/home/mbarilla/

# 2) SSH in and install + start
ssh mbarilla@towerhill.local
cd /home/mbarilla/weather_bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Ensure Ollama + gemma3:270m:  ollama run gemma3:270m "x" then Ctrl+D  (or ollama pull gemma3:1b if using 1b)
sudo cp weather-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now weather-bridge
curl -s http://localhost:5000/weather
```

---

## Requirements on the Pi

- Python 3 with `flask`, `flask-cors`, `ollama`
- **Ollama** with the `gemma3:270m` model (or `gemma3:1b`; set `OLLAMA_MODEL` in `weather_bridge.py`)
- Tempest hub sending UDP to the Pi on port **50222** (same machine or forwarded)

## 1. Install Python deps

```bash
cd /home/mbarilla/weather_bridge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## 2. Install Ollama and pull the model

```bash
# Install Ollama (see https://ollama.ai)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model (one-time). Default bridge uses gemma3:270m.
ollama run gemma3:270m " Hi "
# (exit after it loads). Optional: ollama pull gemma3:1b and set OLLAMA_MODEL="gemma3:1b" in weather_bridge.py
```

## 3. Copy files to the Pi

From your Mac (project root):

```bash
scp -r raspberry-pi/weather_bridge mbarilla@towerhill.local:/home/mbarilla/
```

If your Pi user or home path is different, edit `weather-bridge.service` (`User`, `WorkingDirectory`, `ExecStart`).

## 4. Install and start the systemd service

On the Pi:

```bash
sudo cp /home/mbarilla/weather_bridge/weather-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable weather-bridge
sudo systemctl start weather-bridge
```

## 5. Check it’s running

```bash
sudo systemctl status weather-bridge
curl -s http://localhost:5000/weather
```

You should see JSON with `condition`, `ai_prompt`, etc. The first `ai_prompt` may be `"Initializing art engine..."` **after a bridge restart**, until the first LLM run (about every 10 minutes) and after the UDP listener has received data. If the dashboard shows this, it’s expected until the first run completes.

## Manual run (no systemd)

```bash
cd /home/mbarilla/weather_bridge
source venv/bin/activate
python3 weather_bridge.py
```

## NWS in the prompt

When the Node backend has NWS alerts, it calls `/weather?nws=EventName&nws_headline=...` (e.g. `Winter Storm Warning` and a truncated headline). The bridge stores `nws_for_prompt` and `nws_headline_for_prompt`; the next LLM cycle includes both in the user message so the model can produce factual summaries that reflect active watches and warnings.

## Logs

```bash
sudo journalctl -u weather-bridge -f
```

---

## Debugging: Dashboard stuck on "Conditions summary loading…"

The UI shows this when the bridge returns `ai_prompt: "Initializing art engine..."`. It stays that way until (a) the UDP listener has received at least one Tempest `obs_st` packet (or 50222 was in use at startup), and (b) the first Ollama run completes successfully.

**1. See bridge status and why it’s stuck**

From your **Mac** (backend uses `AI_BRIDGE_URL`, e.g. `http://towerhill.local:5000`):

```bash
curl -s "http://localhost:3001/api/weather/atmosphere?debug=1"
```

Inspect `debug.body`:

- **`art_engine_status: "waiting_udp"`** — The `generate_ai_prompt` thread is still blocked on `data_ready_event.wait()`. The UDP listener on 50222 has not received any `obs_st` from the Tempest (or the bridge was started before something else had 50222).  
  - Confirm the Tempest hub is sending UDP to this Pi’s IP on port **50222**.  
  - On the Pi: `sudo ss -ulnp | grep 50222` to see if the bridge is bound.

- **`art_engine_status: "running"` and `last_ai_error` is a string** — The LLM loop is running but Ollama is failing (model missing, OOM, etc.).  
  - On the Pi: `ollama run gemma3:270m "test"` then Ctrl+D.  
  - `journalctl -u weather-bridge -n 80 --no-pager` and look for `AI Error: ...`.

- **`art_engine_status: "running"` and `last_ai_error` is null** — UDP has been received and there’s no recent Ollama error. The first run may not have completed yet (loop sleeps 600s between runs). Wait a few minutes or check logs for `AI Error` / `AI returned empty...`.

**2. Direct check on the Pi**

```bash
curl -s http://localhost:5000/weather | python3 -m json.tool
```

Look at `ai_prompt`, `art_engine_status`, and `last_ai_error`.

**3. Bridge logs**

```bash
sudo journalctl -u weather-bridge -n 100 --no-pager
```

- `UDP 50222 in use` → Another process has 50222; the bridge sets `data_ready` and the LLM loop runs (no live Tempest UDP).  
- `AI Error: ...` → Ollama or the model failed; fix Ollama/model and restart.  
- `AI returned empty, too short, or condition-only` → LLM responded with something unusable. The bridge **retries once with a shorter prompt** when the first response is empty; if that also fails, it keeps the previous `ai_prompt` or uses "Condition summary unavailable."

**4. Backend cache**

The Node backend caches atmosphere for 10 minutes. To force a fresh fetch from the bridge:

```bash
curl -s "http://localhost:3001/api/weather/complete?refresh_atmosphere=1"
```

Or use the dashboard’s **Refresh atmosphere** button (when shown).

---

## Troubleshooting: `curl` shows nothing / no result

Run these **on the Pi** (where the bridge runs).

**1. Is the service running?**
```bash
sudo systemctl status weather-bridge
```
- If **inactive (failed)**: check the logs (step 2).
- If **active (running)**: try `curl -v http://127.0.0.1:5000/weather` (step 4).

**2. Recent logs (errors, import or Ollama issues):**
```bash
sudo journalctl -u weather-bridge -n 80 --no-pager
```

**3. Run by hand to see tracebacks:**
```bash
cd /home/mbarilla/weather_bridge
source venv/bin/activate
python3 weather_bridge.py
```
- If you see `ModuleNotFoundError: No module named 'ollama'` or `'flask'` → run `pip install -r requirements.txt` again.
- If you see `Address already in use` → something else is on port 5000: `ss -tlnp | grep 5000` or stop the other app.
- If it starts and prints `Running on http://0.0.0.0:5000`, in another terminal run `curl http://127.0.0.1:5000/weather`; you should get JSON. Stop the test with Ctrl+C.

**4. `curl` with `-v` (verbose):**
```bash
curl -v http://127.0.0.1:5000/weather
```
- **Connection refused** → bridge not listening: use steps 1–3.
- **Empty body or timeout** → bridge may be stuck; check `journalctl` and step 3.

**5. Port in use?**
```bash
ss -tlnp | grep 5000
# or:  sudo lsof -i :5000
```

**6. If you’re on your Mac (not the Pi):**  
`localhost` is your Mac. To hit the Pi’s bridge you need:
```bash
curl -v http://towerhill.local:5000/weather
```
(Only works if the Pi is on the same LAN and nothing blocks port 5000. The dashboard and Node backend use 80/3001; 5000 is only for the bridge and is not in nginx.)
