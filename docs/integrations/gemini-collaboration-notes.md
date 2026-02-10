# Gemini Collaboration Notes - AI Weather Bridge

*Knowledge transfer from Gemini chat session (January 2026)*

## Project Overview

The goal was to create a high-end, minimalist weather kiosk for a Raspberry Pi that integrates real-time hardware data from a WeatherFlow Tempest Station with a local LLM (Gemma 3 270m) to generate "Atmospheric Descriptions."

---

## The Backend: Python Weather Bridge

The bridge is a Python script running as a systemd service. It performs three critical roles:

1. **UDP Listener**: Intercepts raw weather broadcasts on port 50222
2. **Atmospheric Logic**: Handles specific edge cases (like detecting snow when sensors show 0.0 precipitation)
3. **AI Generator**: Sends context to a local Ollama instance to generate sensory art prompts

### Full Code: `weather_bridge.py`

```python
import socket, json, threading, ollama
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

weather_store = {
    "temp": 0, "humidity": 0, "pressure": 0,
    "lux": 0, "precip": 0, "wind": 0,
    "condition": "Waiting for Station...",
    "ai_prompt": "Initializing art engine..."
}

data_ready_event = threading.Event()

def calculate_condition(lux, precip, temp, humidity):
    # Snow Detection Logic: Cold enough and high moisture saturation
    if temp <= 2 and humidity > 85: return "Snow Possible"
    if precip > 0: return "Snowing" if temp <= 1 else "Raining"

    # Standard Conditions
    if lux > 40000: return "Sunny"
    if lux > 10000: return "Partly Cloudy"
    if lux > 1000: return "Overcast"
    return "Night" if lux < 500 else "Cloudy"

def udp_listener():
    global weather_store
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.settimeout(5)
        s.bind(('', 50222))
        while True:
            try:
                data, _ = s.recvfrom(1024)
                packet = json.loads(data)
                if packet.get('type') == 'obs_st':
                    obs = packet['obs'][0]
                    # Index mapping per WeatherFlow UDP v143
                    weather_store.update({
                        "pressure": obs[6], "temp": obs[7], "humidity": obs[8],
                        "lux": obs[9], "precip": obs[12], "wind": obs[2],
                        "condition": calculate_condition(obs[9], obs[12], obs[7], obs[8])
                    })
                    data_ready_event.set()
            except: continue

def generate_ai_prompt():
    global weather_store
    data_ready_event.wait()
    while True:
        try:
            # Poetic Interior Designer Persona
            s_msg = "You are an atmospheric designer. Output ONLY a 10-word sensory description. No numbers."
            u_msg = f"Mood: {weather_store['condition']}. Stats: {weather_store['temp']}C, {weather_store['humidity']}% hum. Style: Minimalist."

            response = ollama.chat(model='gemma3:270m', messages=[
                {'role': 'system', 'content': s_msg},
                {'role': 'user', 'content': u_msg}
            ], options={'temperature': 0.8})

            weather_store["ai_prompt"] = response['message']['content'].strip().split('\n')[0]
        except Exception as e:
            print(f"AI Error: {e}")
        threading.Event().wait(600) # Update art prompt every 10 mins

@app.route('/weather')
def get_weather():
    return jsonify(weather_store)

if __name__ == '__main__':
    threading.Thread(target=udp_listener, daemon=True).start()
    threading.Thread(target=generate_ai_prompt, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, threaded=True)
```

---

## Frontend Integration Concept (Gemini Proposal)

Gemini proposed a UI using Glassmorphism and Dynamic Gradients to reflect the mood of the AI prompt.

### UI Concept: "Atmospheric Mapping"
- **Background**: A CSS gradient mapped to `data.condition`
- **Card**: `backdrop-blur-2xl` with `bg-white/10`
- **Polling**: Every 30 seconds via `useEffect`

### Example React Hook: `useWeather.js`

```javascript
import { useState, useEffect } from 'react';

export const useWeather = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = async () => {
    try {
      const response = await fetch('http://<PI_IP_ADDRESS>:5000/weather');
      const json = await response.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      console.error("Bridge Connection Error", err);
    }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading };
};
```

---

## Key Lessons & Troubleshooting History

### The "Literal AI" Bug
Initially, the LLM repeated temperatures (e.g., "Night, -3.51C").

**Solution**: Use a System Prompt that strictly forbids numbers and include a one-shot example in the user message.

### The "Snow" Problem
Tempest hardware uses a haptic rain sensor that often misses light snow.

**Solution**: Implemented a logical override - if temperature is ≤ 2°C and humidity is > 85%, the system reports "Snow Possible."

### CORS Errors
**Solution**: Required the installation of `flask-cors` to allow the React frontend on port 3000 to talk to the Flask backend on port 5000.

---

## Deployment Instructions

### Service Persistence
Use systemctl to keep the bridge running:
```bash
sudo systemctl restart weather-bridge.service
```

### Monitoring
View logs with:
```bash
sudo journalctl -u weather-bridge.service -f
```

### Dependencies
- `ollama`
- `flask`
- `flask-cors`

---

## NWS-Aware Prompts (Node → Python)

The Node `ai-bridge` calls the bridge with `?nws=EventName` when NWS alerts exist (e.g. `Winter Storm Warning`). To feed that into the LLM:

1. In `get_weather()`, do:  
   `nws_context = request.args.get('nws')`  
   and store it in a module-level variable (e.g. `nws_for_prompt = nws_context`) so the background thread can read it.
2. In `generate_ai_prompt()`, when building `u_msg`, append  
   `+ (f" NWS: {nws_for_prompt}." if nws_for_prompt else "")`  
   so the model can incorporate active watches/warnings.

---

## Design Direction Decision

After reviewing the Gemini collaboration, we decided to:

1. **Keep** the Python weather bridge architecture (it works well)
2. **Keep** the LLM atmospheric description feature
3. **Reject** the full Tailwind/glassmorphism redesign (too heavy, risks "AI slop" aesthetic)
4. **Adapt** the visual effects to be subtle CSS overlays that layer on the existing day/night theme system

See [plan-1.4.0-ai-features.md](../plans/plan-1.4.0-ai-features.md) for the final implementation plan.
