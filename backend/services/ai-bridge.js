const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs').promises;
const path = require('path');

const CACHE_TTL = 600; // 10 min
const cache = new NodeCache({ stdTTL: CACHE_TTL, checkperiod: 120 });

/** Load recent thumbs-down descriptions from llm_feedback.jsonl for prompt tuning. */
async function loadRecentThumbsDown(max = 5) {
  const filePath = process.env.LLM_FEEDBACK_PATH || path.join(process.cwd(), 'data', 'llm_feedback.jsonl');
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const downs = [];
    for (let i = lines.length - 1; i >= 0 && downs.length < max; i--) {
      try {
        const rec = JSON.parse(lines[i]);
        if (rec.label === 'down' && rec.description && typeof rec.description === 'string') {
          const d = String(rec.description).trim();
          if (d.length > 5 && d !== 'Condition summary unavailable.') downs.push(d);
        }
      } catch (_e) { /* skip malformed lines */ }
    }
    return downs;
  } catch (_e) {
    return [];
  }
}

/** Load user-provided rewrites (good examples) from llm_feedback.jsonl. */
async function loadRecentRewrites(max = 3) {
  const filePath = process.env.LLM_FEEDBACK_PATH || path.join(process.cwd(), 'data', 'llm_feedback.jsonl');
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const rewrites = [];
    for (let i = lines.length - 1; i >= 0 && rewrites.length < max; i--) {
      try {
        const rec = JSON.parse(lines[i]);
        if (rec.label === 'down' && rec.rewrite && typeof rec.rewrite === 'string') {
          const r = String(rec.rewrite).trim();
          if (r.length > 5 && r.length <= 200) rewrites.push(r);
        }
      } catch (_e) { /* skip malformed lines */ }
    }
    return rewrites;
  } catch (_e) {
    return [];
  }
}

function getBridgeUrl(nwsAlerts, opts = {}) {
  const base = process.env.AI_BRIDGE_URL || 'http://localhost:5000';
  const path = '/weather';
  let url = `${base.replace(/\/$/, '')}${path}`;
  const params = new URLSearchParams();
  const first = nwsAlerts?.[0];
  if (first) {
    if (typeof first.event === 'string') params.set('nws', first.event);
    if (typeof first.headline === 'string' && first.headline.length > 0) {
      params.set('nws_headline', first.headline.slice(0, 120));
    }
  }
  if (opts?.correctedCondition && typeof opts.correctedCondition === 'string') {
    params.set('corrected_condition', opts.correctedCondition);
  }
  if (opts?.manualPrecipInches != null && !Number.isNaN(Number(opts.manualPrecipInches))) {
    params.set('manual_precip_in', String(Number(opts.manualPrecipInches)));
  }
  if (Array.isArray(opts?.badExamples) && opts.badExamples.length > 0) {
    params.set('bad_examples', JSON.stringify(opts.badExamples.slice(0, 5)));
  }
  if (Array.isArray(opts?.goodExamples) && opts.goodExamples.length > 0) {
    params.set('good_examples', JSON.stringify(opts.goodExamples.slice(0, 3)));
  }
  // So the bridge can use the correct period (morning/afternoon/evening) even if the Pi's clock/TZ is off
  params.set('hour', String(new Date().getHours()));
  const qs = params.toString();
  if (qs) url += `?${qs}`;
  return url;
}

/**
 * Fetch atmosphere (description, condition) from the local AI weather bridge (e.g. weather_bridge.py on :5000).
 * Returns { description, condition, source: 'local_llm' } or null when disabled, bridge down, or timeout.
 * @param {Array} [nwsAlerts] - Optional NWS alerts from getActiveAlerts; first alert's event is sent as ?nws= for prompt context.
 * @param {{ bypassCache?: boolean }} [opts] - bypassCache: true to skip the 10‑min cache and fetch fresh from the bridge.
 */
