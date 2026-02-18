# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned for 1.6.0 (LLM)
- **LLM historical chat**: In-app chat for historical data queries
- **Bug #1**: Fix "Condition summary unavailable"
- **Bug #4**: LLM prompt refinements
- **Details:** `docs/plans/plan-1.6.0-llm-historical-chat.md`

### Planned for 1.7.0 (Radar)
- **Radar preview tile**: Conditional tile (first in metrics list) when precip conditions; icon + title + radar background; full-width on tablet grid. See `docs/plans/plan-1.5.0-radar-tile.md`.

### TBD (Wind chart improvements)
- **Wind Detail Chart — Dual Trend Lines**: Speed + gusts as separate trend lines
- **Wind Chart Seismograph Effect**: 5-min bucketing or smoothing for jagged 24h wind lines

### Deferred
- **Mobile list view row swipeability**: Not a top priority; other changes deployed first.

## [1.5.0] - 2026-02-18

### Added
- **History view**: Wunderground-style hourly weather table at `/history` with date picker (up to 7 days back, 10 days forward). Merges local observations (past) with Tempest forecast (future) for today. Hourly columns: Time, Conditions, Temp., Feels Like, Humidity, Wind, Pressure, Dew Point, Precip %, Amount, Cloud Cover.
- **Ask page**: Dedicated full-page chat interface at `/chat`, embedding the Ask modal with persistent page layout and header navigation.
- **Bottom navigation (mobile)**: Fixed bottom nav bar on mobile (≤767px) with Dashboard, Currently, History, and Ask tabs. Active tab uses `--accent-blue`; inactive uses `--text-secondary`.
- **History & Ask links (desktop)**: Navigation links added to the desktop nav row in the CurrentWeather and ConditionsList page headers.
- **Conditions in observations**: `conditions` column added to the observations database table. Data collector now stores the current API condition string with each observation so historical rows reflect accurate conditions in the History view.
- **Hourly API endpoint**: `GET /api/weather/hourly/:date` returns a 24-row array for a given date, merging local observations with Tempest forecast hourly/daily data, manual precipitation overlays, and condition corrections.

### Changed
- **Page header shared styles**: `page-header.css` extracted as a shared import for History and Chat page headers. Defines title, nav row, updated timestamp, and mobile/desktop visibility using design tokens throughout.

### Technical
- `apps/dashboard/src/pages/HistoryPage.js`: Date-picker header, sticky table with staggered row entrance animation, forecast/observation merge, corrected and manually-logged row badges.
- `apps/dashboard/src/pages/ChatPage.js`: Full-page Ask wrapper with shared page header and nav.
- `apps/dashboard/src/components/BottomNav.js`: Mobile bottom nav with `NavLink` active states; hidden at ≥768px.
- `apps/dashboard/src/styles/page-header.css`: Shared header styles for History and Chat pages; all values use design tokens.
- `backend/api/weather.js`: `GET /api/weather/hourly/:date` — hourly bucketing, forecast merge for today/future, manual precip overlay, corrections overlay.
- `backend/services/database.js`: `conditions` column in observations schema; `getCorrectionsForTimestampRange` for hourly overlay; `getManualPrecipitationByTimestampRange` for history overlay.
- `App.js`: Routes for `/history`, `/history/:date`, `/chat`; `BottomNav` rendered at app level; `lastMainView` tracking in `RefreshManager` for History/Ask back-navigation.

## [1.4.11] - 2026-02-09

### Added
- **Temperature chart freezing line**: Faint horizontal reference line at 32°F on the temperature detail chart (dashed, low opacity) to mark the freezing line.

### Changed
- **Precipitation detail on external (towerhill.app)**: Graph, Edit, and History tabs are hidden when the app is opened from towerhill.app (or any non-local host). Only the chart and time-range selector are shown. Edit/add and history content never render. Uses existing `isLocal` from `isLocalAccess()` (towerhill.local, localhost, private IP = local; towerhill.app = external). Prevents external users from editing precipitation.

### Technical
- `App.js`: Pass `isLocal={isLocal}` to `MetricDetailView`.
- `MetricDetailView`: Accept `isLocal`; `effectivePrecipView` forces `'chart'` when `!isLocal` and metric is precipitation; render Graph/Edit/History tab row only when `safeMetric === 'precipitation' && isLocal`; use `effectivePrecipView` for form, history, and footer visibility.
- `MetricChart`: `ReferenceLine` at `y={32}` for `metric === 'temperature'` (strokeOpacity 0.35, dashed).

## [1.4.10] - 2026-02-09

### Added
- **Condition picker redesign**: Header matches metric detail (WeatherIcon + "Condition" label, Fraunces value e.g. "Clear"); condition buttons same size as precip type (0.75rem 1rem, 44px, 0.9rem); submit/cancel fixed at bottom with scrollable body.
- **Stable chart x-axis**: Manual precip and metric switches no longer redraw x-axis labels; chart uses fixed time range (`stableTimeEnd`) so labels stay consistent between metrics.
- **Chart transition (morph)**: When switching metrics via nav, chart stays mounted and receives new data so Recharts morphs (vertical transition) instead of redrawing; draw animation retained on initial load / after spinner.
- **Chart hint copy**: "Hover chart for hourly details" / "Tap chart for hourly details" on all metric detail views.
- **Precip edit layout**: Amount and Time side-by-side on tablet/desktop (768px+); notes section flexes to fill remaining space above "Add to Total".
- **List view tablet cards**: Overlay tint styling (same as condition/precip buttons) instead of bg color shift; `--overlay-on-light` / `--overlay-on-dark` and hover variants.

