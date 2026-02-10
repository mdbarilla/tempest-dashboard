# 1.4.0 Plan: AI Atmospheric Descriptions

## Summary
Integrate the Python/Flask weather bridge (running on Pi port 5000 with Gemma 3 270m) into the existing React dashboard to display LLM-generated "atmospheric descriptions" and subtle condition-based visual effects while preserving the minimal, typography-focused aesthetic.

---

## Architecture Decision: Proxy Through Node.js Backend

**Recommendation**: Route AI bridge requests through the existing Node.js backend rather than direct React-to-Python calls.

**Rationale**:
- Single API surface for frontend (`:3001` only)
- No CORS configuration needed for Python bridge
- Backend can cache AI prompts (10-min) separately from weather data (60-sec)
- Graceful degradation: weather data always returns even if AI bridge is down
- Python bridge stays internal-only (not exposed to browser)

**Data Flow**:
```
[Tempest Hub] --UDP:50222--> [weather_bridge.py:5000]
                                     |
                                     v (internal HTTP)
[React:3000] <--HTTP--> [Node.js:3001] ---> [weather_bridge.py:5000]
```

---

## Implementation Phases

### Phase 1: Backend Integration

**New file**: `backend/services/ai-bridge.js`
- Fetch from `http://localhost:5000/weather`
- 10-minute cache using NodeCache
- 3-second timeout to prevent blocking
- Returns `null` gracefully when bridge unavailable

**Modify**: `backend/api/weather.js`
- Merge `atmosphere` object into `/complete` response:
```json
{
  "current": {...},
  "forecast": {...},
  "atmosphere": {
    "description": "A hush, a whisper, the softest glow of night.",
    "condition": "Snow Possible",
    "source": "local_llm"
  }
}
```

**Environment variables** (`.env`):
```
AI_BRIDGE_URL=http://localhost:5000
AI_BRIDGE_TIMEOUT=3000
AI_BRIDGE_ENABLED=true
```

---

### Phase 2: Frontend - Display Atmospheric Description

**Modify**: `apps/dashboard/src/App.js`
- Pass `atmosphere={weatherData.atmosphere}` to `CurrentWeather` component

**Modify**: `apps/dashboard/src/components/CurrentWeather.js`
- Add atmospheric description below conditions text:
```jsx
{atmosphere?.description && (
  <div className="atmospheric-description">
    {atmosphere.description}
  </div>
)}
```

**Add CSS** to `CurrentWeather.css`:
```css
.atmospheric-description {
  font-size: 0.9375rem;
  font-style: italic;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  max-width: 28ch;
  opacity: 0;
  animation: fadeInAtmosphere 0.8s ease-out 0.3s forwards;
}

@keyframes fadeInAtmosphere {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Visual hierarchy** (unchanged structure, new element inserted):
1. Temperature (Fraunces, 6-11rem)
2. Conditions ("Snow Possible")
3. **Atmospheric Description** (italic, secondary) ← NEW
4. High/Low temps
5. Feels Like

---

### Phase 3: Condition-Based Visual Effects ~~(DEPRECATED 2026-02-07)~~

> **Deprecated**: Condition-based ambient overlays have been deprecated. This section is kept for historical reference only.

**Design Philosophy**: Keep the day/night theme system as the foundation. Add tasteful "nods" to current conditions through subtle overlays, gradients, and accent colors - not full palette replacements. Think Apple Weather's sophistication, but constrained to what runs well on Pi.

**Approach**: CSS overlay gradients + accent color tweaks via `data-condition` attribute

**Modify**: `apps/dashboard/src/App.js`
```javascript
useEffect(() => {
  if (weatherData?.atmosphere?.condition) {
    const condition = weatherData.atmosphere.condition.toLowerCase();
    let category = 'default';
    if (condition.includes('snow') || condition.includes('ice') || condition.includes('frost')) category = 'snow';
    else if (condition.includes('rain') || condition.includes('drizzle')) category = 'rain';
    else if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) category = 'fog';
    else if (condition.includes('clear') || condition.includes('sunny')) category = 'clear';
    else if (condition.includes('cloud') || condition.includes('overcast')) category = 'cloudy';
    document.documentElement.setAttribute('data-condition', category);
  }
}, [weatherData?.atmosphere?.condition]);
```

**Add to** `styles/index.css`:
```css
/* Condition-based ambient overlays - applied as subtle gradients */
/* These layer ON TOP of day/night themes, not replace them */

/* Snow/Ice - cool crystalline overlay */
:root[data-condition="snow"] {
  --condition-gradient: radial-gradient(ellipse at top, rgba(200, 220, 240, 0.08) 0%, transparent 60%);
  --condition-accent: #a8c8e8;
}
body.theme-dark[data-condition="snow"] {
  --condition-gradient: radial-gradient(ellipse at top, rgba(180, 200, 230, 0.06) 0%, transparent 60%);
  --condition-accent: #8ab4d4;
}

/* Rain - moody blue-gray wash */
:root[data-condition="rain"] {
  --condition-gradient: linear-gradient(180deg, rgba(120, 140, 160, 0.06) 0%, transparent 40%);
  --condition-accent: #7a8a9a;
}
body.theme-dark[data-condition="rain"] {
  --condition-gradient: linear-gradient(180deg, rgba(100, 120, 150, 0.08) 0%, transparent 40%);
  --condition-accent: #6a7a8a;
}

