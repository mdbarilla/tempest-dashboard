# 1.4.4 Plan: Conditions List View

A new dashboard **view**: a single list (mobile) / equal-sized grid (large) of all current conditions, reformatting the primary dashboard's metric cards, with richer data and trendline visualizations. Uses the existing design system (fonts, spacing, colors, icons); **not** Tempest's fonts or card layouts.

---

## Implementation (v1.4.4)

- **Routes:** `/` = default dashboard (CurrentWeather + Metrics + Forecast + NewsCarousel), `/conditions` = conditions list view.
- **Navigation:** List vs. grid icon button in the footer, next to the theme toggle (lower right). On dashboard: list icon → navigate to `/conditions`. On conditions: grid icon → navigate to `/`. May evolve into primary navigation later.
- **Conditions list:** `pages/ConditionsList.js` — list on mobile (single column), equal-sized grid on tablet/desktop (2×N, 3×N, 4×N). Reuses `MetricIcon`, `Sparkline`, `PrecipitationLogger`, design tokens. Shared metric logic in `utils/conditions-metrics.js`.
- **Card layout:** `[Icon + Label + secondary] | vertical divider | [Value + unit] [Trendline]`. Icon and text left of large numbers; divider between label and values; trendline to the right of values. No hero; same card style for all.
- **Temperature card:** First card = Temperature (same format as others). Shows temp, condition, feels like, high/low. No LLM, no hourly carousel. Trendline when `recent.temperature` or hourly forecast available.
- **Richer trendlines:** `/recent` returns `temperature`, `solar`, `uv`; sampling scales with `hours` (6–24 points). App fetches `recent?hours=12`. Conditions list uses same recent data for sparklines.

---

## (a) Layout and Overall Functions of the Page

### Purpose

- **Reformat** the same metric concepts (pressure, humidity, wind, precipitation, solar, sunrise/sunset) from the primary dashboard into a dedicated "conditions list" layout.
- **Enrich** each card with more secondary data and **richer trendlines** (longer windows, more points, optional min/max or annotations).
- **Responsive**: list on mobile, equal-sized grid on large viewports.

### Layout

| Viewport | Layout | Behavior |
|----------|--------|----------|
| **Mobile** (e.g. < 768px) | Single-column list | One card per row, full width, stacked vertically. Scrollable. |
| **Tablet / Desktop** (e.g. ≥ 768px) | Equal-sized grid | Cards tile in a grid (e.g. 2×N, 3×N, or 4×N). All cards same size (e.g. `grid-template-columns: repeat(N, 1fr)`). |

### Page Structure (High Level)

1. **Optional minimal header**  
   - Station/location (e.g. "Tower Hill") and/or "Current Conditions" if we want a label.  
   - Can match primary dashboard's header pattern or be slimmer.

2. **Conditions list / grid**  
   - One **card per metric** (pressure, humidity, wind, precipitation, solar, sunrise/sunset when available).  
   - Each card:
     - **Primary value** (e.g. 29.98 inHg, 75%, 8 mph) + unit.
     - **Secondary line(s)**: dew point, trend, gusts, "today / yesterday" precip, UV, etc.
     - **Trendline** (sparkline or similar) when we have series data — richer than the default dashboard (see §c).
     - **Icon** (reuse `MetricIcon`).

3. **Optional footer**  
   - Last updated, link to Tempest, theme toggle — consistent with primary dashboard where applicable.

4. **No** CurrentWeather hero (no large temp + conditions + hourly strip). This view is **metric-focused only**.

### Functions

- **Display** all current conditions in a scannable list/grid.
- **Navigate** to/from the primary dashboard via a chosen pattern (see §b).
- **Refresh** data using the same fetch as the main app (`/complete` + `/recent` or extended endpoints).
- **Reuse** `MetricIcon`, `Sparkline`, design tokens (`--font-primary`, `--accent-blue`, `--trendline-stroke`, etc.), and shared styles. **Do not** adopt Tempest's fonts or card layouts.

### What We Explicitly Avoid

- Tempest's typography and card layout.
- Duplicating the primary dashboard's hero (CurrentWeather); this view is **conditions-only**.

---

## (b) How Users Get To and From This Page — Options

Below are **options** for toggling between the **default dashboard** and the **conditions list view**. Pick one (or a combination) that fits your UX.

---

### **Option 1: Tab bar / Segmented control**

- **What:** Two segments or tabs: e.g. "Overview" | "Conditions" (or "Dashboard" | "List").
- **Where:** Top of main content (below any app-level header) or just above the main scrolling area.
- **Interaction:** Tap "Conditions" → show conditions list view; tap "Overview" → show default dashboard. Only one view visible at a time.
- **Pros:** Clear, common pattern; easy to discover.  
- **Cons:** Uses horizontal space; on very small screens might need to collapse to icons + labels.

