# LLM Feedback Tuning Guide

This doc describes how the atmosphere (LLM) feedback system works and how to use it for model tuning.

## Feedback Flow

1. **Thumbs down** → Opens follow-up modal with:
   - **Category** (select any): repetition bug, meta/garbled, incorrect conditions, too poetic, too generic, wrong time, forbidden words, wrong length, other
   - **Rewrite** (optional): User suggests a better description; stored for prompt tuning

2. **Backend** appends to `backend/data/llm_feedback.jsonl` with `label`, `category`, `rewrite`, and context (temp, humidity, condition, etc.)

3. **ai-bridge** loads:
   - Last 5 thumbs-down descriptions → `?bad_examples=` (injected into prompt as "DO NOT repeat")
   - Last 3 user rewrites → `?good_examples=` (injected as "User-preferred examples")

4. **Weather bridge** (Pi) receives these and includes them in the LLM prompt.

## Periodic Review

**Recommended: weekly or after ~20+ new feedback entries**

1. **Run the analyzer:**
   ```bash
   python3 scripts/analyze-llm-feedback.py backend/data/llm_feedback.jsonl
   ```

2. **Check category distribution:**
   - If **repetition** dominates → Consider increasing `repeat_penalty` in `weather_bridge.py` (e.g. 1.15 → 1.2)
   - If **meta_garbled** dominates → Ensure `_clean_llm_response` and `_has_meta_commentary` cover new variants
   - If **too_poetic** dominates → Adjust system prompt to prefer shorter, more factual phrasing
   - If **incorrect_conditions** dominates → Review condition/context passed to the LLM

3. **Review rewrites:**
   - User rewrites are high-signal: they show preferred phrasing
   - The bridge already injects the last 3 rewrites as "good examples"
   - If rewrites cluster around a theme (e.g. "crisp, breezy"), consider adding that style to the static example pool in `weather_bridge.py`

## Automation Options

- **Cron script**: Run `analyze-llm-feedback.py` weekly and email/slack a summary
- **Feedback threshold**: When `wc -l llm_feedback.jsonl` exceeds N, trigger a manual review
- **Auto-tune (advanced)**: Parse category counts and adjust `repeat_penalty` or prompt blocks via config—requires careful validation to avoid overfitting

## File Locations

- Feedback: `backend/data/llm_feedback.jsonl` (or `LLM_FEEDBACK_PATH`)
- Bridge prompt: `raspberry-pi/weather_bridge/weather_bridge.py` (generate_ai_prompt)
- AI bridge: `backend/services/ai-bridge.js` (loadRecentThumbsDown, loadRecentRewrites)

## Rebalancing Checklist

**When to run:** Weekly, or after ~20+ new feedback entries (check with `wc -l backend/data/llm_feedback.jsonl`).

### 1. Analyze feedback

```bash
cd "/Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest"

python3 scripts/analyze-llm-feedback.py backend/data/llm_feedback.jsonl
```

- [ ] Note top 3 categories
- [ ] If **repetition** > 30%: increase `repeat_penalty` in `weather_bridge.py` (e.g. 1.15 → 1.2)
- [ ] If **meta_garbled**: expand `_clean_llm_response` and `_has_meta_commentary` in `weather_bridge.py`
- [ ] If **too_poetic** or **too_generic**: adjust system prompt examples in `weather_bridge.py`
- [ ] Sample rewrites; consider adding common phrases to the static example pool in `weather_bridge.py`

### 2. Deploy weather bridge to Pi (if `weather_bridge.py` changed)

From the Tempest project root on your Mac:

```bash
cd "/Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest"

# Copy the script to the Pi
scp raspberry-pi/weather_bridge/weather_bridge.py mbarilla@towerhill.local:/home/mbarilla/weather_bridge/

# Restart the service on the Pi
ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge"
```

One-liner:

```bash
cd "/Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest" && scp raspberry-pi/weather_bridge/weather_bridge.py mbarilla@towerhill.local:/home/mbarilla/weather_bridge/ && ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge"
```

Verify (from Mac or Pi):

```bash
curl -s "http://towerhill.local:5000/weather" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ai_prompt:', d.get('ai_prompt','')[:60]+'…'); print('art_engine_status:', d.get('art_engine_status'))"
```

### 3. Restart Node backend (if `backend/services/ai-bridge.js` or `backend/api/weather.js` changed)

**If using `./scripts/run-local.sh` (local Mac):**

```bash
# In the terminal where it's running: Ctrl+C, then:
cd "/Users/mbarilla/Library/Mobile Documents/com~apple~CloudDocs/Projects/Tempest"

./scripts/run-local.sh
```

**If using PM2 on the Pi:**

```bash
ssh mbarilla@towerhill.local "pm2 restart all"
```

**If running backend alone:** Ctrl+C, then start it again (e.g. `cd backend && node server.js`).

### 4. Confirm in effect

```bash
# Force fresh atmosphere fetch
curl -s "http://localhost:3001/api/weather/complete?refresh_atmosphere=1" | python3 -c "import sys,json; d=json.load(sys.stdin); a=d.get('data',{}).get('atmosphere',{}); print('description:', a.get('description','')[:80])"
```

- [ ] Deploy bridge (step 2) if `weather_bridge.py` changed
- [ ] Restart Node backend (step 3) if ai-bridge or weather API changed
