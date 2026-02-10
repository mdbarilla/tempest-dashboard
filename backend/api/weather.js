const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const tempestAPI = require('../services/tempest-api');
const db = require('../services/database');
const nwsAPI = require('../services/nws-api');
const aiBridge = require('../services/ai-bridge');

/**
 * GET /api/weather/current
 * Get current weather conditions
 */
router.get('/current', async (req, res) => {
  try {
    const data = await tempestAPI.getCurrentWeather();

    // Store in database for historical tracking
    await db.saveObservation(data);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/forecast
 * Get forecast data
 */
router.get('/forecast', async (req, res) => {
  try {
    const data = await tempestAPI.getForecast();

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/complete
 * Get both current conditions and forecast
 */
router.get('/complete', async (req, res) => {
  try {
    const data = await tempestAPI.getCompleteWeather();

    // Condition correction: 30-min window for legacy; when precip_pct_at_correction is set,
    // persist until current precip % drops below it (e.g. Snow override at 90% stays until precip drops).
    if (data.current && data.current.timestamp) {
      const correction = await db.getRecentCorrection(data.current.timestamp, 24 * 60);
      const currentPrecipPct = data.forecast?.hourly?.[0]?.precipProbability;
      const hasPrecipRule = correction?.precip_pct_at_correction != null;
      const within30Min = correction && (data.current.timestamp - correction.timestamp) <= 30 * 60;
      // When precip_pct at correction: keep override until current drops below it; if no current data, keep.
      const precipStillHigh = hasPrecipRule && (
        currentPrecipPct == null || currentPrecipPct >= correction.precip_pct_at_correction
      );
      const shouldApply = correction && (
        hasPrecipRule ? precipStillHigh : within30Min
      );

      if (shouldApply && data.forecast?.current) {
        // Replace forecast.current with a new object so we never mutate the Tempest cache
        data.forecast = {
          ...data.forecast,
          current: {
            ...data.forecast.current,
            conditions: correction.reported_condition,
            corrected: true,
            originalCondition: correction.original_condition,
            correctionTime: correction.created_at,
            correctionId: correction.id
          }
        };
      }

      // Get today's cumulative precipitation total and history
      const todayPrecip = await db.getTodayManualPrecipitation();
      const precipTotal = todayPrecip.reduce((sum, entry) => sum + entry.amount_inches, 0);

      if (todayPrecip.length > 0 && data.current.precipitation) {
        // Add cumulative precipitation data to current weather
        const latestEntry = todayPrecip[0]; // Most recent entry
        data.current.precipitation.manual = {
          amountInches: parseFloat(precipTotal.toFixed(2)),
          type: latestEntry.precip_type,
          notes: latestEntry.notes,
          temperature: latestEntry.temperature,
          timestamp: latestEntry.timestamp,
          updatedAt: latestEntry.created_at,
          id: latestEntry.id,
          entryCount: todayPrecip.length,
          isCumulative: true
        };
      }
    }

    // NWS active alerts (Winter Storm Warning, etc.); uses TEMPEST_LATITUDE/LONGITUDE
    // ?refresh_alerts=1 bypasses the 10‑min in‑memory cache
    const refreshAlerts = req.query.refresh_alerts === '1' || req.query.refresh_alerts === 'true';
    data.alerts = await nwsAPI.getActiveAlerts(refreshAlerts);

    // AI atmosphere (LLM description, condition) from local bridge; null when disabled or down.
    // NWS data.alerts passed so the bridge can use ?nws= for prompt context (see ai-bridge.js).
    // correctedCondition (user-corrected, e.g. Snow) passed when present for richer summaries.
    // ?refresh_atmosphere=1 bypasses the 10‑min cache to force a fresh fetch from the bridge.
    const refreshAtmosphere = req.query.refresh_atmosphere === '1' || req.query.refresh_atmosphere === 'true';
    const correctedCondition = (data.forecast?.current?.corrected && data.forecast?.current?.conditions) ? data.forecast.current.conditions : null;
    const manualPrecipInches = data.current?.precipitation?.manual?.amountInches;
    data.atmosphere = await aiBridge.getAtmosphere(data.alerts, {
      bypassCache: refreshAtmosphere,
      correctedCondition,
      manualPrecipInches: manualPrecipInches != null ? Number(manualPrecipInches) : undefined
    });

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/alerts
 * NWS active alerts only (for debugging). Same source as data.alerts in /complete.
 * ?refresh=1 bypasses the 10‑min in‑memory cache.
 */
router.get('/alerts', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const alerts = await nwsAPI.getActiveAlerts(refresh);
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/weather/atmosphere
 * AI atmosphere from the local bridge. Same as data.atmosphere in /complete.
 *
 * Two distinct fields from the bridge:
 *   - description: from bridge ai_prompt (LLM-generated sentence). The UI shows this.
 *   - condition: from bridge condition (sensor-derived: Night, Sunny, Overcast, etc.). For future use.
 *
 * ?debug=1: one fetch from bridge (no cache), return { success, data, debug }.
 *   data is built from debug.body (data.description ← ai_prompt, data.condition ← condition).
 *   debug.dataSource: 'raw.body' when data matches debug.body; else 'getAtmosphere(...)'.
 */
router.get('/atmosphere', async (req, res) => {
  try {
    const debugMode = req.query.debug === '1' || req.query.debug === 'true';
    // When debug=1, skip NWS to avoid hanging on slow api.weather.gov; bridge is reached without ?nws=
    const alerts = debugMode ? [] : await nwsAPI.getActiveAlerts(false);
    if (debugMode) {
      const raw = await aiBridge.fetchAtmosphereRaw(alerts);
      let data;
      if (raw.body && typeof raw.body === 'object') {
        // Build data from this one response so data and debug.body always match
        let description = (raw.body.ai_prompt || raw.body.description || '').trim() || null;
        const condition = raw.body.condition || null;
        if (!description && condition) description = 'Condition summary unavailable.';
        data = { description: description || null, condition, source: 'local_llm' };
        if (typeof raw.body.ai_prompt_generated_at === 'number') data.generatedAt = raw.body.ai_prompt_generated_at;
        raw.dataSource = 'raw.body';
      } else {
        data = await aiBridge.getAtmosphere(alerts, { bypassCache: true });
        raw.dataSource = 'getAtmosphere (raw.body empty or not object)';
      }
      return res.json({ success: true, data, debug: raw });
    }
    const data = await aiBridge.getAtmosphere(alerts);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/weather/atmosphere/reset
 * Clear the backend atmosphere cache. Next /complete or /atmosphere will fetch fresh from the bridge.
 * Use when debugging "Conditions summary loading" (stale or stuck ai_prompt). To reset the bridge
 * on the Pi: ssh mbarilla@towerhill.local "sudo systemctl restart weather-bridge"
 */
router.post('/atmosphere/reset', (req, res) => {
  try {
    aiBridge.clearAtmosphereCache();
    res.json({ success: true, message: 'Atmosphere cache cleared. Next fetch will hit the bridge.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/weather/atmosphere/feedback
 * Store thumbs up/down for the LLM description. Appends to a JSONL file for later training.
 * Body: { label, description, condition?, generatedAt?, tempF?, humidity?,
 *        category?, rewrite?, nwsAlerts?, conditionCorrected?, conditionOriginal?,
 *        windSpeed?, windGust?, windDirection?, precipToday?, precipLastHour?,
 *        precipManualInches?, precipManualType?, solarRadiation?, uv? }
 * For label=down: category (array of slugs) and rewrite (string) are optional.
 */
router.post('/atmosphere/feedback', async (req, res) => {
  try {
    const {
      label, description, condition, generatedAt, tempF, humidity,
      category, rewrite,
      nwsAlerts, conditionCorrected, conditionOriginal, windSpeed, windGust, windDirection,
      precipToday, precipLastHour, precipManualInches, precipManualType, solarRadiation, uv
    } = req.body;
    if (!label || !description || !['up', 'down'].includes(label)) {
      return res.status(400).json({ success: false, error: 'label (up|down) and description are required' });
    }
    const filePath = process.env.LLM_FEEDBACK_PATH || path.join(process.cwd(), 'data', 'llm_feedback.jsonl');
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const record = {
      label,
      description: String(description).slice(0, 500),
      condition: condition ?? null,
      generatedAt: generatedAt ?? null,
      tempF: tempF != null ? Number(tempF) : null,
      humidity: humidity != null ? Number(humidity) : null,
      category: Array.isArray(category) ? category.slice(0, 10) : (category ? [String(category)] : null),
      rewrite: rewrite != null && String(rewrite).trim() ? String(rewrite).slice(0, 300) : null,
      nwsAlerts: Array.isArray(nwsAlerts) ? nwsAlerts.slice(0, 10).map(a => ({ event: a?.event ?? null, headline: a?.headline ?? null })) : null,
      conditionCorrected: conditionCorrected != null ? String(conditionCorrected).slice(0, 80) : null,
      conditionOriginal: conditionOriginal != null ? String(conditionOriginal).slice(0, 80) : null,
      windSpeed: windSpeed != null ? Number(windSpeed) : null,
      windGust: windGust != null ? Number(windGust) : null,
      windDirection: windDirection != null ? String(windDirection).slice(0, 20) : null,
      precipToday: precipToday != null ? Number(precipToday) : null,
      precipLastHour: precipLastHour != null ? Number(precipLastHour) : null,
      precipManualInches: precipManualInches != null ? Number(precipManualInches) : null,
      precipManualType: precipManualType != null ? String(precipManualType).slice(0, 20) : null,
      solarRadiation: solarRadiation != null ? Number(solarRadiation) : null,
      uv: uv != null ? Number(uv) : null,
      receivedAt: new Date().toISOString()
    };
    await fs.appendFile(filePath, JSON.stringify(record) + '\n');
    if (process.env.NODE_ENV !== 'production') {
    }
    res.json({ success: true, stored: true });
  } catch (e) {
    console.error('Atmosphere feedback write error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/weather/historical
 * Get historical weather data from database
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD), limit
 */
router.get('/historical', async (req, res) => {
  try {
    const { start, end, limit = 1000 } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'start and end dates are required (YYYY-MM-DD format)'
      });
    }

    const data = await db.getHistoricalData(start, end, parseInt(limit));

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/stats
 * Get statistical summary for a date range
 */
router.get('/stats', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'start and end dates are required (YYYY-MM-DD format)'
      });
    }

    const stats = await db.getStatistics(start, end);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Apply simple moving average to wind values to reduce sensor noise (0-X oscillation).
 * Only used for 24h wind charts where raw obs create a seismograph-like pattern.
 */
function smoothWindMovingAverage(values, windowSize = 5) {
  if (!values || values.length < windowSize) return values;
  const half = Math.floor(windowSize / 2);
  return values.map((v, i) => {
    if (v === null || v === undefined) return v;
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      const val = values[j];
      if (val != null) {
        sum += val;
        count++;
      }
    }
    return count ? Math.round(sum / count * 10) / 10 : v;
  });
}

/**
 * GET /api/weather/recent
 * Get recent observations for sparklines and detail charts
 * Query params:
 *   - hours: Number of hours to fetch (default: 6, max: 720 for 30 days)
 *   - metric: Optional filter for specific metric (pressure|humidity|wind|temperature|precipitation|solar|uv)
 */
router.get('/recent', async (req, res) => {
  try {
    let { hours = 6, metric } = req.query;

    // Validate and sanitize hours parameter
    hours = parseInt(hours, 10);
    if (isNaN(hours) || hours < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid hours parameter. Must be a positive number.'
      });
    }

    // Support up to 30 days (720 hours) for detail views
    hours = Math.min(hours, 720); // Max 30 days

    // Get data from the last N hours (use buffer for edge safety)
    const now = new Date();
    const nowUnix = Math.floor(now.getTime() / 1000);
    const requestedCutoff = Math.floor((now.getTime() - hours * 60 * 60 * 1000) / 1000);
    const fetchHours = hours <= 24 ? 26 : hours + 2;
    const startTime = new Date(now.getTime() - fetchHours * 60 * 60 * 1000);
    const cutoffTime = Math.floor(startTime.getTime() / 1000);
    const start = startTime.toISOString().split('T')[0];
    const end = now.toISOString().split('T')[0];

    let data;
    let recentMeta = null; // 3d/7d diagnostics when ?debug=1
    if (hours > 24) {
      // 3d/7d: use RAW observations and bucket to hourly from actual data (avoids flatlines from sparse hourly averages)
      // Limit: 7d at 1 obs/min = 10080; fetch most recent so we never truncate recent data
      const obsLimit = hours >= 168 ? 11000 : 5000;
      const rawObs = await db.getObservationsByTimestampRange(cutoffTime, nowUnix, obsLimit);
      const byHour = new Map();
      for (const obs of rawObs) {
        const hourKey = Math.floor(Number(obs.timestamp) / 3600) * 3600;
        if (!byHour.has(hourKey)) {
          byHour.set(hourKey, { count: 0, temp_f: 0, temp_c: 0, humidity: 0, wind: 0, wind_gust_max: null, pressure: 0, precip: null, solar: 0, uv: 0 });
        }
        const b = byHour.get(hourKey);
        b.count++;
        if (obs.temp_fahrenheit != null) b.temp_f += obs.temp_fahrenheit;
        if (obs.temp_celsius != null) b.temp_c += obs.temp_celsius;
        if (obs.humidity != null) b.humidity += obs.humidity;
        if (obs.wind_speed != null) b.wind += obs.wind_speed;
        if (obs.wind_gust != null) b.wind_gust_max = Math.max(b.wind_gust_max ?? 0, obs.wind_gust);
        if (obs.pressure_mb != null) b.pressure += obs.pressure_mb;
        if (obs.precip_today != null) b.precip = Math.max(b.precip ?? 0, obs.precip_today);
        if (obs.solar_radiation != null) b.solar += obs.solar_radiation;
        if (obs.uv_index != null) b.uv = Math.max(b.uv, obs.uv_index);
      }
      const sortedHours = [...byHour.keys()].sort((a, b) => a - b);
      const numBuckets = hours;
      const firstHourTs = Math.floor(requestedCutoff / 3600) * 3600;

      const toRow = (hourKey, bucket) => ({
        timestamp: hourKey,
        temp_fahrenheit: bucket.count ? bucket.temp_f / bucket.count : null,
        temp_celsius: bucket.count ? bucket.temp_c / bucket.count : null,
        humidity: bucket.count ? bucket.humidity / bucket.count : null,
        wind_speed: bucket.count ? bucket.wind / bucket.count : null,
        wind_gust: bucket.wind_gust_max ?? null,
        pressure_mb: bucket.count ? bucket.pressure / bucket.count : null,
        precip_today: bucket.precip,
        solar_radiation: bucket.count ? bucket.solar / bucket.count : null,
        uv_index: bucket.count ? bucket.uv : null
      });

      // Optional: fill gaps from WeatherFlow device observations when Pi was offline (TEMPEST_DEVICE_ID set)
      let stationByHour = new Map();
      let stationObsCount = 0;
      const deviceIdForMerge = tempestAPI.deviceId || (process.env.TEMPEST_DEVICE_ID && String(process.env.TEMPEST_DEVICE_ID).trim()) || null;
      if (deviceIdForMerge) {
        try {
          const deviceRows = await tempestAPI.getDeviceObservations(deviceIdForMerge, cutoffTime, nowUnix);
          stationObsCount = deviceRows.length;
          if (stationObsCount === 0) {
            console.warn('[recent 3d/7d] TEMPEST_DEVICE_ID set but device observations returned 0 rows; check API or time range.');
          }
          for (const obs of deviceRows) {
            const hourKey = Math.floor(Number(obs.timestamp) / 3600) * 3600;
            if (!stationByHour.has(hourKey)) {
              stationByHour.set(hourKey, { count: 0, temp_f: 0, temp_c: 0, humidity: 0, wind: 0, wind_gust_max: null, pressure: 0, precip: null, solar: 0, uv: 0 });
            }
            const b = stationByHour.get(hourKey);
            b.count++;
            if (obs.temp_fahrenheit != null) b.temp_f += obs.temp_fahrenheit;
            if (obs.temp_celsius != null) b.temp_c += obs.temp_celsius;
            if (obs.humidity != null) b.humidity += obs.humidity;
            if (obs.wind_speed != null) b.wind += obs.wind_speed;
            if (obs.wind_gust != null) b.wind_gust_max = Math.max(b.wind_gust_max ?? 0, obs.wind_gust);
            if (obs.pressure_mb != null) b.pressure += obs.pressure_mb;
            if (obs.precip_today != null) b.precip = Math.max(b.precip ?? 0, obs.precip_today);
            if (obs.solar_radiation != null) b.solar += obs.solar_radiation;
            if (obs.uv_index != null) b.uv = Math.max(b.uv, obs.uv_index);
          }
        } catch (err) {
          console.warn('[recent] Device observations fetch failed:', err.message);
        }
      }

      data = [];
      let bucketsFromStation = 0;
      for (let i = 0; i < numBuckets; i++) {
        const bucketTs = firstHourTs + i * 3600;
        if (bucketTs > nowUnix) break;
        const bucket = byHour.get(bucketTs);
        if (bucket && bucket.count > 0) {
          data.push(toRow(bucketTs, bucket));
        } else {
          const stationBucket = stationByHour.get(bucketTs);
          if (stationBucket && stationBucket.count > 0) {
            data.push(toRow(bucketTs, stationBucket));
            bucketsFromStation++;
          } else {
            data.push({ timestamp: bucketTs, temp_fahrenheit: null, temp_celsius: null, humidity: null, wind_speed: null, wind_gust: null, pressure_mb: null, precip_today: null, solar_radiation: null, uv_index: null });
          }
        }
      }
      const bucketsWithData = data.filter(d => d.temp_fahrenheit != null).length;
      recentMeta = {
        observationCount: rawObs.length,
        bucketsWithData,
        totalBuckets: data.length,
        requestedHours: hours,
        cutoffTime,
        nowUnix,
        deviceIdConfigured: !!deviceIdForMerge
      };
      const debugMode = req.query.debug === '1' || req.query.debug === 'true';
      if (deviceIdForMerge) {
        recentMeta.stationObservationCount = stationObsCount;
        recentMeta.bucketsFilledFromStation = bucketsFromStation;
        recentMeta.deviceIdUsed = deviceIdForMerge;
        if (debugMode && stationByHour.size > 0) {
          let hoursCompared = 0;
          let maxTempDiff = 0;
          let maxPressureDiff = 0;
          let sumTempDiff = 0;
          for (const [hourKey, localBucket] of byHour) {
            if (!localBucket || localBucket.count === 0) continue;
            const stationBucket = stationByHour.get(hourKey);
            if (!stationBucket || stationBucket.count === 0) continue;
            hoursCompared++;
            const localTemp = localBucket.temp_f / localBucket.count;
            const stationTemp = stationBucket.temp_f / stationBucket.count;
            const localPressure = localBucket.pressure / localBucket.count;
            const stationPressure = stationBucket.pressure / stationBucket.count;
            const tempDiff = Math.abs(localTemp - stationTemp);
            const pressureDiff = Math.abs(localPressure - stationPressure);
            sumTempDiff += tempDiff;
            if (tempDiff > maxTempDiff) maxTempDiff = Math.round(tempDiff * 100) / 100;
            if (pressureDiff > maxPressureDiff) maxPressureDiff = Math.round(pressureDiff * 100) / 100;
          }
          recentMeta.verification = {
            hoursCompared,
            maxTempDiffF: maxTempDiff,
            maxPressureDiffMb: maxPressureDiff,
            avgTempDiffF: hoursCompared ? Math.round((sumTempDiff / hoursCompared) * 100) / 100 : null
          };
        }
      }
      if (debugMode) {
        console.log('[recent 3d/7d]', JSON.stringify(recentMeta));
      } else if (deviceIdForMerge && bucketsFromStation > 0) {
        console.log('[recent 3d/7d] merged: local', recentMeta.bucketsWithData - bucketsFromStation, 'station fill', bucketsFromStation);
      }
    } else {
      data = await db.getObservationsByTimestampRange(cutoffTime, nowUnix, 1000);
    }

    // Filter to requested hours (24h only; 3d/7d already built to exact span)
    const recentData = hours <= 24
      ? data.filter(obs => obs.timestamp >= requestedCutoff)
      : data;

    // Sort by timestamp ascending (oldest first)
    recentData.sort((a, b) => a.timestamp - b.timestamp);

    // Card/sparkline (hours<=12): sample to ~12–18 points for a smooth small trend line.
    // Detail view (hours>=24): use full data for granular chart and hovers.
    let sampled;
    if (hours <= 12 && recentData.length > 18) {
      const numPoints = Math.min(18, Math.max(12, Math.floor(hours)));
      const indices = [];
      for (let i = 0; i < numPoints; i++) {
        indices.push(Math.round((i * (recentData.length - 1)) / Math.max(1, numPoints - 1)));
      }
      sampled = [...new Set(indices)].sort((a, b) => a - b).map(i => recentData[i]);
    } else {
      sampled = recentData;
    }

    // Precipitation: merge Tempest precip_today (inches) with manual entries (additive)
    let precipitation = sampled.map(d => d.precip_today);
    const timestamps = sampled.map(d => d.timestamp);

    // Get manual precipitation entries for the time window
    const allManual = await db.getTodayManualPrecipitation();
    const manualInWindow = allManual
      .filter(m => m.timestamp >= requestedCutoff && m.timestamp <= nowUnix)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (manualInWindow.length > 0 && hours <= 168) {
      // Only merge manual data for shorter ranges (hourly averages don't support this well)
      const tempestPoints = sampled.map(d => ({ t: d.timestamp, pt: d.precip_today ?? 0 }));
      const eventTimes = tempestPoints.length > 0
        ? [...tempestPoints.map(p => p.t), ...manualInWindow.map(m => m.timestamp)].sort((a, b) => a - b)
        : [requestedCutoff, ...manualInWindow.map(m => m.timestamp)].sort((a, b) => a - b);

      const getPrecipAt = (T) => {
        const last = tempestPoints.filter(p => p.t <= T).pop();
        return last ? last.pt : 0;
      };
      const getManualCum = (T) =>
        manualInWindow.filter(m => m.timestamp <= T).reduce((s, m) => s + (Number(m.amount_inches) || 0), 0);

      precipitation = eventTimes.map(T => getPrecipAt(T) + getManualCum(T));
      // Update timestamps to include manual entry times
      const allTimestamps = [...new Set([...timestamps, ...eventTimes])].sort((a, b) => a - b);
      // Align precipitation array with all timestamps
      const precipMap = new Map();
      eventTimes.forEach((t, i) => precipMap.set(t, precipitation[i]));
      precipitation = allTimestamps.map(t => precipMap.get(t) ?? 0);
    }

    // Build response data with timestamps
    const responseData = {
      timestamps,
      pressure: sampled.map(d => d.pressure_mb),
      humidity: sampled.map(d => d.humidity),
      wind: sampled.map(d => d.wind_speed),
      windGust: sampled.map(d => d.wind_gust ?? null),
      precipitation: hours <= 168 ? precipitation : sampled.map(d => d.precip_today ?? 0),
      temperature: sampled.map(d => d.temp_fahrenheit),
      solar: sampled.map(d => d.solar_radiation),
      uv: sampled.map(d => d.uv_index)
    };

    // Smooth wind for 24h to reduce sensor noise (0-X oscillation)
    if (hours <= 24 && responseData.wind) {
      responseData.wind = smoothWindMovingAverage(responseData.wind, 5);
    }

    // If metric filter specified, return only that metric
    if (metric && ['pressure', 'humidity', 'wind', 'temperature', 'precipitation', 'solar', 'uv'].includes(metric)) {
      const filteredData = {
        timestamps: responseData.timestamps,
        [metric]: responseData[metric]
      };
      // Include manual precipitation markers if applicable
      if (metric === 'precipitation' && manualInWindow.length > 0 && hours <= 168) {
        filteredData.manualEntries = manualInWindow.map(m => ({
          timestamp: m.timestamp,
          amountInches: Number(m.amount_inches),
          type: m.precip_type,
          notes: m.notes
        }));
      }
      const payload = {
        success: true,
        count: sampled.length,
        hours,
        data: filteredData
      };
      if (recentMeta && (req.query.debug === '1' || req.query.debug === 'true')) {
        payload.meta = recentMeta;
      }
      return res.json(payload);
    }

    // Include manual precipitation markers in full response
    if (manualInWindow.length > 0 && hours <= 168) {
      responseData.manualEntries = manualInWindow.map(m => ({
        timestamp: m.timestamp,
        amountInches: Number(m.amount_inches),
        type: m.precip_type,
        notes: m.notes
      }));
    }

    const payload = {
      success: true,
      count: sampled.length,
      hours,
      data: responseData
    };
    if (recentMeta && (req.query.debug === '1' || req.query.debug === 'true')) {
      payload.meta = recentMeta;
    }
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const VALID_INTENTS = ['average', 'min', 'max', 'peak', 'summary', 'chart', 'trend'];
const VALID_METRICS = ['temperature', 'wind', 'humidity', 'pressure', 'precipitation', 'solar', 'uv'];
const RANGE_TO_HOURS = { '24h': 24, '3d': 72, '7d': 168, '30d': 720 };

function formatAskTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const dateMs = d.getTime();
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (dateMs >= today) return timeStr;
  if (dateMs >= yesterday && dateMs < today) return `${timeStr} yesterday`;
  if (now - dateMs < 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Day/date for "this week" answers: e.g. "Wednesday, Feb 5" */
function formatAskDate(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * GET /api/weather/ask - existence check (use POST for actual ask).
 */
router.get('/ask', (req, res) => {
  res.set('Allow', 'POST');
  res.status(405).json({ error: 'Method Not Allowed', message: 'Use POST with body: { intent, metric?, range? }' });
});

function getRangeLabel(hours) {
  if (hours <= 24) return hours === 24 ? 'last 24 hours' : `past ${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'past 1 day' : `past ${days} days`;
}

/**
 * POST /api/weather/ask
 * Structured historical weather Q&A (no LLM). Body: { intent, metric?, range?, hours? }.
 * range: '24h'|'7d'|'30d'. hours: optional 24–720; if set, overrides range.
 * Returns { success, data: { summary, chart? } }.
 */
router.post('/ask', async (req, res) => {
  try {
    const body = req.body || {};
    const intent = (body.intent != null ? String(body.intent) : '').trim().toLowerCase();
    const metric = body.metric != null ? String(body.metric).trim().toLowerCase() : null;
    const range = body.range != null ? String(body.range).trim().toLowerCase() : null;
    const bodyHours = body.hours;

    if (!intent || !VALID_INTENTS.includes(intent)) {
      return res.status(400).json({ success: false, error: 'Invalid intent. Use: average, min, max, peak, summary, chart, trend' });
    }

    /* Trend (humidity) does not use range/hours; handle first */
    if (intent === 'trend' && (metric === 'humidity' || !metric)) {
      try {
        const endDate = new Date();
        const nowUnix = Math.floor(endDate.getTime() / 1000);
        const windows = [6, 24];
        let humid = [];
        let trendHours = 0;
        for (const h of windows) {
          const cutoff = nowUnix - h * 3600;
          const obs = await db.getObservationsByTimestampRange(cutoff, nowUnix, 1000);
          const rows = Array.isArray(obs) ? obs : [];
          humid = rows
            .filter(o => o != null && (o.humidity != null || o.humidity === 0))
            .map(o => ({ t: Number(o.timestamp), v: Number(o.humidity) }))
            .sort((a, b) => a.t - b.t);
          if (humid.length >= 2) {
            trendHours = h;
            break;
          }
        }
        if (humid.length < 2) {
          return res.json({ success: true, data: { summary: 'Not enough recent humidity readings to show a trend. Try again once your station has reported for a few hours.' } });
        }
        const mid = Math.max(1, Math.floor(humid.length / 2));
        const firstAvg = humid.slice(0, mid).reduce((s, p) => s + p.v, 0) / mid;
        const secondAvg = humid.slice(mid).reduce((s, p) => s + p.v, 0) / (humid.length - mid);
        const current = Math.round(humid[humid.length - 1].v);
        const diff = secondAvg - firstAvg;
        const threshold = 2;
        let trendWord = 'stable';
        if (diff > threshold) trendWord = 'rising';
        else if (diff < -threshold) trendWord = 'falling';
        const summary = `Humidity has been ${trendWord} over the past ${trendHours} hours (currently ${current}%).`;
        return res.json({ success: true, data: { summary } });
      } catch (err) {
        console.error('[ask] humidity trend error:', err);
        return res.json({ success: true, data: { summary: 'Could not compute humidity trend. Try again in a moment.' } });
      }
    }

    let hours;
    if (typeof bodyHours === 'number' && bodyHours >= 24 && bodyHours <= 720) {
      hours = Math.round(bodyHours);
    } else if (typeof bodyHours === 'string' && /^\d+$/.test(String(bodyHours).trim())) {
      const n = parseInt(String(bodyHours).trim(), 10);
      hours = Math.min(720, Math.max(24, n));
    } else {
      hours = RANGE_TO_HOURS[range] || 168;
    }
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];
    const rangeLabel = getRangeLabel(hours);

    if (intent === 'chart') {
      const m = metric && VALID_METRICS.includes(metric) ? metric : 'temperature';
      return res.json({
        success: true,
        data: {
          summary: `Here’s the ${m} chart for the ${rangeLabel}.`,
          chart: { metric: m, hours }
        }
      });
    }

    if (intent === 'summary') {
      const stats = await db.getStatistics(start, end);
      if (!stats || stats.record_count === 0) {
        return res.json({ success: true, data: { summary: `No data for the ${rangeLabel}.` } });
      }
      const low = stats.min_temp_f != null ? Math.round(Number(stats.min_temp_f)) : null;
      const high = stats.max_temp_f != null ? Math.round(Number(stats.max_temp_f)) : null;
      const maxWind = stats.max_wind_gust != null ? Math.round(Number(stats.max_wind_gust)) : null;
      const precip = stats.total_precipitation != null ? Number(stats.total_precipitation).toFixed(2) : null;
      const parts = [];
      if (low != null && high != null) parts.push(`low ${low}°F, high ${high}°F`);
      if (maxWind != null) parts.push(`max wind ${maxWind} mph`);
      if (precip != null) parts.push(`total precip ${precip} in`);
      const summary = parts.length ? `Over the ${rangeLabel}: ${parts.join('; ')}.` : `No summary for the ${rangeLabel}.`;
      return res.json({ success: true, data: { summary } });
    }

    if (intent === 'peak' && metric && VALID_METRICS.includes(metric)) {
      const nowUnix = Math.floor(endDate.getTime() / 1000);
      const cutoff = Math.floor(startDate.getTime() / 1000);
      const obs = await db.getObservationsByTimestampRange(cutoff, nowUnix, 5000);
      if (!obs.length) {
        return res.json({ success: true, data: { summary: `No data for the ${rangeLabel} to find when ${metric} peaked.` } });
      }
      let valueKey = 'wind_gust';
      if (metric === 'wind') valueKey = 'wind_gust';
      else if (metric === 'temperature') valueKey = 'temp_fahrenheit';
      else if (metric === 'humidity') valueKey = 'humidity';
      else if (metric === 'pressure') valueKey = 'pressure_mb';
      else if (metric === 'precipitation') valueKey = 'precip_today';
      else if (metric === 'solar') valueKey = 'solar_radiation';
      else if (metric === 'uv') valueKey = 'uv_index';
      let maxIdx = 0;
      let maxVal = obs[0] && (obs[0][valueKey] != null) ? Number(obs[0][valueKey]) : -Infinity;
      obs.forEach((row, i) => {
        const v = row[valueKey] != null ? Number(row[valueKey]) : -Infinity;
        if (v > maxVal) { maxVal = v; maxIdx = i; }
      });
      const ts = obs[maxIdx] && obs[maxIdx].timestamp;
      const timeStr = ts != null ? formatAskTime(ts) : '';
      const unit = metric === 'wind' ? 'mph' : metric === 'temperature' ? '°F' : metric === 'humidity' ? '%' : metric === 'pressure' ? ' mb' : metric === 'solar' ? ' W/m²' : metric === 'uv' ? '' : '';
      const valStr = maxVal !== -Infinity ? `${Math.round(maxVal)}${unit}` : '';
      const summary = valStr && timeStr ? `${metric === 'wind' ? 'Wind' : metric.charAt(0).toUpperCase() + metric.slice(1)} peaked at ${valStr} at ${timeStr}.` : `No peak found for ${metric} in the ${rangeLabel}.`;
      return res.json({ success: true, data: { summary } });
    }

    if (['average', 'min', 'max'].includes(intent) && metric && VALID_METRICS.includes(metric)) {
      const stats = await db.getStatistics(start, end);
      if (!stats || stats.record_count === 0) {
        return res.json({ success: true, data: { summary: `No data for the ${rangeLabel}.` } });
      }
      let value = null;
      let unit = '';
      let label = metric;
      if (metric === 'temperature') {
        unit = '°F';
        if (intent === 'average') value = stats.avg_temp_f; else if (intent === 'min') value = stats.min_temp_f; else value = stats.max_temp_f;
        label = 'Temperature';
      } else if (metric === 'humidity') {
        unit = '%';
        value = intent === 'average' ? stats.avg_humidity : null;
        if (intent === 'min' || intent === 'max') value = null;
        label = 'Humidity';
      } else if (metric === 'wind') {
        unit = ' mph';
        value = intent === 'average' ? stats.avg_wind_speed : intent === 'max' ? stats.max_wind_gust : null;
        if (intent === 'min') value = null;
        label = 'Wind';
      } else if (metric === 'pressure') {
        unit = ' mb';
        value = intent === 'average' ? stats.avg_pressure : null;
        label = 'Pressure';
      } else if (metric === 'precipitation') {
        unit = ' in';
        value = intent === 'average' || intent === 'min' ? null : stats.total_precipitation;
        label = 'Precipitation';
      } else if (metric === 'solar' || metric === 'uv') {
        value = intent === 'max' ? (metric === 'uv' ? stats.max_uv : null) : null;
        if (metric === 'solar') unit = ' W/m²';
        label = metric === 'uv' ? 'UV' : 'Solar';
      }
      if (value == null || (typeof value === 'number' && Number.isNaN(value))) {
        return res.json({ success: true, data: { summary: `${label} ${intent} is not available for the ${rangeLabel}.` } });
      }
      const num = typeof value === 'number' ? value : Number(value);
      const str = metric === 'temperature' || metric === 'humidity' || metric === 'wind' ? Math.round(num) : num.toFixed(2);
      const intentLabel = intent === 'average' ? 'average' : intent === 'min' ? 'lowest' : 'highest';
      let dateStr = '';
      const hasSingleOccurrenceMinMax = intent !== 'average' && hours >= 168 &&
        (metric === 'temperature' || metric === 'wind' || metric === 'solar' || metric === 'uv') &&
        !(metric === 'precipitation' && intent === 'max');
      if (hasSingleOccurrenceMinMax) {
        const valueKey = metric === 'wind' ? 'wind_gust' : metric === 'temperature' ? 'temp_fahrenheit' : metric === 'solar' ? 'solar_radiation' : 'uv_index';
        const nowUnix = Math.floor(endDate.getTime() / 1000);
        const cutoff = Math.floor(startDate.getTime() / 1000);
        const obs = await db.getObservationsByTimestampRange(cutoff, nowUnix, 5000);
        let foundTs = null;
        if (obs.length > 0) {
          let bestIdx = 0;
          let bestVal = obs[0][valueKey] != null ? Number(obs[0][valueKey]) : (intent === 'min' ? Infinity : -Infinity);
          obs.forEach((row, i) => {
            const v = row[valueKey] != null ? Number(row[valueKey]) : (intent === 'min' ? Infinity : -Infinity);
            if (intent === 'min' ? v < bestVal : v > bestVal) {
              bestVal = v;
              bestIdx = i;
            }
          });
          if (obs[bestIdx][valueKey] != null) foundTs = obs[bestIdx].timestamp;
        }
        if (foundTs != null) dateStr = formatAskDate(foundTs);
      }
      const summary = dateStr
        ? `${label} ${intentLabel} in the ${rangeLabel} was ${str}${unit} on ${dateStr}.`
        : `${label} ${intentLabel} in the ${rangeLabel} was ${str}${unit}.`;
      return res.json({ success: true, data: { summary } });
    }

    return res.status(400).json({ success: false, error: 'Missing or invalid metric for this intent.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/weather/correction
 * Submit a condition correction
 */
router.post('/correction', async (req, res) => {
  try {
    const { timestamp, reportedCondition, originalCondition, temperature, precip_pct_at_correction } = req.body;

    if (!timestamp || !reportedCondition || !originalCondition) {
      return res.status(400).json({
        success: false,
        error: 'timestamp, reportedCondition, and originalCondition are required'
      });
    }

    const precipVal = (precip_pct_at_correction != null && precip_pct_at_correction !== '')
      ? Number(precip_pct_at_correction) : undefined;
    const result = await db.saveConditionCorrection({
      timestamp,
      reportedCondition,
      originalCondition,
      temperature,
      precipPctAtCorrection: (typeof precipVal === 'number' && !Number.isNaN(precipVal)) ? precipVal : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/corrections
 * Get all condition corrections
 */
router.get('/corrections', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const corrections = await db.getAllCorrections(parseInt(limit));

    res.json({
      success: true,
      count: corrections.length,
      data: corrections
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/weather/correction/:id
 * Delete a condition correction (cancel/reset).
 * Query: obs_timestamp — when present, also deletes any other corrections in the same
 * 24h window and clears the Tempest cache so "Reset to API" returns raw API data.
 */
router.delete('/correction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const obsTimestamp = req.query.obs_timestamp != null ? Number(req.query.obs_timestamp) : null;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'id is required'
      });
    }

    const result = await db.deleteConditionCorrection(parseInt(id));

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Correction not found'
      });
    }

    // Reset to API: remove any other corrections in the same window and clear Tempest cache
    if (obsTimestamp != null && !Number.isNaN(obsTimestamp)) {
      await db.deleteCorrectionsInWindow(obsTimestamp, 24 * 60);
      tempestAPI.clearCache();
    }

    res.json({
      success: true,
      message: 'Correction deleted successfully'
    });
  } catch (error) {
    console.error('[Reset to API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/weather/precipitation/manual
 * Submit a manual precipitation entry
 */
router.post('/precipitation/manual', async (req, res) => {
  try {
    const { timestamp, amountInches, precipType, notes, temperature } = req.body;

    if (!timestamp || amountInches === undefined || !precipType) {
      return res.status(400).json({
        success: false,
        error: 'timestamp, amountInches, and precipType are required'
      });
    }

    // Validate precipitation type
    const validTypes = ['snow', 'rain', 'sleet', 'freezing rain', 'hail', 'mixed'];
    if (!validTypes.includes(precipType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: `precipType must be one of: ${validTypes.join(', ')}`
      });
    }

    const result = await db.saveManualPrecipitation({
      timestamp,
      amountInches: parseFloat(amountInches),
      precipType: precipType.toLowerCase(),
      notes,
      temperature
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/precipitation/manual
 * Get manual precipitation entries
 */
router.get('/precipitation/manual', async (req, res) => {
  try {
    const { start, end, limit = 100 } = req.query;

    let data;
    if (start && end) {
      data = await db.getManualPrecipitation(start, end, parseInt(limit));
    } else {
      data = await db.getAllManualPrecipitation(parseInt(limit));
    }

    res.json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/weather/precipitation/manual/:id
 * Delete a manual precipitation entry
 */
router.delete('/precipitation/manual/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'id is required'
      });
    }

    const result = await db.deleteManualPrecipitation(parseInt(id));

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Entry not found'
      });
    }

    res.json({
      success: true,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/weather/precipitation/today
 * Get today's precipitation entries with cumulative total
 */
router.get('/precipitation/today', async (req, res) => {
  try {
    const data = await db.getTodayManualPrecipitation();

    // Calculate cumulative total
    const total = data.reduce((sum, entry) => sum + entry.amount_inches, 0);

    res.json({
      success: true,
      count: data.length,
      total: parseFloat(total.toFixed(2)),
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
