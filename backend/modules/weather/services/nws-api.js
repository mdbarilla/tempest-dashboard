const axios = require('axios');
const NodeCache = require('node-cache');

const NWS_BASE = 'https://api.weather.gov';
const CACHE_TTL = parseInt(process.env.NWS_ALERTS_TTL) || 600; // 10 min
const USER_AGENT = process.env.NWS_USER_AGENT || 'Tempest (https://github.com/tempest-weather); contact@example.com';

const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });

/**
 * Extract zone ID from NWS forecastZone URL.
 * e.g. "https://api.weather.gov/zones/forecast/BOX/039" -> "BOX039"
 */
function zoneIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/zones\/forecast\/([^/]+)\/([^/]+)/);
  return m ? `${m[1]}${m[2]}` : null;
}

/**
 * Extract state (e.g. MA) from NWS county zone URL.
 * e.g. "https://api.weather.gov/zones/county/MAC017" -> "MA"
 */
function stateFromCountyUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/zones\/county\/([A-Z]{2})/);
  return m ? m[1] : null;
}

function mapFeaturesToAlerts(features) {
  return (features || []).map((f) => {
    const p = f.properties || {};
    return {
      event: p.event || 'Alert',
      headline: p.headline || '',
      description: p.description || '',
      onset: p.onset || null,
      expires: p.expires || null,
      severity: p.severity || null
    };
  });
}

/**
 * Fetch active NWS alerts for a point. Uses TEMPEST_LATITUDE and TEMPEST_LONGITUDE.
 * Primary: /alerts/active?point=lat,lon (only alerts whose geometry contains the point; avoids Albany/NY spillover).
 * Fallback: if point= returns none, use /alerts/active?zone= then ?area=STATE, and filter by affectedZones (BOX or MA).
 * Returns [] if lat/lon missing or on any error.
 * @param {boolean} [skipCache=false] – If true, bypass in-memory cache and refetch from NWS.
 */
async function getActiveAlerts(skipCache = false) {
  const lat = process.env.TEMPEST_LATITUDE;
  const lon = process.env.TEMPEST_LONGITUDE;
  if (!lat || !lon) return [];

  const cacheKey = `nws_alerts_${lat}_${lon}`;
  if (skipCache) cache.del(cacheKey);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const headers = { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' };

  try {
    let features = [];

    // 1) Primary: point=lat,lon – NWS returns only alerts whose geometry contains this point.
    //    This avoids Albany/NY-only alerts that can show up when using zone= or area=.
    try {
      const ptRes = await axios.get(`${NWS_BASE}/alerts/active?point=${lat},${lon}`, { headers, timeout: 8000 });
      features = ptRes.data?.features || [];
    } catch (pe) {
      console.warn('NWS alerts by point failed:', pe.message);
    }

    // 2) Fallback: zone then area (with affectedZones filter to exclude Albany/NY-only)
    if (features.length === 0) {
      const pointsRes = await axios.get(`${NWS_BASE}/points/${lat},${lon}`, { headers, timeout: 8000 });
      const props = pointsRes.data?.properties || {};
      const forecastZone = props.forecastZone;
      const county = Array.isArray(props.county) ? props.county[0] : props.county;
      const zoneId = zoneIdFromUrl(forecastZone);
      const state = stateFromCountyUrl(county) || 'MA';

      if (zoneId) {
        try {
          const zRes = await axios.get(`${NWS_BASE}/alerts/active?zone=${zoneId}`, { headers, timeout: 8000 });
          features = zRes.data?.features || [];
        } catch (ze) {
          console.warn('NWS alerts by zone failed:', ze.message);
        }
      }
      if (features.length === 0 && state) {
        try {
          const aRes = await axios.get(`${NWS_BASE}/alerts/active?area=${state}`, { headers, timeout: 8000 });
          features = aRes.data?.features || [];
        } catch (ae) {
          console.warn('NWS alerts by area failed:', ae.message);
        }
      }

      // Keep only alerts that include our office (e.g. BOX) or our state's counties (e.g. /county/MA)
      // to exclude alerts that only affect other regions (e.g. Albany/NY)
      const ourOffice = zoneId ? zoneId.replace(/\d+$/, '') : null;
      if (ourOffice || state) {
        features = features.filter((f) => {
          const zones = f.properties?.affectedZones || [];
          return zones.some(
            (z) =>
              typeof z === 'string' &&
              ((ourOffice && z.includes('/forecast/' + ourOffice + '/')) || (state && z.includes('/county/' + state)))
          );
        });
      }
    }

    const alerts = mapFeaturesToAlerts(features);
    cache.set(cacheKey, alerts, CACHE_TTL);
    if (alerts.length > 0) {
      console.log('[NWS]', alerts.length, 'alert(s):', alerts[0].event);
    }
    return alerts;
  } catch (e) {
    console.warn('NWS alerts error:', e.message);
    return [];
  }
}

/**
 * NWS gridpoint forecast: daily minimum air temp (°F) per calendar day in America/New_York.
 * Used with Tempest for conservative (min-of-sources) planting guidance.
 * @returns {Map<string, number>} dateKey YYYY-MM-DD -> min F
 */
async function getForecastDailyLowMinFMap() {
  const lat = process.env.TEMPEST_LATITUDE;
  const lon = process.env.TEMPEST_LONGITUDE;
  if (!lat || !lon) return new Map();

  const headers = { 'User-Agent': USER_AGENT, 'Accept': 'application/geo+json' };

  try {
    const ptRes = await axios.get(`${NWS_BASE}/points/${lat},${lon}`, { headers, timeout: 8000 });
    const forecastUrl = ptRes.data?.properties?.forecast;
    if (!forecastUrl || typeof forecastUrl !== 'string') return new Map();

    const fcRes = await axios.get(forecastUrl, { headers, timeout: 8000 });
    const periods = fcRes.data?.properties?.periods || [];
    const map = new Map();

    for (const p of periods) {
      if (p.temperature == null) continue;
      const isF = p.temperatureUnit === 'F' || p.temperatureUnit === 'fahrenheit';
      const tempF = isF ? Number(p.temperature) : (Number(p.temperature) * 9) / 5 + 32;
      if (!Number.isFinite(tempF)) continue;
      const start = p.startTime;
      if (!start) continue;
      const key = new Date(start).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const prev = map.get(key);
      if (prev == null || tempF < prev) map.set(key, tempF);
    }

    return map;
  } catch (e) {
    console.warn('[NWS] forecast daily lows failed:', e.message);
    return new Map();
  }
}

module.exports = { getActiveAlerts, getForecastDailyLowMinFMap };
