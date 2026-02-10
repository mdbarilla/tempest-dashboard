# Deploy 1.4.6 - Chart Data Pipeline Fixes

**Release Date:** 2026-02-07

## Summary

Fixes for 3d/7d metric charts: flatlines, missing data, and truncation issues. Charts now show gaps where data is absent instead of fabricated flatlines.

## Changes

- **Fetch order**: Backend fetches most recent observations first so recent data is never truncated
- **No interpolation**: Missing hourly buckets return null; charts display gaps
- **Cache**: 3d/7d chart data cache reduced to 1 minute

## Deployment

Standard deployment:

```bash
./scripts/auto-build-and-deploy.sh network
```

Or build-only then manual transfer. See [rebuild-walkthrough.md](../setup-operations/rebuild-walkthrough.md).

## Verification

After deploy, verify 3d/7d charts on the Pi (towerhill.local):

1. Open a metric detail modal (e.g. Pressure, Humidity)
2. Select 3d or 7d time range
3. Charts should show gaps where no observations exist (no flatlines across missing data)

The Pi's data collector runs 24/7, so production will have full historical coverage. Local dev uses a separate database that only accumulates while the dev server runs.
