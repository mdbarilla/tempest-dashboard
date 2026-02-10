# Release Planning

**Last updated**: 2026-02-09  
**Status**: 1.4.8 deployed to production (2026-02-08)

---

## Pending (ready for next deploy)

- **Condition tints restored**: `toConditionCategory` + `data-condition` useEffect back in App.js; snow/rain/drizzle/cloudy shift backgrounds (lighten/darken-more/stormy) via tokenized CSS vars.
- **CSS cleanup**: Removed dead gradient overlay code from index.css.
- **1.4.9 UI fixes (done)**: Metric detail no longer flashes loading when cache hit (useHistoricalData initializes from cache). Modal scroll lock applied to `.app` so backdrop blur renders. Conditions list: entrance animation + stagger; mobile text overflow/ellipsis. Precipitation log: optional time per entry (e.g. ".5\" at 4pm"). Dashboard passes `onMetricClick` so metric detail opens with correct nav state.

---

## 1.5.0 Plan: Tappable Cards & Metric Detail (COMPLETE)

**Shipped in 1.4.5–1.4.7** (version stayed 1.4.x) — Metric cards are tappable; detailed graphs available via modal with 24h/3d/7d time ranges, pagination between metrics, and swipe navigation.

---

## 1.4.4 Release: Conditions List View (COMPLETE)

**Deployed**: 2026-01-29

- **Routes:** `/` = default dashboard, `/conditions` = conditions list (list on mobile, equal-sized grid on tablet/desktop).
- **Footer:** List vs. grid icon next to the theme toggle; toggles between dashboard and conditions list. May evolve into primary navigation.
- **New:** `pages/ConditionsList.js`, `utils/conditions-metrics.js`, `components/ViewToggle.js`. Reuses `MetricIcon`, `Sparkline`, `PrecipitationLogger`, design tokens.
- **Dependency:** `react-router-dom` added to dashboard; run `npm install` in `apps/dashboard` before build.

## Bug: Reset to API (Conditions)

### Summary

"Reset to API" in the condition corrector is intended to remove the user's correction and show the raw Tempest API condition. **Observed**: it often reverts to the *last correction* (e.g. a previous override) instead of the live API value.

### Current Implementation (1.4.1)

- **GET /complete**: When applying a correction, `data.forecast.current` is replaced with a **new** object (spread) so the Tempest **cache** is not mutated.
- **DELETE /correction/:id**:
  - Query `obs_timestamp`: when present and valid, after `deleteConditionCorrection(id)`:
    - `db.deleteCorrectionsInWindow(obsTimestamp, 24*60)` to remove any other corrections in the same window.
    - `tempestAPI.clearCache()` so the next `/complete` refetches from the Tempest API.
  - Frontend sends `?obs_timestamp=${current.timestamp}` on Reset to API.

### Suspected Causes (for 1.4.2)

1. **Cache mutation (partially addressed)**: Cloning `forecast.current` on apply should prevent polluting the Tempest cache. Verify `getCompleteWeather` / `getForecast` never receive a mutated `forecast` from a previous request.
2. **Other corrections in window**: `getRecentCorrection(obsTimestamp, 24*60)` returns the single most recent correction in ±24h. If multiple corrections exist, deleting only the current one can leave an older one that becomes "most recent" after reload. `deleteCorrectionsInWindow` should remove all in that window; confirm it is called and that its window matches `getRecentCorrection`.
3. **`obs_timestamp` not sent or wrong**: Confirm the frontend sends `current.timestamp` correctly and the backend receives it (e.g. `req.query.obs_timestamp`). If missing, the reset branch (deleteCorrectionsInWindow + clearCache) is skipped.
4. **`clearCache` or Tempest fetch**: Ensure `tempestAPI.clearCache()` runs and that the next `getForecast`/`getCurrentWeather` hits the API rather than a stale in-memory cache.

### Next Steps for 1.4.2

1. **Runtime verification**: Re-add minimal debug logs (or run under a debugger) to confirm:
   - Frontend: `correctionId`, `current.timestamp`, and the DELETE URL.
   - Backend DELETE: `obs_timestamp` received, `willRunResetBranch`, `deleteCorrectionsInWindow` result, and that `clearCache` is called.
   - GET /complete (after a reset): `correction` (null expected), `shouldApply` (false), and `data.forecast.current.conditions` (should be raw API).
