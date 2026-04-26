/**
 * Planting guidance: merged Tempest + NWS daily lows, safe-to-plant gate, frost risk, warming trend.
 * See docs/safe-to-plant-spec.md at Tower Hill repo root.
 */

const tempestAPI = require('./tempest-api');
const nwsAPI = require('./nws-api');

const FREEZE_F = 32;
const REQUIRED_STREAK = 10;
const WARMING_DELTA_F = 2;
const CACHE_TTL_MS = 5 * 60 * 1000;
const TZ = 'America/New_York';

let cache = { at: 0, payload: null };
let inflight = null;
let eventBusRef = null;
let prevEligible = false;
let prevHadRisk = false;

function setEventBus(bus) {
  eventBusRef = bus;
}

function todayDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Tempest daily row -> YYYY-MM-DD in station timezone */
function tempestDayToDateKey(day) {
  const raw = day.date != null ? day.date : day.day_start_local ?? day.day_start;
  if (raw == null) return null;
  if (typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-CA', { timeZone: TZ });
    }
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
    return null;
  }
  const sec = Number(raw);
  if (!Number.isFinite(sec)) return null;
  const ms = sec > 1e12 ? sec : sec * 1000;
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Build merged daily series: { date, minF, tempestF, nwsF }[]
 * Conservative merge: min(tempest, nws) when both exist.
 */
function mergeSeries(tempestDaily, nwsMap) {
  const tempestByDate = new Map();
  for (const day of tempestDaily || []) {
    const key = tempestDayToDateKey(day);
    const low = day.temperature?.low?.fahrenheit;
    if (key && low != null && Number.isFinite(low)) {
      tempestByDate.set(key, low);
    }
  }

  const allDates = new Set([...tempestByDate.keys(), ...nwsMap.keys()]);
  const sorted = [...allDates].sort();
  const merged = [];
  for (const dateKey of sorted) {
    const t = tempestByDate.get(dateKey);
    const n = nwsMap.get(dateKey);
    let minF = null;
    if (t != null && n != null) minF = Math.min(t, n);
    else minF = t ?? n ?? null;
    if (minF == null) continue;
    merged.push({
      date: dateKey,
      minF,
      tempestF: t ?? null,
      nwsF: n ?? null,
    });
  }
  return merged;
}

function confidenceFromMerged(merged) {
  if (merged.length === 0) return 'low';
  let both = 0;
  for (const m of merged) {
    if (m.tempestF != null && m.nwsF != null) both++;
  }
  const ratio = both / merged.length;
  if (ratio >= 0.5) return 'high';
  if (ratio > 0) return 'medium';
  return 'medium';
}

function computeWarmingTrend(mergedFromToday) {
  if (mergedFromToday.length < 10) {
    return { active: false, summary: 'Not enough forecast days for a trend yet.', horizon_days: mergedFromToday.length };
  }
  const slice = mergedFromToday.slice(0, 10);
  const early = slice.slice(0, 3).map((m) => m.minF);
  const late = slice.slice(7, 10).map((m) => m.minF);
  const meanEarly = early.reduce((a, b) => a + b, 0) / early.length;
  const meanLate = late.reduce((a, b) => a + b, 0) / late.length;
  const active = meanLate - meanEarly >= WARMING_DELTA_F;
  return {
    active,
    summary: active
      ? 'Overnight lows are rising over the next week or so.'
      : 'No strong warming trend in the forecast window.',
    horizon_days: 10,
  };
}

function computeFrostRisk(mergedFromToday) {
  const horizon = mergedFromToday.slice(0, 7);
  for (const m of horizon) {
    if (m.minF <= FREEZE_F) {
      return {
        level: 'watch',
        next_freeze_date: m.date,
        low_temp_f: Math.round(m.minF * 10) / 10,
      };
    }
  }
  return { level: 'none', next_freeze_date: null, low_temp_f: null };
}