### Changed
- **Metric detail value font size**: Large value (e.g. "35 %", "Clear") reduced from 2.5rem to 2rem across all metrics and condition picker; unit from 1.5rem to 1.25rem.
- **Modal backdrop blur**: Blur applied on overlay root (6px), `isolation: isolate` for reliable rendering; backdrop div transparent (click target only). Restores frosted-glass effect on tablet/desktop.
- **No full refresh while modal open**: Precip add/delete in metric detail no longer call `onRefresh()`; modal updates via `fetchPrecipHistory()` and chart `refetch()`. One full dashboard refresh on modal close (RefreshManager).
- **Manual precip on 7-day chart**: Dotted reference lines kept; value labels ("X.XX in") hidden on 7-day view only (24h and 3-day unchanged).
- **Precip type buttons**: Match condition edit (overlay/tint only); light mode override in metric detail so no outline treatment from PrecipitationLogger.css.
- **Add to Total button**: Height matches condition modal submit (padding 0.75rem 1rem, font-size 0.9rem).

### Fixed
- **Condition-based background tints**: Restored `toConditionCategory` and `data-condition` in App.js for light-theme background shifts (lighten, darken-more, stormy).
- **Intermittent data refresh in modal**: Full fetch no longer triggered by precip mutations; only chart/history refetch in-modal, refresh on close.
- **CSS cleanup**: Removed unused gradient/overlay code from index.css (`--condition-gradient`, `--condition-accent`, `.app::before` placeholder).
- **Metric detail opening**: No loading flash when opening from card (useHistoricalData from cache); correct back navigation via `onMetricClick`.
- **Conditions list**: Entrance animation + stagger; mobile text overflow/ellipsis for labels and values.
- **Precipitation**: Editable timestamp in add view (Time field; blank = now).

### Technical
- `MetricDetailView`: `chartEndTime` state for stable x-axis; `prevChartRef` + `chartDataToShow` so chart does not unmount on metric switch; `precip-form-amount-time-row`, `precip-form-notes-group`; precip footer submit/cancel override.
- `MetricChart`: `stableTimeEnd` prop, x-domain/ticks from fixed range when set; Line animation 350ms ease-out; manual ReferenceLine labels only when `hours <= 72`.
- `ConditionCorrector`: Header layout (icon + label + Fraunces value), flex body/actions, scoped submit/cancel.
- `Modal.css`: Blur and scrim on `.modal-overlay`; `.modal-backdrop` transparent.
- `ConditionsList.css`: Tablet cards use `--overlay-on-light` / `--overlay-on-dark` and hover.

## [1.4.8] - 2026-02-08

### Added
- **3d/7d chart gap-fill from WeatherFlow**: When `TEMPEST_DEVICE_ID` is set, the backend fills missing hourly buckets in 3d/7d charts using WeatherFlow device observations so charts show full data even when the Pi was offline or the data collector had gaps.
- **Diagnostics for 3d/7d**: `GET /api/weather/recent?hours=72|168&debug=1` returns `meta` with `observationCount`, `bucketsWithData`, and (when device ID set) `stationObservationCount`, `bucketsFilledFromStation`, `deviceIdUsed`, and optional `verification` (local vs station comparison).

### Fixed
- **3d/7d chart gaps**: Charts now show a complete 7-day (or 3-day) series when device observations are enabled; previously only locally collected hours had data.
- **Backend .env loading**: Server loads `.env` from the backend directory (`path.join(__dirname, '.env')`) so `TEMPEST_DEVICE_ID` and other vars are set even when the app is started from the project root.

### Technical
- `backend/services/tempest-api.js`: `getDeviceObservations(deviceId, timeStart, timeEnd)` and `deviceObsArrayToRow()` for WeatherFlow device API (obs_st layout); 5-day limit per request, 2-min cache; optional `TEMPEST_DEVICE_ID` and `CACHE_DEVICE_OBSERVATIONS`.
- `backend/api/weather.js`: Merge station buckets into local buckets for 3d/7d when device ID configured; `meta.deviceIdConfigured`, `meta.bucketsFilledFromStation`; no cache for empty device-obs responses.
- `backend/.env.example`: Comment and optional `TEMPEST_DEVICE_ID` for gap-fill (get device_id from `/stations` API).

## [1.4.7] - 2026-02-07

### Added
- **Design Token System**: Radius, opacity, overlay, and color tokens unified across the app.
  - Radius: `--radius-lg`, `--radius-md`, `--radius-sm`, `--radius-xs`, `--radius-pill`, `--radius-full`
  - Opacity: `--opacity-subtle` through `--opacity-full`
  - Overlays: `--overlay-on-light`, `--overlay-on-dark`, `--accent-overlay`, etc.
  - Modal: `--modal-controls-padding-y`, `--modal-controls-padding-bottom`
- **Card Tint Tokens**: `--bg-card-tint`, `--bg-card-hover` for list card hover states (theme-aware).

### Changed
- **Conditions List (Tablet/Desktop)**: Removed stroke/border; added background tint with brighter hover. Shadow removed. Uses `--bg-card-tint` and `--bg-card-hover`.
- **Condition Change Modal**: Solid outline buttons replaced with color-shift style (background transitions instead of borders).
- **Metric Detail Modal**: Light mode uses tan shades throughout—no teal on 24h/3d/7d buttons, pagination icons, or chart hover badge. Blue reserved for trend lines and advisory only. Dark mode retains accent-blue for active states.
- **Modal Bottom Padding**: Reduced by half using `--modal-controls-padding-bottom` token.
- **Close Button**: Removed focus outline stroke on modal X icon that appeared on open.
- **Connection Banner**: Uses tokenized status colors (`--status-offline`, `--status-stale`, `--text-on-status`, `--banner-btn-*`).

