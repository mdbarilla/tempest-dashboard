# Deploy 1.4.10 — UI polish, chart transitions, precip edit

**Target:** 1.4.10  
**Changelog:** [CHANGELOG.md](../../CHANGELOG.md#1410---2026-02-09)

## Pre-deploy checklist

- [ ] Run dashboard build: `cd apps/dashboard && npm run build`
- [ ] Run backend (no backend changes in 1.4.10; optional smoke test)
- [ ] Tag release: `git tag -a v1.4.10 -m "1.4.10 UI polish, chart transitions, precip edit"`
- [ ] Deploy per [DEPLOYMENT.md](../../DEPLOYMENT.md) (e.g. `scripts/auto-build-and-deploy.sh`)

## Bug / behavior cross-check

| Item | Status |
|------|--------|
| Modal backdrop blur visible on tablet/desktop | Fixed (blur on overlay, 6px) |
| Intermittent refresh while metric detail modal open | Fixed (no onRefresh from precip; refresh on close) |
| Chart redraw vs morph when switching metrics | Fixed (chart stays mounted; morph) |
| X-axis labels redrawing when switching metrics | Fixed (stableTimeEnd) |
| Condition picker matches precip edit (header, buttons, footer) | Done |
| Precip type buttons outline in light mode | Fixed (overlay override in metric detail) |
| Precip edit: Amount/Time side-by-side tablet/desktop | Done |
| Notes section fills space | Done |
| Add to Total button height matches condition submit | Done |
| List view tablet: overlay tint (no bg shift) | Done |
| Manual precip labels on 7-day chart | Hidden (dotted lines kept) |
| Chart hint: "hourly details" | Done |
| Value font size (2rem) across metrics + condition | Done |

## Deferred (future build)

- **Mobile list view row swipeability** — not in 1.4.10; lower priority.

## Debug / cleanup

- No `console.log` added; existing `console.warn` in App.js and useHistoricalData.js are operational (timeout, cached fallback) and kept.
- Dev-only UI (lastFetchError, atmosphere debug) remains gated by `NODE_ENV === 'development'`.
