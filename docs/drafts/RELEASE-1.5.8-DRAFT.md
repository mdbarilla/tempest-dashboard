# Draft changelog — release 1.5.8 (not published)

**Status:** DRAFT — merge into root `CHANGELOG.md` and bump `package.json` versions when this release is cut.

---

## [1.5.8] - TBD

### Added

- **Garden dashboard band (main weather app):** `GardenDashboardSection` below the 10-day forecast; shared helpers in `utils/gardenForecast.js`. “In the Garden” header + `View garden →`, optional frost/seasonal glass banner (“Frost likely” + snow icon when 10-day lows imply freeze), `WhatsGrowing` embedded with dashboard variant (loading / empty copy when API has no rows).
- **Metrics “editorial glass” cards:** Separate frosted cards with `backdrop-filter`, 1px edge-light border, gap-based layout (removed grid divider pseudo-elements). Metric labels use Fraunces where applied.
- **Weather fetch hardening:** `Cache-Control` / `Pragma: no-cache`, per-request `_=` cache-buster on `/complete` and `/recent`; hydrate from `localStorage` no longer sets “using cached data” until a failed fetch path; `refreshAtmosphere` updates connection/cached flags and persists fresh payload.

### Changed

- **Hero → metrics continuity:** `.metrics-section` background transparent so the block matches body `--bg-primary` (no band shift vs current + hourly). Tighter vertical rhythm between hourly strip and metrics (reduced padding / XL margins).
- **Metric card hover:** Cards nudge **down** on hover (`translateY(2px)`) instead of up.
- **Current weather layout:** `.current-weather` / `.current-weather-layout` use `flex: 0 0 auto` so the hero does not consume the full main column and push forecast/garden below the fold.
- **Garden frost strip:** Frost photo + gradient layered with explicit z-index; section `overflow: visible` where adjusted for clipping.
- **WhatsGrowing:** Dashboard variant omits duplicate CTA / “In the greenhouse” subhed; optional cache-bust query on greenhouse API.

### Fixed

- **Offline / cached banner:** Avoid showing “showing cached data…” solely because of optimistic `localStorage` hydrate before a successful live fetch completes.

### Technical (touchpoints)

- `apps/dashboard/src/App.js` — fetch URL, headers, hydrate behavior, `refreshAtmosphere`.
- `apps/dashboard/src/components/Metrics.css`, `Metrics.js` (if any).
- `apps/dashboard/src/components/CurrentWeather.css`, `CurrentWeather.js`.
- `apps/dashboard/src/components/GardenDashboardSection.js`, `WhatsGrowing.js`, `WhatsGrowing.css`.
- `apps/dashboard/src/utils/gardenForecast.js`.

---

## Follow-up / debugging (pick up in a future session)

These items are **not** considered closed; keep for the next pass.

### Garden module — **refactor required**

Pin for further development:

1. **Carousel not appearing** — Confirm `/api/garden/whats-growing` in all environments (proxy, tunnel, Pi); loading vs empty states; consider lifting fetch to parent or React Query for visibility and errors.
2. **Header not appearing** — Re-verify `shouldShowGardenNav` (local vs remote, `?garden=1`, `localStorage`); stacking context / z-index / flex regressions on narrow or kiosk layouts.
3. **Background color / tint and frost image** — Frost advisory layers (`::before` / `::after`), opacity, and `--garden-*` tokens vs global theme; solid vs photo states; dark mode richness; possible move from pseudo-elements to explicit wrapper divs for predictable stacking.

**Suggested direction:** Single owner component + dedicated `GardenDashboardSection.css` (or scoped module), integration tests or manual checklist per breakpoint, and explicit empty/error UI.

### 10-day forecast — **card design update**

- Flag the **forecast day cards** (`Forecast.js` / `Forecast.css`) for a visual pass to align with the newer **glass / editorial** metric cards (spacing, radius, border, hover, typography hierarchy). No functional requirement beyond design consistency.

### Other loose ends to verify

- Metrics carousel mode (≥1440px): scroll padding and last-card inset vs glass borders.
- Condition-tint themes (`:root[data-condition]`) + transparent metrics: contrast on glass cards.
- Garden empty copy vs real API failures (distinguish “no seeds” from network error).

---

## Release checklist (when publishing 1.5.8)

- [ ] Move this section into `CHANGELOG.md` as `## [1.5.8] - YYYY-MM-DD`.
- [ ] Bump `apps/dashboard/package.json` and backend `package.json` if applicable.
- [ ] Remove or shorten the pointer in `## [Unreleased]` once shipped.
- [ ] Re-test garden band on Pi + tunnel + `?garden=1`.