2. **Fix from evidence**: Use log output to see where the flow fails (e.g. `obs_timestamp` missing, `deleteCorrectionsInWindow` not clearing the right rows, or cache still serving old data), then apply a targeted fix.
3. **Tests**: If feasible, add a backend or e2e test: create correction → DELETE with `obs_timestamp` → GET /complete → assert `corrected` is false and `conditions` matches the Tempest response.

### Relevant Code

- `apps/dashboard/src/components/CurrentWeather.js`: `handleCancelCorrection`, `correctionId`, `current.timestamp`.
- `backend/api/weather.js`: GET `/complete` (correction apply + clone), DELETE `/correction/:id` (obs_timestamp, deleteCorrectionsInWindow, clearCache).
- `backend/services/database.js`: `getRecentCorrection`, `deleteCorrectionsInWindow`.
- `backend/services/tempest-api.js`: `getForecast`, `getCompleteWeather`, `clearCache`.

---

## Planned for 1.4.9 — UI bugs + precip (implemented)

1. ~~**Fix animated refresh when clicking a metrics card**~~: useHistoricalData now initializes from cache so the modal doesn’t flash loading when opening from a card; dashboard passes `onMetricClick` for correct nav state.
2. **Rows swipeable**: Current swipe-to-open detail on conditions list retained; no change.
3. ~~**Animation on list rows / cards**~~: Entrance animation (`conditionsListCardEnter`) + stagger delay per card on conditions list.
4. ~~**Fix horizontal text on mobile**~~: `.conditions-list-card` text (label, secondary, condition, value) use overflow/ellipsis and min-width: 0 on mobile.
5. ~~**Precipitation Log — Editable Timestamp**~~: Add-entry form has optional “Time (optional)” field; supports e.g. “4:00 PM” or leave blank for now.
6. ~~**Modal Backdrop Blur**~~: Scroll lock applied to `.app` instead of `body` so `backdrop-filter` on the modal overlay renders correctly.

---

## Planned for 1.5.0 — LLM historical data chat + bug fixes

- **LLM historical chat:** Lightweight in-app chat to query Tempest historical DB with helpful text and optional inline charts. MVP: structured commands; upgrade: optional LLM.
- **LLM bug fixes:** Fix "Condition summary unavailable" (Bug #1); LLM prompt refinements for generic/repetitive output (Bug #4).
- **Details:** `docs/plans/plan-1.6.0-llm-historical-chat.md`

---

## Planned for 1.6.0 — Radar preview tile

- **Goal:** Add a radar preview as the first metrics tile when conditions indicate precipitation (rain, snow, freezing rain, drizzle, sleet, wintry mix, thunderstorms).
- **Display:** Icon + title like other tiles; radar imagery as tile background. Hidden when conditions are clear, partly cloudy, cloudy, fog, etc.
- **Layout:** First in list; full-width row on tablet/desktop grid to avoid uneven tile counts. Mobile: full-width list row.
- **Data source:** RainViewer API (free, personal/educational) or NOAA WMS. Attribution required.
- **Details:** `docs/plans/plan-1.5.0-radar-tile.md`

---

## TBD (Wind chart)

- **Wind Detail Chart — Dual Trend Lines**: Speed (solid) and gusts (dashed) as separate trend lines
- **Wind Chart Seismograph Effect**: 5-min bucketing or smoothing for jagged 24h wind lines

---

## Deprecated / Removed

- ~~Increase padding above cards~~ — Not needed
- ~~Improve reflow at widest monitors~~ — Not needed
- ~~Condition-based ambient overlays~~ — **Deprecated** (all related plans removed)

---

## Deployment Instructions

### Deploy 1.4.5

```bash
./scripts/auto-build-and-deploy.sh network
# or: build-only, then scp tarball and extract on Pi
```

On Pi after extract:

```bash
cd ~/deployment/backend
npm install --production  # Installs rss-parser and cheerio if not already present
pm2 restart tempest-backend
```

Hard-refresh the browser to load the new dashboard.

**Note**: News feature requires `rss-parser` and `cheerio` dependencies. If backend fails to start, ensure these are installed:
```bash
cd ~/deployment/backend
npm install rss-parser cheerio --save
pm2 restart tempest-backend
```