### Fixed
- **Dark Mode Cards**: Conditions list cards now correctly use dark theme colors (`--bg-card-tint` defined in `body.theme-dark`).
- **Wind Card Vertical Rule (1440px+)**: Carousel divider now displays for the wind card on largest desktop breakpoint.
- **Cold Weather Advisory Pill**: Pill uses solid `--bg-primary` background so carousel content does not show through.

### Technical
- Tokenized radius, opacity, overlays, and modal/panel colors in `index.css`. Components refactored to use tokens.
- Debug panel: Atmosphere debug panel only shows when `NODE_ENV === 'development'`. Hidden in production.
- Removed debug `console.log` calls from frontend (NewsCarousel), backend (news-service pubDate/first-article logging), and instrumentation from useHistoricalData, MetricChart, MetricDetailView, weather API.

## [1.4.6] - 2026-02-07

### Changed
- **3d/7d Chart Data Pipeline**: Backend now fetches the most recent observations first (DESC + limit) so recent data is never truncated when the database has more rows than the fetch limit. Previously, ASC order could drop the newest data.
- **No Interpolation for Missing Data**: Removed interpolation and backfill for 3d/7d hourly buckets. Buckets without observations now return `null`, so charts show gaps instead of flatlines or fabricated values.
- **Shorter Cache for 3d/7d**: Chart data cache TTL reduced to 1 minute for 3d/7d views (from 5 minutes) so updates appear sooner.

### Fixed
- **3d/7d Flatlines**: Extended flatlines caused by interpolating or backfilling across large gaps are eliminated. Charts now display gaps where data is missing.
- **7d Data Truncation**: With observation limit 11000 for 7d and DESC fetch order, the full 7-day window is now correctly populated from the most recent data.

### Technical
- `backend/services/database.js`: `getObservationsByTimestampRange` now uses `ORDER BY timestamp DESC LIMIT N` in a subquery, then re-sorts ASC for processing. Increased default limit to 10000.
- `backend/api/weather.js`: Removed interpolation logic; buckets without observations use null. Observation limit 11000 for 7d, 5000 for 3d.
- `apps/dashboard/src/hooks/useHistoricalData.js`: `getCacheTTL(hours)` — 1 min for hours > 24, 5 min for 24h. Pass null points through for 3d/7d (no filter) so `connectNulls={false}` renders gaps.
- `apps/dashboard/src/components/MetricChart.js`: Removed unused `isMobile` state and resize listener.

## [1.4.5] - 2026-02-06

### Added
- **3-Day Time Range**: New 3-day (72h) window in metric detail chart time range selector.
- **Modal Pagination**: Subtle pagination dots beneath the chart in metric detail modal to click between metrics (pressure, humidity, wind, precipitation, solar, temperature).

### Changed
- **Time Range Selector**: Replaced 30-day option with 3-day. Options are now 24h, 3d, 7d.
- **7-Day Chart Data**: Backend now uses hourly averages for 3d/7d views to ensure full time span coverage (previously limited by raw observation row count).
- **Modal UX**: Inset modal with padding around overlay; reduced backdrop blur (4px → 2px); modal closes on backdrop click. Container slightly smaller on desktop (85% viewport) to reveal more dashboard below.
- **Hourly Averages**: Added precipitation, solar radiation, and UV to hourly aggregates for 3d/7d metric charts.

### Fixed
- **Chart Tooltip Position**: Tooltips now appear near the cursor/data point instead of upper-left. Simplified tooltip logic and enabled `allowEscapeViewBox` for correct positioning in modals.
- **7-Day X-Axis**: 7-day view now shows full 7 days of data with correct date labels on the x-axis (hourly aggregation fixes coverage).

### Technical
- `MetricChart.js`: allowEscapeViewBox on Tooltip; simplified CustomTooltip (removed delay/visibility logic).
- `TimeRangeSelector.js`: 24h, 3d, 7d ranges.
- `MetricDetailView.js`: Pagination dots; container stopPropagation; aria-label for 3d.
- `MetricDetailView.css`: Overlay padding; reduced blur; pagination styles.
- `backend/api/weather.js`: Use hourly averages for hours > 24; include precip/solar/uv in mapping.
- `backend/services/database.js`: getHourlyAverages includes max_precip_today, avg_solar_radiation, max_uv_index.

## [1.4.4] - 2026-01-29

### Added
- **Conditions List View**: New dedicated view (`/conditions`) displaying all weather metrics in a unified grid/list layout. Accessible via "List" link in header (replaces dashboard overview). Shows all conditions in equal-sized cards with historical trendlines, matching the existing visual design system.
- **View Toggle in Header**: Text-based toggle ("• List" / "• Dashboard") positioned inline with the timestamp in both dashboard and conditions list headers. Provides consistent navigation between overview and detailed conditions views.
- **LLM Description in Conditions Card**: Atmospheric description (LLM-generated) now appears in the conditions list view under the condition text, with thumbs up/down feedback matching dashboard behavior. Includes staleness checks and sessionStorage persistence.

### Changed
- **Historical Trendlines Only**: All trendlines in conditions list now use **only** historical data from `/recent` endpoint. Removed forecast fallback to ensure trendlines accurately reflect past observations, not future hourly forecast. Temperature and other metric trendlines now correctly show historical trends.
- **Header Padding Consistency**: Dashboard and conditions list headers now use identical padding values (`var(--padding-mobile)`, `var(--padding-tablet)`, `var(--padding-desktop)`) to prevent layout shifts when toggling between views.
- **View Toggle Styling**: Replaced icon-based toggle with text labels ("List" / "Dashboard") matching timestamp typography (font-size, weight, color) for cohesive header appearance. Spacing between timestamp, bullet, and label is consistent.

### Fixed
- **Temperature Trendline**: Fixed issue where temperature trendline showed incorrect direction (forecast-based warming instead of historical cooling). Trendlines now always reflect actual past observations from the last 12 hours.
- **Layout Shift on View Toggle**: Eliminated padding differences between dashboard and conditions list headers that caused content to shift when switching views.