---

### **Option 2: Navigation link / "Conditions" button**

- **What:** A dedicated link or button (e.g. "Current conditions", "Conditions list", or an icon like a list/grid) in the header or footer.
- **Where:** Same row as "Tempest Station" link / theme toggle, or in a simple nav bar.
- **Interaction:** Click → navigate to conditions list view. That view has a "Back" or "Dashboard" link to return.
- **Pros:** Simple, minimal UI; works well if conditions view is secondary.  
- **Cons:** Slightly less obvious than tabs; user must notice the link.

---

### **Option 3: Route-based (e.g. `/` vs `/conditions`)**

- **What:** Default dashboard at `/`, conditions list at `/conditions` (or `/list`, `/metrics`).
- **Implementation:** React Router (or similar). `App` or a layout component handles `Route` for `/` and `/conditions`.
- **Interaction:** User goes to `/conditions` via link, bookmark, or in-app nav. "Back" or "Dashboard" goes to `/`.
- **Pros:** Shareable URL, back button works, fits existing `ROUTING_SETUP`-style setup.  
- **Cons:** Requires routing; you'll need to wire fetch + layout into both routes.

---

### **Option 4: View toggle (icon button)**

- **What:** A single icon button (e.g. list vs grid) that **swaps** the main content between default dashboard and conditions list **without changing URL**.
- **Where:** Header or a floating control (e.g. top-right near theme toggle).
- **Interaction:** Click → toggle view; state stored in React state (or `sessionStorage` if you want persistence across refresh).
- **Pros:** No routing; very quick to toggle; minimal chrome.  
- **Cons:** No distinct URL for "conditions" view; not bookmarkable.

---

### **Option 5: Swipe / gesture (mobile)**

- **What:** On mobile, swipe horizontally to switch between "Overview" and "Conditions" (e.g. swipe left → conditions, swipe right → overview).
- **Interaction:** Optional **enhancement** to Option 1 or 4; not a standalone nav model.
- **Pros:** Gesture-native, feels app-like.  
- **Cons:** Discoverability is low; best combined with tabs or a toggle so users know both views exist.

---

### **Recommendation**

- **Option 3 (routes)** + **Option 2 (nav link)**:
  - `/` = default dashboard, `/conditions` = conditions list.
  - Header or footer "Conditions" link → `/conditions`; "Dashboard" or "Overview" → `/`.
- **Alternative:** **Option 1 (tabs)** + **Option 3 (routes)**:
  - Tabs switch between `/` and `/conditions`; URL updates when switching, so tabs and routes stay in sync.

Choose based on whether you prefer **tabs** (more prominent) or a **single link** (lighter UI).

#### Quick reference: navigation options

| Option | Mechanism | URL change? | Best for |
|--------|-----------|-------------|----------|
| **1. Tabs** | Segmented control "Overview" \| "Conditions" | Optional (can sync with routes) | Prominent, discoverable switching |
| **2. Nav link** | "Conditions" / "List" link in header or footer | Yes if route-based | Lightweight, secondary view |
| **3. Routes** | `/` = dashboard, `/conditions` = list | Yes | Shareable URLs, back button |
| **4. View toggle** | Icon button swaps view (no route) | No | Fast toggle, minimal UI |
| **5. Swipe** | Horizontal swipe on mobile | No (use with 1 or 4) | Mobile-only enhancement |

---

## (c) Data Richness and Visual Design

### Goal

- **Richer** than the default dashboard: more secondary metrics per card and **more detailed trendlines**.
- **Consistent** with your design system: reuse `MetricIcon`, `Sparkline`, CSS variables, typography, and spacing.

### Data Sources (Current vs Proposed)

| Source | Today | Use in conditions list |
|--------|--------|---------------------------|
| `GET /api/weather/complete` | Current conditions + forecast | Same; primary values + secondary (e.g. dew point, trend, precip today/yesterday). |
| `GET /api/weather/recent?hours=6` | ~6 points for pressure, humidity, wind, precipitation | **Extend** usage: longer windows (e.g. 12h, 24h), more metrics (see below). |
| `GET /api/weather/historical` | Date-range history | Optional: custom ranges for "last 24h" etc. if we build client-side series. |
| `GET /api/weather/stats` | Aggregates (min/max/avg) | Optional: show min/max in card or in sparkline annotation. |

### Richer Trendlines — API Adjustments

**Current `/recent` behavior:**

- Returns `pressure`, `humidity`, `wind`, `precipitation` (sampled to ~6 points).
- **Does not** return `temperature` or `solar`; those use forecast hourly in Metrics.

**Proposed improvements:**

