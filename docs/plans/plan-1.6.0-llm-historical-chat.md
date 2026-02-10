# 1.6.0 Plan: LLM historical data chat

**Status**: Planned  
**Slots in after**: 1.4.x (LLM first, then Radar in 1.6.0)

---

## Goal

Lightweight in-app chat to query the Tempest historical database in natural language (e.g. "tell me the average temp over the past week"), with helpful text responses and optional inline charts. Analysis and retrieval of historical data only; guardrails and MVP command set are acceptable.

---

## Versioning note

This LLM feature is planned for **1.5.0**, along with LLM bug fixes (Condition summary unavailable, prompt refinements). Radar preview tile is planned for **1.6.0**.

---

## Summary

- **Backend:** New `POST /api/weather/query` (or `ask`) that accepts structured `{ intent, metric?, range? }` for MVP. Uses existing `getStatistics` and `/recent`; returns `{ summary, chart? }` so the UI can show text and optionally render `MetricChart`.
- **Frontend:** Chat panel (e.g. floating button + slide-out), message list, quick-action buttons (or simple phrase parsing). When the response includes `chart: { metric, hours }`, render existing `MetricChart` via `useHistoricalData`.
- **MVP:** No LLM required — structured intents (average/min/max/summary/chart), ranges (24h/7d/30d), and metrics aligned with current chart support.
- **Upgrade:** Optional LLM with tools (`get_stats`, `get_chart_data`) for natural language; same response shape and UI.

---

## Where it appears in planning

- **Release planning:** `docs/release-planning.md` — "Planned for 1.5.0".
- **Roadmap:** `docs/roadmap.md` — Phase 2 (Analytics) and Phase 6 (AI & ML) both reference this feature and this plan.

---

## Full implementation plan

Detailed architecture, response shape, chart reuse, and file-level tasks are in the Cursor plan: **LLM historical data chat** (`.cursor/plans/` or the plan created for this feature). Key points:

- Reuse `MetricChart`, `chartHelpers`, `useHistoricalData`; data bounds 7 days (full) / 30 days (hourly).
- Guardrails: predefined intents and ranges for MVP; if LLM is added, tools only for reading stats/chart data, max range 30 days, rate limit.