### Technical
- `apps/dashboard/src/pages/ConditionsList.js`: New page component with grid/list layout, metric cards, trendlines, and LLM integration.
- `apps/dashboard/src/components/ViewToggle.js`: Text-based navigation component with React Router integration.
- `apps/dashboard/src/utils/conditions-metrics.js`: `getTrendData()` now returns only historical data (no forecast fallback).
- `apps/dashboard/src/styles/App.css`: View toggle styling matches timestamp typography.
- `apps/dashboard/src/components/CurrentWeather.css`: Header row styling for inline timestamp + toggle.
- `apps/dashboard/src/pages/ConditionsList.css`: Header and grid padding aligned with dashboard using shared padding variables.
- React Router integration: `/` for dashboard, `/conditions` for conditions list.

## [1.4.3] - 2026-01-27

### Added
- **Local News Headlines Carousel**: New carousel below the 10-day forecast displaying hyper-local news from Wayland Post and Weston Observer. Articles are intelligently prioritized (weather/environment/public safety first, then events/community, then politics/taxes) and obituaries, newsletters, and print editions are filtered out. 
- **Smart Environment Detection**: News is **disabled by default everywhere**. Users can enable with `?news=1` URL parameter on any version (towerhill.app or towerhill.local).
- **News API Endpoint**: `GET /api/weather/news` returns prioritized, filtered headlines with caching (1 hour refresh). Supports RSS feeds (preferred) and HTML scraping fallback. `?refresh=1` bypasses cache.
- **Enhanced Image Extraction**: Fetches article images from multiple sources (RSS enclosures, Open Graph tags, featured images) with fallback to article page scraping for top articles.
- **NewsCarousel Component**: Horizontal scrolling carousel with card layout matching forecast styling. Features 1x1 thumbnails to the right of headlines, bottom-aligned timestamps, and subtle background color shifts on hover (60% opacity default, 100% on hover).

### Changed
- **Card Layout**: Headlines display in full (no truncation) with square thumbnails positioned to the right. Timestamps align at the bottom of cards regardless of headline length.
- **Card Styling**: Removed borders, using subtle background overlay (60% opacity) that darkens to 100% on hover. Consistent 280px min-width across all breakpoints. Reduced bottom padding to 1.5rem.

### Technical
- `backend/services/news-service.js`: RSS/HTML parsing, priority scoring, comprehensive filtering (obituaries, newsletters, print editions), source interspersing, robust timestamp parsing. Uses `rss-parser` and `cheerio` libraries.
- `apps/dashboard/src/components/NewsCarousel.js`: React component with opt-in rendering via `?news=1` URL parameter (disabled by default everywhere).
- News carousel fetches on mount and refreshes every 10 minutes when enabled.
- Backend dependencies: `rss-parser@^3.13.0`, `cheerio@^1.0.0-rc.12`.
- Improved timestamp parsing with fallback to `isoDate` when `pubDate` is invalid.

## [1.4.1] - 2026-01-25

### Added
- **LLM thumbs up/down (local-only)**: Inline 👍/👎 after the atmospheric description. Thumbs up: "✓ Thanks" and hide controls for the session (and until new LLM phrase on refresh). Thumbs down: hide description, show "Fetching…", trigger atmosphere refresh; stored in `POST /api/weather/atmosphere/feedback` for future tuning. Session persistence via `sessionStorage` to avoid duplicate votes.
- **Atmosphere feedback payload**: Feedback now includes NWS alerts, condition (corrected + original), wind speed/gust/direction, precip (station + manual), and solar/UV. Same fields are passed into the LLM prompt via the bridge.
- **Condition correction persistence (precip %)**: When submitting a correction, optional `precip_pct_at_correction` (e.g. 90). Correction stays applied until current hourly precip % drops below that value (e.g. Snow override at 90% persists until precip drops). Reverts to API condition when precip drops. Uses same 24h window as `getRecentCorrection` for lookup.
- **Precipitation display when manual logged**: When manual precip exists, the metrics card shows e.g. "snow (manual) · 0.5 in since 10:30" instead of "0.00 in last hour". Precip type and amount order swapped in the log/edit modal (type first, then amount).
- **Precipitation trendline**: Hourly and metrics sparklines now merge Tempest `precip_today` with today's manual entries so the trend reflects both sources.