async function getAtmosphere(nwsAlerts, opts = {}) {
  const enabled = process.env.AI_BRIDGE_ENABLED;
  if (enabled === 'false' || enabled === '0') {
    return null;
  }

  // Check if bridge URL is a local network address
  // If it's a .local domain or localhost/127.0.0.1, and we're in production serving external traffic,
  // skip the bridge to avoid triggering browser permission prompts
  const bridgeUrl = process.env.AI_BRIDGE_URL || 'http://localhost:5000';
  const isLocalNetworkUrl = bridgeUrl.includes('.local') || 
                           bridgeUrl.includes('localhost') || 
                           bridgeUrl.includes('127.0.0.1') ||
                           /^https?:\/\/192\.168\./.test(bridgeUrl) ||
                           /^https?:\/\/10\./.test(bridgeUrl) ||
                           /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./.test(bridgeUrl);
  
  // If explicitly enabled, allow it even for local network URLs
  // Otherwise, in production with local network URLs, disable to avoid permission prompts
  if (isLocalNetworkUrl && process.env.NODE_ENV === 'production' && enabled !== 'true') {
    return null;
  }

  const timeout = parseInt(process.env.AI_BRIDGE_TIMEOUT, 10) || 3000;
  const [badExamples, goodExamples] = await Promise.all([loadRecentThumbsDown(5), loadRecentRewrites(3)]);
  const url = getBridgeUrl(nwsAlerts, { ...opts, badExamples, goodExamples });

  if (!opts.bypassCache) {
    const cached = cache.get('atmosphere');
    if (cached) {
      // Don't serve cached "Initializing art engine..." — fetch fresh so we pick up bridge updates.
      const init = (cached.description || '').trim() === 'Initializing art engine...';
      if (!init) return cached;
    }
  }

    try {
    const res = await axios.get(url, { timeout, validateStatus: () => true });
    const data = res.data;
    if (res.status !== 200 || typeof data !== 'object' || data === null) {
      const errMsg = res.status !== 200
        ? `Bridge returned ${res.status}`
        : typeof data !== 'object' || data === null
          ? 'Invalid response from bridge (non-JSON)'
          : 'Invalid response from bridge';
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[ai-bridge]', errMsg, 'URL:', url);
      }
      return { description: null, condition: null, source: 'local_llm', error: errMsg };
    }

    let description = (data?.ai_prompt || data?.description || '').trim() || null;
    const condition = data?.condition || null;
    const generatedAt = typeof data?.ai_prompt_generated_at === 'number' ? data.ai_prompt_generated_at : undefined;
      if (!description && !condition) {
        return null;
      }
      // Bridge reachable but ai_prompt empty (e.g. LLM not ready yet) — give UI something to show
      if (!description && condition) {
        description = 'Condition summary unavailable.';
      }

    const atmosphere = {
      description: description || null,
      condition: condition || null,
      source: 'local_llm',
      ...(generatedAt != null && { generatedAt })
    };
    // Don't cache "Initializing art engine..." — next fetch will hit bridge again so we pick up
    // "Condition summary unavailable." or a real description instead of hanging on "loading" for 10 min.
    const isInitializing = (atmosphere.description || '').trim() === 'Initializing art engine...';
    if (!isInitializing) {
      cache.set('atmosphere', atmosphere);
    }
    return atmosphere;
  } catch (e) {
    const errMsg = e.code || e.message || String(e);
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[ai-bridge] Bridge request failed:', errMsg, 'URL:', url);
    }
    return { description: null, condition: null, source: 'local_llm', error: errMsg };
  }
}

/**
 * Clear the atmosphere cache so the next getAtmosphere() fetches fresh from the bridge.
 * Used by POST /api/weather/atmosphere/reset for debugging "Conditions summary loading".
 */
function clearAtmosphereCache() {
  cache.del('atmosphere');
}

/**
 * Debug: fetch the bridge /weather response directly (no cache). For GET /api/weather/atmosphere?debug=1.
 */
async function fetchAtmosphereRaw(nwsAlerts) {
  const timeout = parseInt(process.env.AI_BRIDGE_TIMEOUT, 10) || 3000;
  const [badExamples, goodExamples] = await Promise.all([loadRecentThumbsDown(5), loadRecentRewrites(3)]);
  const url = getBridgeUrl(nwsAlerts, { badExamples, goodExamples });
  try {
    const res = await axios.get(url, { timeout });
    return { url, status: res.status, body: res.data, error: null };
  } catch (e) {
    return { url, status: null, body: null, error: e.code || e.message || String(e) };
  }
}

module.exports = { getAtmosphere, fetchAtmosphereRaw, clearAtmosphereCache };