function computeSafeToPlant(merged, todayKey) {
  const fromToday = merged.filter((m) => m.date >= todayKey);
  const disclaimer =
    'Forecasts change and late frosts happen. Use this as a guide—cover or protect tender plants whenever unsure.';

  if (fromToday.length < REQUIRED_STREAK) {
    return {
      eligible: false,
      window_start: null,
      freeze_free_days_ahead: countFreezeFreeFromStart(fromToday),
      confidence: confidenceFromMerged(merged),
      disclaimer,
      last_computed: new Date().toISOString(),
    };
  }

  const firstTen = fromToday.slice(0, REQUIRED_STREAK);
  const allAbove = firstTen.every((m) => m.minF > FREEZE_F);
  const eligible = firstTen.length === REQUIRED_STREAK && allAbove;

  return {
    eligible,
    window_start: eligible ? firstTen[0].date : null,
    freeze_free_days_ahead: countFreezeFreeFromStart(fromToday),
    confidence: confidenceFromMerged(merged),
    disclaimer,
    last_computed: new Date().toISOString(),
  };
}

function countFreezeFreeFromStart(fromToday) {
  let n = 0;
  for (const m of fromToday) {
    if (m.minF > FREEZE_F) n++;
    else break;
  }
  return n;
}

function emitIfNeeded(snapshot) {
  const bus = eventBusRef;
  if (!bus) return;

  const el = snapshot.safe_to_plant.eligible;
  if (el && !prevEligible) {
    bus.emit('weather.frost.clear', {
      safePlantOutDate: snapshot.safe_to_plant.window_start,
      freezeFreeStreakDays: REQUIRED_STREAK,
      confidence: snapshot.safe_to_plant.confidence,
      lastComputed: snapshot.safe_to_plant.last_computed,
    });
  }
  prevEligible = el;

  const risk = snapshot.frost_risk;
  const hasRisk = risk.level !== 'none' && risk.next_freeze_date;
  if (hasRisk && !prevHadRisk) {
    bus.emit('weather.frost.risk', {
      firstFrostDate: risk.next_freeze_date,
      lowTempF: risk.low_temp_f,
      level: risk.level,
    });
  }
  prevHadRisk = hasRisk;
}

async function computeSnapshotInternal() {
  const todayKey = todayDateKey();

  const [forecast, nwsMap] = await Promise.all([
    tempestAPI.getForecast(),
    nwsAPI.getForecastDailyLowMinFMap(),
  ]);

  const merged = mergeSeries(forecast.daily || [], nwsMap);
  const fromToday = merged.filter((m) => m.date >= todayKey);

  const safe_to_plant = computeSafeToPlant(merged, todayKey);
  const frost_risk = computeFrostRisk(fromToday);
  const warming_trend = computeWarmingTrend(fromToday);

  return {
    safe_to_plant,
    frost_risk,
    warming_trend,
  };
}

/**
 * Cached planting guidance snapshot (REST + garden dashboard).
 */
async function getSnapshot() {
  const now = Date.now();
  if (cache.payload && now - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const snapshot = await computeSnapshotInternal();
      emitIfNeeded(snapshot);
      cache = { at: Date.now(), payload: snapshot };
      return snapshot;
    } catch (err) {
      console.warn('[planting-guidance]', err.message);
      return {
        safe_to_plant: {
          eligible: false,
          window_start: null,
          freeze_free_days_ahead: 0,
          confidence: 'low',
          disclaimer:
            'Planting guidance is temporarily unavailable. Check local forecasts before setting out tender plants.',
          last_computed: new Date().toISOString(),
          error: err.message,
        },
        frost_risk: { level: 'none', next_freeze_date: null, low_temp_f: null },
        warming_trend: { active: false, summary: '', horizon_days: 0 },
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function clearCache() {
  cache = { at: 0, payload: null };
}

module.exports = {
  setEventBus,
  getSnapshot,
  clearCache,
  FREEZE_F,
  REQUIRED_STREAK,
};
