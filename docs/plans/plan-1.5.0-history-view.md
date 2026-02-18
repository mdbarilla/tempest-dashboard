# 1.5.0 Plan: History View (Wunderground-style)

**Status**: In progress  
**Target**: 1.5.0

---

## Summary

Add a Wunderground-style detailed hourly weather table with date picker, store conditions in the observations DB for historical accuracy, and introduce History as a first-class view with mobile bottom nav and desktop header link.

---

## Implemented

### Backend
- **Conditions in observations**: Added `conditions TEXT` column; `saveObservation()` now stores conditions from Tempest API
- **GET /api/weather/hourly/:date**: Returns 24 hourly rows for a date; merges observations (past) with forecast (future) for today

### Frontend
- **HistoryPage**: Full-page table with Time, Conditions, Temp., Feels Like, Precip, Amount, Cloud Cover, Dew Point, Humidity, Wind, Pressure
- **Date picker**: Native `<input type="date">`; min 7 days ago, max 10 days ahead; URL sync
- **BottomNav**: Mobile-only (max-width 767px); Dash | List | History
- **History link**: Desktop header (CurrentWeather, ConditionsList); "• History" next to ViewToggle
- **Routes**: `/history`, `/history/:date`

### Design
- Reuses tokens: `--app-gutter`, `--card-padding`, `--space-*`, `--radius-md`, `--text-primary`, `--border-light`
- Precip/Amount: plain text (non-linked)

---

## Data Gaps

| Column      | Past (observations)              | Future (forecast) |
|------------|-----------------------------------|-------------------|
| Conditions | From DB (after schema change)    | From forecast.hourly |
| Cloud Cover| Not in Tempest; "—"              | "—"               |
| Dew Point  | Derived from temp + humidity     | Derived           |

---

## Related

- [CHANGELOG.md](../../CHANGELOG.md) — 1.5.0 entry
- [docs/roadmap.md](../roadmap.md) — Phase 2
