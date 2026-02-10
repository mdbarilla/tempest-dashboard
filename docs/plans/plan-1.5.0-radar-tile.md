# 1.5.0 Plan: Radar preview tile

**Status**: Planned  
**Slots in after**: 1.5.0 (LLM); this is the **1.6.0** release.

---

## Goal

Add a radar preview as the first metrics tile when conditions indicate precipitation. The tile displays radar imagery as a background with icon and title, matching the existing metrics card design. Hidden when conditions are clear, partly cloudy, cloudy, fog, etc.

---

## Conditional display

**Show radar tile when** conditions match any of: rain, snow, freezing rain, drizzle, sleet, wintry mix, thunderstorms, very light rain, or similar precip-related strings (e.g. "Rain Likely", "Snow Possible", "Thunderstorms Possible").

**Hide radar tile when** conditions are: clear, partly cloudy, mostly cloudy, cloudy, fog, mist, haze.

Use a shared helper (e.g. `isPrecipCondition(conditions)` or extend `toConditionCategory`) to determine visibility. Align with Tempest API condition strings and `buildConditionsMetrics` in `utils/conditions-metrics.js`.

---

## Tile design

- **Placement:** First in the metrics list (before conditions, temperature, etc.)
- **Structure:** Icon + label (e.g. "Radar") like other tiles; radar imagery as background
- **Icon:** Add a radar/ precipitation-map icon to `MetricIcon` or use a dedicated icon
- **Background:** RainViewer or NOAA radar tile(s) as `background-image` or an `img`/canvas layer behind the content. Ensure text remains readable (e.g. overlay, contrast).

---

## Layout

| Viewport | Behavior |
|----------|----------|
| **Mobile (list)** | Full-width row, first in list. Same height as other list rows or a fixed aspect ratio (e.g. 16:9) for the radar area. |
| **Tablet / Desktop (grid)** | Full-width row (`grid-column: 1 / -1`) so it spans all columns and avoids uneven tile counts when the radar appears/disappears. Acts as a "hero" row above the regular grid. |

---

## Data source

- **Primary:** [RainViewer API](https://www.rainviewer.com/api.html) — free for personal/educational use. Fetch `https://api.rainviewer.com/public/weather-maps.json` for tile URLs; use latest frame for static preview.
- **Alternative:** NOAA WMS if RainViewer is unavailable or for US-only coverage.
- **Attribution:** Link to rainviewer.com (or NOAA) required per terms.

---

## Implementation tasks

1. **`utils/conditions-metrics.js`:** Add `isPrecipCondition(conditions)` helper; in `buildConditionsMetrics`, prepend a `radar` metric object when `isPrecipCondition` is true.
2. **`MetricIcon`:** Add `radar` type or equivalent icon.
3. **`ConditionsList.js`** and **`Metrics.js`:** Handle the `radar` metric type — render tile with radar background, icon, label. No trendline or secondary value.
4. **`ConditionsList.css`:** Styles for `.conditions-list-card[data-metric-type="radar"]` — full-width on grid (`grid-column: 1 / -1`), background-size/position for radar image, overlay for text contrast.
5. **Radar fetch:** Frontend fetches RainViewer `weather-maps.json`, extracts latest frame URL. Optionally proxy through backend to avoid CORS.
6. **Dashboard (`Metrics.js`):** If radar tile is shown on conditions list, decide whether it also appears on the main dashboard metrics grid. Plan suggests conditions list first; dashboard can follow.

---

## Where it appears in planning

- **Release planning:** `docs/release-planning.md` — "Planned for 1.6.0".
- **Roadmap:** `docs/roadmap.md` — Phase 3 (Advanced Visualizations) / Radar integration.