### Changed
- **LLM prompt**: NWS alerts strongly emphasized—phrases like "Calm" should not override Winter Storm Warning, etc. Don't use "humid" for cold; avoid repeating raw conditions/percentages; show, don't tell. Good example: "Cold and calm. Watching an incoming winter storm." Prompt includes meteorologist/weather-watcher persona and interpret-don't-repeat guidance. Good/Don't examples expanded.
- **Condition-based background tints (light theme)**: `data-condition` on `<html>` drives CSS classes: **lighten** (#f8fafc) for snow, sleet, freezing rain; **darken** (#D4DEED) for cloudy, rain, drizzle, overcast; **stormy** (#b6c4d9) for thunderstorm, fog, mist, haze; **neutral** for clear, partly cloudy, mostly cloudy. Corrected conditions also drive the tint.
- **Accent and trendlines**: New `--accent-blue` for links and metrics trendlines. Primary hourly trendline uses `--text-secondary` (no opacity). Metrics cards use accent for sparklines.
- **Modals**: NWS alert, precip log, precip edit, and condition edit modals aligned for size, padding, and mobile behavior. Ease/transition on open/close for less jank. "Corrected" label matches condition menu button background.
- **Reset to API (backend)**: DELETE `/correction/:id` accepts `?obs_timestamp=`; when present, runs `deleteCorrectionsInWindow` and `tempestAPI.clearCache()`. GET `/complete` clones `forecast.current` when applying a correction to avoid mutating the Tempest cache. *(User reports Reset to API still not fully restoring Tempest value; deferred to 1.4.2.)*

### Technical
- `db.deleteCorrectionsInWindow(obsTimestamp, windowMinutes)` for batch delete in same window as `getRecentCorrection`.
- `condition_corrections.precip_pct_at_correction` and `precip_pct_at_correction` in POST body and apply logic (`precipStillHigh`).
- `App.js`: `getConditionTint()` for `data-condition`; condition uses `forecast?.current?.conditions` (corrected or API). `index.css`: `.lighten`, `.darken`, `.stormy` overrides for `--bg-primary` and related.
- `POST /api/weather/atmosphere/feedback`: stores `nwsAlerts`, `conditionCorrected`, `conditionOriginal`, `windSpeed`, `windGust`, `windDirection`, `precipToday`, `precipLastHour`, `precipManualInches`, `precipManualType`, `solarRadiation`, `uv`.

## [1.4.0] - 2026-01-25

### Added
- **Local-only gate**: ConditionCorrector, PrecipitationLogger, and the LLM atmospheric description are shown only when the app is opened via **towerhill.local**, **localhost**, or a **private IP** (e.g. 192.168.x, 10.x, 172.16–31.x). On **towerhill.app** (Cloudflare tunnel) they are hidden; the theme toggle remains available to everyone.
- **LLM atmospheric description**: Short AI-generated description of current conditions under the hourly carousel, with subtle italic styling. Sourced from the local AI bridge (`ai_prompt` → `description`). **Local-only in v1.4.0**; can be made public in a later build.
- **AI bridge integration**: `backend/services/ai-bridge.js` fetches from the weather bridge (default `http://localhost:5000/weather`), 10‑min cache, 3‑s timeout. `atmosphere: { description, condition, source: 'local_llm' }` is merged into `/api/weather/complete`. Env: `AI_BRIDGE_URL`, `AI_BRIDGE_TIMEOUT`, `AI_BRIDGE_ENABLED`. (Condition-based overlay CSS deferred to 1.4.1.)
- **POST /api/weather/atmosphere/reset**: Clears the atmosphere cache so the next `/complete` or `/atmosphere` fetch gets a fresh value from the bridge. Used by `scripts/ping-atmosphere.sh --reset`.
- **scripts/ping-atmosphere.sh**: Pings the weather bridge and backend atmosphere; prints `ai_prompt`, `condition`, `art_engine_status`, `last_ai_error`, `ollama_model`. `--reset` runs the reset endpoint and reminds how to restart the bridge on the Pi. See `raspberry-pi/weather_bridge/terminal-commands.md`.

### Fixed
- **Conditions summary / "loading"**: When the LLM returns empty, too short, or condition-only—and `ai_prompt` is empty or `"Initializing art engine..."`—the bridge sets `"Condition summary unavailable."` (also in the Ollama `except` path). **Empty-response retry**: if the first `ollama.chat` returns empty, the bridge does one extra call with a shorter prompt to improve reliability with `gemma3:270m`.
- **Refresh atmosphere / first load**: Initial load uses `forceRefreshAtmosphere=true` so the first `/complete` request uses `?refresh_atmosphere=1`. If `localStorage` has `atmosphere.description === 'Initializing art engine...'`, the frontend does not restore it, clears `weatherData`/`weatherDataTimestamp`, and fetches with `forceRefreshAtmosphere` so the UI does not stay on "Conditions summary loading…".

### Changed
- **Theme (auto)**: Default day/night now follows **sunrise/sunset** from `forecast.daily[0]` when available. **Fallback** when no sun times: **6pm–6am** (was 8pm–6am). No new backend dependencies (suncalc not added).
- **Theme toggle**: Always shown for both local and external users.
- **Toggle → Auto**: When switching the theme toggle back to Auto, the inline logic uses `forecast.daily[0].sunrise`/`sunset` or the 6pm–6am fallback.
- **fetchWeather**: New `forceRefreshAtmosphere` parameter; **Refresh atmosphere** and the initial load pass it so `/complete` uses `?refresh_atmosphere=1` when needed.

### Technical
- `apps/dashboard/src/utils/access.js`: `isLocalAccess()` for hostname-based local vs public.
- `CurrentWeather`: `isLocal`, `atmosphere` props; ConditionCorrector and `.atmospheric-description` block gated by `isLocal` (and `atmosphere?.description` for the block).
- `Metrics`: `isLocal` prop; PrecipitationLogger only when `isLocal`.
- `App.js`: theme 6pm–6am fallback, `atmosphere` and `isLocal` passed to `CurrentWeather`; `forceRefreshAtmosphere` and localStorage sentinel handling. (`data-condition` effect deferred to 1.4.1.)
- **Backend**: `clearAtmosphereCache()` in `ai-bridge.js`; `GET /api/weather/atmosphere?debug=1` skips the NWS call to avoid hangs during local debugging.
- **Weather bridge**: `/weather` includes `ollama_model` for verification; empty-response retry with shorter prompt. See `raspberry-pi/weather_bridge/README.md` and `terminal-commands.md`.

## [1.3.9] - 2026-01-24

### Added
- **Storm / NWS Warning Label**: Pill showing active NWS alert (e.g. Winter Storm Warning) after the menu icon (tablet/desktop) and between the big temp and hourly carousel (mobile). Outline style with `--accent-blue`; tap/click opens full text in an overlay (tablet/desktop) or full-page (≤480px). Data from NWS API; Tempest API does not provide alerts. See `docs/plans/archive/plan-1.3.9-storm-warning.md`.
- **NWS alert refresh**: `GET /api/weather/alerts?refresh=1` and `GET /api/weather/complete?refresh_alerts=1` bypass the 10‑min in‑memory cache. Dashboard **Retry** and **Refresh** use `?refresh_alerts=1` so NWS updates on manual refresh.

### Changed
- **NWS fetching**: Primary `/alerts/active?point=lat,lon` (only alerts whose geometry contains the station); fallback `?zone=` then `?area=STATE` with `affectedZones` filter (BOX or MA) to exclude Albany/NY‑only alerts.
- **Storm pill (mobile)**: Placed between temperature and hourly carousel with tuned spacing; slight negative left margin so label aligns with main column.
- **Hourly carousel (mobile)**: Top padding reduced from 2rem to 1rem (≤767px).
- **Typography**: Multiple alerts show e.g. `Winter Storm Warning +5 more`; removed all‑caps from storm and corrected-condition labels.
- **Retry / Refresh**: Manual Retry (offline) and Refresh (stale) now request `/complete?refresh_alerts=1` to refresh NWS with the rest of the payload.

### Project cleanup
- **Obsolete scripts archived** to `archive/old-scripts/`: `deploy-manual.sh`, `deploy-to-pi.sh`, `scripts/build-for-deploy.sh`, `scripts/update-dashboard.sh` (superseded by `scripts/auto-build-and-deploy.sh`)
- **Removed** `apps/dashboard/tempest-v1.1.0-deploy.tar.gz` (duplicate of `archive/deployments/`), `build-output/DEPLOY-1.3.5.md`, `build-output/tempest-v1.3.5-20260123-233006.tar.gz`
- **`.gitignore`**: added `build-output/` and `/deployment` so build artifacts are not committed
- **`auto-build-and-deploy.sh`**: stop including `package.json.backup` in the tarball (delete before tar)
- **README**: Manual Deployment uses `auto-build-and-deploy.sh` and correct paths; link to REBUILD-WALKTHROUGH
- **Manual cleanup** (if iCloud locks files): from a normal Terminal, `rm -rf deployment build-output/deployment` in the project root

### Technical
- Backend: `nws-api.js` — `getActiveAlerts(skipCache)`; `point=lat,lon` primary, zone/area fallback; `alerts` in `/api/weather/complete`; `GET /api/weather/alerts` (debug)
- Frontend: `StormWarningDetail`, `.storm-warning-label` (inline + `--block` on mobile), `StormWarning.css`, `ConditionCorrector.css` (no all‑caps)

## [1.3.8] - 2026-01-24

### Fixed
- **Hourly Carousel / Horizontal Carousel Padding**: Fixed mobile hourly carousel alignment and spacing
  - Increased top padding from 1.5rem to 2rem
  - Changed left padding from 0.75rem to var(--padding-mobile) to align with other content
  - Updated SVG trendline left offset from -0.75rem to 0 on mobile for proper edge alignment
  - First hourly item ("8pm") now aligns with other text at left edge of viewport
- **Feels Like Temperature**: Increased font size from 0.875rem to 1.125rem and adjusted position for better readability alongside high/low temperatures
- **Sunset/Sunrise Display**: Added missing sunset text to sun metric card with proper formatting
  - Now displays both sunrise and sunset times with bullet separator
  - Primary time (sunset during day, sunrise at night) shown large; secondary time shown smaller
  - Format: "Sunset 5:30 PM • Sunrise 7:15 AM • 9h 40m daylight"
- **auto-build-and-deploy.sh**: Use `raspberry-pi/configs/tempest-nginx.conf` when present (fallback to project root); copy is optional if neither exists
- **auto-build-and-deploy.sh**: Backup `~/deployment` before extract (not after) so rollback restores the previous deployment
- **auto-build-and-deploy.sh**: Removed copy to `/var/www/html`; nginx serves `~/deployment/dashboard` per DEPLOYMENT.md; extract already updates it
- **USB deploy**: Extract tarball to `~/deployment` with `tar -C ~` so backend and dashboard land in the correct paths

### Added
- **REBUILD-WALKTHROUGH.md**: Step-by-step for auto-build script (network / build-only / usb) and manual rebuild via SSH; verification and troubleshooting

### Changed
- **DEPLOYMENT.md**: Quick link to REBUILD-WALKTHROUGH; Standard Deployment and Quick Reference use `auto-build-and-deploy.sh` (replacing `build-and-deploy.sh`)

### Technical
- Enhanced getSunTime() in Metrics.js to return both sunrise and sunset with primary/secondary; data-sun-times attribute and 0.75rem secondary text for sun cards

## [1.3.7] - 2026-01-23

### Fixed
- **Night Mode Trigger**: Fixed automatic theme switching to properly trigger at sunset/sunrise instead of using fallback time-based logic
  - Updated useEffect dependency to include weatherData, ensuring theme updates when weather data changes
- **Condition Text Size**: Increased condition text size to 1.5rem on all breakpoints to match "Wayland" city name size
  - Mobile: 1.5rem (up from 1.125rem)
  - Tablet: 1.5rem (up from 1.125rem)
  - Medium Desktop: 1.5rem (up from 1.375rem)

### Technical
- Modified App.js useEffect dependency array to include weatherData for proper theme updates

## [1.3.6] - 2026-01-22

### Fixed
- **Spacing Consistency**: Reduced excessive vertical spacing between hourly carousel and metrics section on mobile and regular desktop (480px-1439px)
- **Wide Desktop Spacing**: Increased spacing on wide desktop (1440px+) for better visual hierarchy and separation from border
- **Mobile Menu Clipping**: Fixed dropdown menu extending beyond viewport boundaries with comprehensive edge detection
  - Menu now repositions above button if it would clip bottom of viewport
  - Menu aligns to viewport edge if it would clip left edge
  - Applies 8px safety padding from all viewport edges

### Changed
- Adjusted `.current-weather` bottom padding across breakpoints:
  - Mobile/tablet/medium desktop: `0` (down from `0.5rem`)
  - Wide desktop (1440px+): `2rem` (maintained for proper spacing)
- Adjusted `.hourly-preview-section` top padding: `0.75rem` (down from `1.5rem`)
- Adjusted `.metrics-section` top margin:
  - Base/mobile/tablet: `0` (down from `0.5rem`)
  - Wide desktop (1440px+): `1.5rem` (down from `3rem`)

### Improved
- **Deployment Pipeline**: Updated auto-build-and-deploy.sh to exclude node_modules from Mac deployment package
  - Now uses `rsync` with `--exclude node_modules` instead of `cp -r`
  - Ensures native modules (sqlite3) are compiled correctly for ARM architecture on Raspberry Pi
  - Prevents "invalid ELF header" errors from cross-architecture binary incompatibility
- **Documentation**: Added deployment notes in README.md explaining importance of building native modules on target architecture

### Technical
- Spacing implementation now uses three-source approach:
  - `.current-weather` bottom padding
  - `.hourly-preview-section` top padding
  - `.metrics-section` top margin
- Menu positioning uses `getBoundingClientRect()` for accurate viewport boundary detection
- All spacing values tuned per breakpoint for consistent visual rhythm

## [1.3.4] - 2026-01-21

### Design System Overhaul
This release implements comprehensive visual and accessibility improvements based on a professional design audit, focusing on "boutique weather app" aesthetics and WCAG AA compliance.

### Added
- **Golden Vertical Alignment System**: Established consistent left-alignment across all components using global `--app-gutter` CSS variables (48px desktop, 32px tablet, 24px mobile)
- **Optical Kerning**: Applied negative margin (`--hero-optical-offset`) to hero temperature to visually align serif "1" with text above
- **Dynamic Sparkline Glow**: Metric card sparklines now show subtle color-matched drop-shadow effects on hover
- **Staggered Entrance Animations**: Metric cards fade in with 20ms stagger delay, forecast cards with 30ms delay for smooth loading experience
- **Icon Standardization**: All icons now use consistent 2px stroke width, round caps/joins, and centered 24x24 viewbox

### Changed
- **WCAG AA Accessibility Compliance**:
  - Updated light mode colors: `--bg-primary: #F9F9FB`, `--text-primary: #121214` (21:1 contrast - AAA)
  - Updated dark mode colors: `--bg-primary: #0A0A0B`, `--text-primary: #FFFFFF` (21:1 contrast - AAA)
  - Secondary text contrast improved to 4.8:1 (AA compliant)
- **Touch Targets**: Increased all interactive elements (menu buttons, close buttons) to minimum 44×44px touch areas per WCAG guidelines
- **Baseline Unit Alignment**: Metric units (e.g., "inHg") now sit precisely on same baseline as numbers using `align-items: baseline`
- **Grid Gutter Normalization**: Metrics section uses `margin-top: calc(var(--section-gap) * 1.5)` to create visual hierarchy grouping
- **Humidity Icon**: Now renders with subtle 10% fill opacity for visual consistency
- **Forecast Cards**: Added hover effect with subtle lift and background tint

### Technical
- Centralized horizontal padding at `.container` level; removed redundant padding from header, footer, and child components
- Added `letter-spacing: -0.02em` to hero temperature for improved readability
- Implemented CSS animations: `fadeInUp` for staggered entrance effects
- Added filter effects for sparkline glow with metric-specific color variants
- Updated all icon stroke widths from 1.5px to standardized 2px

### Design Tokens
- New layout variables: `--app-gutter`, `--app-gutter-tablet`, `--app-gutter-mobile`, `--card-padding`, `--section-gap`
- New typography variable: `--hero-optical-offset`
- New icon variables: `--stroke-width`, `--ui-border`
- Updated color tokens for WCAG AA/AAA compliance

## [1.3.3] - 2026-01-20

### Fixed
- **Trendline Positioning (CRITICAL)**: Fixed hourly temperature trendline alignment to correctly follow temperature values instead of floating misaligned
  - Calculated accurate baseline positions for each responsive breakpoint (desktop: 162px, tablet: 156px, mobile: 100px)
  - Synchronized SVG path Y coordinates with temperature element transforms
  - Trendline now curves smoothly through/below temperature numbers at all viewport sizes
- **Responsive Breakpoint Consistency**: Ensured JavaScript dimension calculations perfectly match CSS media query breakpoints
  - Synchronized gap widths, item widths, and padding values across all breakpoints (480px, 769px, 1280px)
  - Fixed potential misalignment issues when switching between viewport sizes

### Validated
- **Temperature Layout Transitions**: Confirmed smooth transition from vertical (unscrolled) to horizontal (scrolled) layout works correctly
  - Vertical separator appears when scrolled (scrollLeft > 10px)
  - Temperature shrinks from 9.5rem to 5rem on desktop
  - Metadata repositions from below to beside temperature
- **Mobile 2x3 Metrics Grid**: Verified metrics display in 2-column, 3-row grid on mobile (NOT a single-column list)
- **Mobile Full-Screen Modals**: Confirmed Condition Corrector and Precipitation Logger display as full-screen overlays on mobile (<= 480px)
- **Hourly Carousel Spacing**: Validated all gap and width values match between CSS and JavaScript calculations

### Technical
- Refactored trendline positioning algorithm in `CurrentWeather.js` to use baseline + offset calculation
- Added responsive baseline Y calculations for each breakpoint
- Combined icon size calculation with other responsive dimension variables for consistency
- Created comprehensive validation report documenting all fixes and testing requirements

### Documentation
- Added `BUGFIX-PLAN.md` with detailed 6-phase implementation plan
- Added `VALIDATION-REPORT.md` with complete testing checklist and validation results
- Updated deployment checklist to include visual comparison with design mocks

## [1.3.2] - 2026-01-19

### Fixed
- **Precipitation Menu Rendering**: Fixed menu being clipped by metric card boundaries by rendering menu in React portal with fixed positioning
- **Precipitation Menu Clickability**: All menu buttons (Add Entry, View History, Cancel) are now fully clickable and functional
- **Hover Animation Layout Shift**: Fixed metric cards moving content below when hovering by transforming only inner content instead of entire card
- **Mobile Hover Animation**: Disabled hover slide-up animation on mobile breakpoints (max-width: 480px) for better touch experience
- **Event Propagation**: Added stopPropagation to precipitation logger to prevent metric card click events from interfering with menu

### Changed
- **Menu Z-Index**: Increased precipitation menu z-index to 10000 to ensure it appears above all other content
- **Menu Positioning**: Changed from absolute to fixed positioning with dynamic coordinate calculation based on button position

### Technical
- Refactored precipitation menu to use `ReactDOM.createPortal()` for rendering outside DOM hierarchy
- Added button ref and position state tracking for accurate menu placement
- Transformed only `.metric-content` and `.metric-icon` on hover instead of entire `.metric-card`
- Added transition properties to metric content and icon elements

## [1.3.1] - 2026-01-19

### Added
- **Automated Data Collection Service**: Backend now automatically saves weather observations every minute to maintain historical data for sparklines
- **Database Cleanup/Retention**: Automatic deletion of observations older than 7 days (configurable)
- **Graceful Shutdown Handling**: Server properly stops data collection and closes connections on SIGTERM/SIGINT
- **Enhanced Error Handling**: Data collector stops after 10 consecutive errors to prevent resource waste
- **Collector Status Monitoring**: New `getStatus()` method provides collector health information
- **Input Validation**: Recent weather endpoint now validates hours parameter (0-168) with proper error messages

### Changed
- **Sparkline Time Window**: Reverted from 24-hour to 6-hour window for more detailed trend visualization
- **Dashboard Refresh**: Fixed App.js to request 6-hour data instead of 24-hour data
- **Reduced Logging**: Data collector only logs saves every 10 minutes to reduce console noise

### Fixed
- **Flat Trendlines**: Resolved issue where 24-hour sampling caused sparklines to appear flat
- **Rate Limiting Warning**: Added `trust proxy` setting to fix express-rate-limit X-Forwarded-For warnings
- **Missing Historical Data**: Data collector now ensures continuous data availability for trendlines
- **Database Growth**: Automatic cleanup prevents unlimited database growth

### Technical
- Created `DataCollector` service class with configurable intervals and error thresholds
- Added `deleteOldObservations()` database method for automated cleanup
- Enhanced server.js with collector lifecycle management
- Added proper shutdown handlers for production deployments
- Improved edge case handling for invalid API parameters

## [1.3.0] - 2026-01-18

### Added
- **Manual Precipitation Logging**: Users can now log precipitation manually with type selection (Snow, Rain, Sleet, Freezing Rain, Hail, Mixed), amount in inches, and optional notes
- **Cumulative Precipitation Totals**: Multiple precipitation entries aggregate into a daily cumulative total
- **Precipitation History View**: View all today's entries with individual delete capability and "Delete All" option
- **Condition Corrections**: Override weather conditions with user-observed conditions; corrections persist for 30 minutes and sync across devices
- **"Corrected" Label**: Visual indicator when weather condition has been manually corrected
- **Offline Status Banner**: Rusty Red (#8b3a3a) banner when Tempest station is offline, showing cached data timestamp
- **Stale Data Banner**: Military Green (#4a5d3f) banner when data is 10+ minutes old
- **Tempest Station Link**: Clickable link to Tempest station page in offline banner
- **Sparkline Trend Indicators**: 6-hour historical trends for pressure, humidity, wind, and precipitation metrics
- **Test Plan Documentation**: Comprehensive QA checklist for all user-controlled features

### Changed
- **Hourly Preview Layout**: Reduced padding for tighter, more compact layout
- **10-Day Forecast Padding**: Unified horizontal padding to 3rem matching other sections
- **Menu/Kebab Icons**: Removed opacity styling for consistent appearance across light/dark themes
- **Humidity Icon**: Now renders with subtle fill instead of outline-only for visual consistency
- **Retry Button Behavior**: Manual retry now clears localStorage cache to force fresh data fetch
- **Sparkline Data Order**: Historical data now returns oldest-to-newest for proper left-to-right rendering

### Fixed
- **Pressure Sparkline**: Fixed data ordering issue preventing pressure trend line from appearing
- **Condition State Reset**: Fixed issue where "Corrected" label persisted after correction was deleted
- **SVG Trendline Overflow**: Fixed hourly temperature trendline extending beyond container bounds
- **Cache Staleness Detection**: Improved connection status checks for stale data detection

### Technical
- Updated dashboard and backend versions to 1.3.0
- Added /api/weather/precipitation/today endpoint for daily precipitation aggregation
- Added /api/weather/correction/:id DELETE endpoint for canceling corrections
- Improved /api/weather/recent endpoint with proper timestamp sorting
- Added CSS spacing scale variables (--space-1 through --space-8)
- Added --text-muted color token for tertiary text

## [1.2.0] - Previous Release

### Added
- Initial weather dashboard implementation
- Current conditions display with temperature, feels like, and high/low
- 10-day forecast with daily cards
- Metrics grid with pressure, humidity, wind, precipitation, solar radiation, and sunrise/sunset
- Dark/light theme auto-switching based on time of day (8 PM - 6 AM = dark)
- Kiosk mode cursor hiding after 5 seconds of inactivity
- SQLite database for historical data storage
- Tempest API integration