/* Fog/Mist - diffused white veil */
:root[data-condition="fog"] {
  --condition-gradient: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.12) 0%, transparent 70%);
  --condition-accent: #c0c0c0;
}
body.theme-dark[data-condition="fog"] {
  --condition-gradient: radial-gradient(ellipse at center, rgba(200, 200, 210, 0.06) 0%, transparent 70%);
  --condition-accent: #9a9aaa;
}

/* Clear/Sunny - warm golden tint */
:root[data-condition="clear"] {
  --condition-gradient: radial-gradient(ellipse at top right, rgba(255, 220, 180, 0.08) 0%, transparent 50%);
  --condition-accent: #d4a86a;
}
body.theme-dark[data-condition="clear"] {
  --condition-gradient: radial-gradient(ellipse at top right, rgba(200, 180, 140, 0.04) 0%, transparent 50%);
  --condition-accent: #b4986a;
}

/* Cloudy/Overcast - neutral, minimal shift */
:root[data-condition="cloudy"] {
  --condition-gradient: linear-gradient(180deg, rgba(180, 180, 180, 0.04) 0%, transparent 30%);
  --condition-accent: var(--text-secondary);
}

/* Default - no overlay */
:root[data-condition="default"], :root:not([data-condition]) {
  --condition-gradient: none;
  --condition-accent: var(--accent-blue);
}

/* Apply the ambient overlay to the app background */
.app::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--condition-gradient, none);
  pointer-events: none;
  z-index: 0;
  transition: background 2s ease;
}

.app > * {
  position: relative;
  z-index: 1;
}
```

**Visual Effect Breakdown**:
| Condition | Light Mode | Dark Mode | Notes |
|-----------|------------|-----------|-------|
| Snow/Ice | Cool blue radial at top | Subtle blue glow | Crystalline, icy feel |
| Rain | Gray-blue linear from top | Deeper moody wash | Overcast atmosphere |
| Fog/Mist | Diffused white center | Soft gray veil | Hazy, obscured |
| Clear/Sunny | Warm gold at top-right | Subtle amber | Golden hour warmth |
| Cloudy | Minimal gray wash | Near-invisible | Neutral, doesn't compete |

**Upcoming Snowstorm Test**: Perfect opportunity to validate the snow overlay. If the effect feels right during heavy snow, we've nailed the balance.

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/services/ai-bridge.js` | NEW - AI bridge communication service |
| `backend/api/weather.js` | Merge atmosphere data into /complete |
| `backend/server.js` | Import ai-bridge service |
| `apps/dashboard/src/App.js` | Pass atmosphere prop, set data-condition |
| `apps/dashboard/src/components/CurrentWeather.js` | Display atmospheric description |
| `apps/dashboard/src/components/CurrentWeather.css` | Styles for description |
| `apps/dashboard/src/styles/index.css` | Condition-based color variables |
| `CHANGELOG.md` | Document v1.4 features |

---

## Error Handling

1. **Bridge unavailable**: Backend returns `atmosphere: null`, frontend renders nothing (no error)
2. **LLM slow**: 3-second timeout, cached value used if available
3. **Invalid response**: Graceful degradation to standard weather display

---

## Verification

1. **Backend**: `curl http://localhost:3001/api/weather/complete` returns `atmosphere` object
2. **Frontend**: Atmospheric description appears below conditions text
3. **Fallback**: Stop weather_bridge.py, verify app continues working without errors
4. **Visual**: Color shifts are subtle but visible when switching between snow/clear conditions
5. **Responsive**: Description displays correctly at all breakpoints (480px, 768px, 1280px, 1440px+)

---

## Limitations & Considerations

1. **LLM latency**: Gemma 3 270m on Pi may take 5-15 seconds to generate; 10-minute cache mitigates this
2. **Snow detection**: Uses temp ≤ 2°C AND humidity > 85% heuristic (may not be perfect)
3. **No image generation**: Current plan is text descriptions only (image gen could be future enhancement)
4. **Single Pi deployment**: Bridge and backend must run on same machine (localhost calls)
5. **CSS-only effects**: All visual effects are pure CSS gradients/overlays - no Canvas, WebGL, or particle systems (keeps Pi performance stable)

---

## Alternative Approaches Considered

1. **Direct React-to-Python calls**: Rejected due to CORS complexity and less robust error handling
2. **Full glassmorphism redesign** (Gemini suggestion): Rejected to preserve minimal aesthetic
3. **WebSocket for real-time AI updates**: Overkill given 10-minute update frequency
4. **Keyword-triggered animations** (e.g., "mist" triggers blur): Deferred to v1.5 if desired
5. **Apple Weather-style hyper-realism**: Aspirational but requires GPU/Canvas which may strain Pi; CSS overlays achieve similar mood with better performance

---

## Future Enhancements (v1.5+)

> **Note**: Condition-based overlays (Phase 3) are deprecated. The following are alternative future ideas only.

1. **Keyword-driven micro-effects**: If `ai_prompt` contains "mist", add subtle blur filter to background
2. **Animated snow particles**: CSS-only `@keyframes` falling dots during snow conditions (lightweight)
3. **Pressure-based "storm approaching" indicator**: Use pressure trend data to predict and visualize incoming weather
4. **LLM prompt refinement**: Tune system prompts based on real-world output quality during snowstorm testing
