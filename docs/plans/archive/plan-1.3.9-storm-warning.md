# 1.3.9 Plan: Storm Warning Feature

**Status:** Released in 1.3.9. NWS alerts in `data.alerts` from `/api/weather/complete`; label after menu icon (and between temp and carousel on mobile); `StormWarningDetail` overlay/full-page on tap.

---

## Summary

Display NWS (National Weather Service) active weather alerts—e.g. **Winter Storm Warning**—as a small label next to the condition metadata (after the menu icon, under the large temperature). On tap/click, show the full alert text (full-page on smallest breakpoint, overlay on tablet/desktop).

---

## 1. Data source: Tempest API vs NWS

### Tempest / WeatherFlow API

The **Tempest API does not provide storm or winter storm warning data.**

- `better_forecast` (and `observations/station/{id}`) include: current conditions, hourly/daily forecast, precip, wind, pressure, etc.
- No `alerts`, `warnings`, or `winter_storm` fields exist in the [better_forecast](https://apidocs.tempestwx.com/reference/get_better-forecast-1) or [REST](https://weatherflow.github.io/Tempest/api/swagger) specs.

### NWS API (required)

- **Base:** `https://api.weather.gov`
- **Auth:** `User-Agent` header (required); no API key.
- **Geolocation:** `TEMPEST_LATITUDE` and `TEMPEST_LONGITUDE`.

**Flow:** Primary `GET /alerts/active?point={lat},{lon}` (only alerts whose geometry contains the point; avoids Albany/NY spillover). If none, fallback: `/points/{lat},{lon}` → `?zone=...` then `?area=STATE`, filtered by `affectedZones` (BOX or MA). Cache ~10 min (`NWS_ALERTS_TTL`).

---

## 2. Backend (implemented)

- **`backend/services/nws-api.js`**: `getActiveAlerts(skipCache)` — primary `?point=lat,lon`; fallback `/points`, `?zone=`, `?area=STATE` with `affectedZones` filter. Returns `[{ event, headline, description, onset, expires, severity }]`; `[]` if lat/lon missing or on error.
- **`/api/weather/complete`**: `data.alerts = await nwsAPI.getActiveAlerts(refreshAlerts)`. Query `?refresh_alerts=1` bypasses NWS cache.
- **`GET /api/weather/alerts`**: Alerts only (debug). `?refresh=1` bypasses cache.

---

## 3. Frontend (implemented)

- **Label:** `.storm-warning-label` in `conditions-container` after `ConditionCorrector` (tablet/desktop); `--block` between temp and hourly carousel on mobile (≤480px). Outline pill, `--accent-blue`; truncate to 24 chars; `+N more` when multiple. Click opens detail.
- **`StormWarningDetail`:** Portal; `event`, `headline`, `onset`/`expires`, `description`; overlay on tablet/desktop, full-page at ≤480px; ESC and backdrop to close.

---

## 4. Files

| Layer   | File(s) |
|---------|---------|
| Backend | `backend/services/nws-api.js`, `backend/api/weather.js` |
| Frontend| `CurrentWeather.js`, `StormWarningDetail.js`, `StormWarning.css`, `App.js` |

---

## 5. Config

- `TEMPEST_LATITUDE`, `TEMPEST_LONGITUDE` (required for NWS).
- Optional: `NWS_ALERTS_TTL` (default 600), `NWS_USER_AGENT`.

---

## 6. Refreshing the NWS alert list

- **Backend cache:** NWS alerts are cached in memory for `NWS_ALERTS_TTL` seconds (default 10 min). To refetch sooner:
  - **`GET /api/weather/alerts?refresh=1`** — returns fresh alerts and bypasses the cache.
  - **`GET /api/weather/complete?refresh_alerts=1`** — full payload with alerts bypassing the NWS cache.
- **Dashboard:** **Retry** and **Refresh** (offline/stale banner) request `/complete?refresh_alerts=1`, so NWS alerts are refreshed on manual refresh.
- **Automatic:** The 60 s poll uses `/complete` without the param, so it uses the backend cache until TTL expires.
- **Shorter TTL:** Set `NWS_ALERTS_TTL=60` (or similar) in `backend/.env` to refresh NWS more often on every `/complete` call.

---

## References

- [NWS API Web Service](https://www.weather.gov/documentation/services-web-api)
- [NWS Alerts](https://www.weather.gov/documentation/services-web-alerts)
- [Tempest better_forecast](https://apidocs.tempestwx.com/reference/get_better-forecast-1)