1. **Extend `/recent`** (or add `/recent/extended`) to also return:
   - `temperature` (e.g. `temp_fahrenheit` from observations),
   - `solar` (e.g. `solar_radiation`), and optionally `uv_index`,
   using the same sampling logic (or slightly denser, e.g. ~12 points for 12h).

2. **Support longer windows**  
   - `hours=12` or `hours=24` (within existing max 168) for sparklines.  
   - Conditions list uses `recent?hours=12` or `24`; default dashboard can keep `hours=6`.

3. **Optional: more points**  
   - Increase sampling (e.g. up to ~24 points for 24h) so sparklines are smoother and "more detailed" without overwhelming the UI.

4. **Optional: stats in response**  
   - Include `min` / `max` (and optionally `avg`) per metric in the response so we can:
     - Show "12°–28°" next to a temp sparkline, or
     - Draw a subtle band (min–max) behind the trendline.

**Database:** Observations already have `temp_fahrenheit`, `solar_radiation`, `uv_index`, etc. No schema change required; only API response shape and, if needed, a new route.

#### Concrete API changes (for implementation)

- **Extend `GET /api/weather/recent`** (keep backward compatibility):
  - `hours` already exists (default 6, max 168). Use 12 or 24 for conditions-list view.
  - In the response `data` object, **add**:
    - `temperature`: `sampled.map(d => d.temp_fahrenheit)` (or equivalent from observations).
    - `solar`: `sampled.map(d => d.solar_radiation)`.
  - Optionally `uv`: `sampled.map(d => d.uv_index)`.
- **Sampling:** For `hours > 6`, use a commensurate number of points (e.g. `Math.min(24, Math.max(6, Math.floor(hours / 2)))`) so sparklines stay smooth but not overwhelming.
- **Optional later:** Add `stats: { pressure: { min, max }, temperature: { min, max }, ... }` keyed by metric, computed over the same window, for min/max labels or sparkline bands.

### Card-Level Enrichment (Examples)

- **Pressure:** Trend (rising/falling/stable) + sparkline; optionally "3h change" or min/max.
- **Humidity:** Dew point (existing) + sparkline; optionally "3h change".
- **Wind:** Gusts, direction (existing) + sparkline; optionally "max gust in window".
- **Precipitation:** Today / yesterday (existing), manual entry if present; sparkline of precip series.
- **Solar:** UV index (existing) + solar radiation; sparkline when we have `solar` (and optionally UV) from `/recent`.
- **Sunrise/sunset:** Daylight duration, primary/secondary times (existing); no trendline.

Reuse `MetricIcon` and `Sparkline`; keep units and labels consistent with the primary dashboard.

### Visual Design Constraints

- **Do not** use Tempest's fonts or card layouts.
- **Do** use:
  - `--font-primary`, `--font-display`, `--accent-blue`, `--trendline-stroke`, `--bg-*`, `--text-*`, `--border-light`, `--card-padding`, `--space-*`, etc.
  - `MetricIcon`, `Sparkline`, and existing typography (e.g. Fraunces for prominent numbers if that's already in use).
- **Card layout:** New layout only — list vs grid, equal-sized tiles on large viewports. Padding, borders, and hierarchy should follow your design system (e.g. `--card-padding`, `--border-light`).

### Making It "Visually Appealing" Without Losing Consistency

- **Hierarchy:** Primary value → secondary line(s) → trendline, same as current Metrics cards.
- **Density:** Slightly higher than default dashboard is OK (more secondary lines, bigger sparklines) but avoid clutter; use `--space-*` and `--font-size-secondary` for rhythm.
- **Trendlines:** Slightly larger sparklines (e.g. height 32–40px) and longer series (12h/24h) make trends "richer" without new chart types.
- **Optional later:** Subtle min/max band, or "3h ago" vs "now" annotation on the sparkline — only if we add min/max (or equivalent) to the API.

---

## Summary

- **Layout:** List on mobile, equal-sized grid on large viewports; conditions-only (no CurrentWeather hero).
- **Navigation:** Choose among tabs, nav link, routes, and/or view toggle; recommended baseline is **routes** (`/` vs `/conditions`) plus a **"Conditions" link** (or tabs).
- **Data:** Same `complete` data as primary dashboard; **extend `/recent`** (or add an extended endpoint) for `temperature`, `solar`, longer `hours`, and optionally more points + min/max. Reuse `MetricIcon` and `Sparkline`; keep typography and spacing from your design system.
- **Next steps:**  
  1. Implement API changes for richer `/recent` (or extended) data.  
  2. Add routing and nav (per chosen option).  
  3. Build the conditions list page (list + grid layout, enriched cards, trendlines).  
  4. Iterate on density and optional sparkline annotations (min/max, etc.) if desired.
