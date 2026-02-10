# 1.5.0 Plan: Tappable Cards / Navigation Enhancement

**Status**: ✅ **COMPLETE** (shipped in 1.4.5–1.4.7)  
**Completed**: 2026-02

---

## Feature Request: Making Cards Tappable

**Goal**: Enable navigation from condition cards to detailed views with rich data visualization.

---

## MVP Approach

- Make condition cards tappable/clickable
- Navigate to Tempest detail pages (graph views) for each metric
- Show historical data visualization for the selected metric
- Use React Router for navigation (e.g., `/conditions/temperature`, `/conditions/humidity`)

---

## Ideal Approach

- Navigate to native graph pages with rich historical data visualization
- Full-screen detail views with interactive charts
- Deep linking support for sharing specific metric views
- Smooth transitions and animations

---

## Research Required

### 1. Feasibility Exploration

- What data is available for detailed graphs? (Historical data from `/recent`, extended time ranges)
- Can we create rich graph visualizations with existing libraries? (Chart.js, Recharts, D3.js)
- What's the performance impact of rendering detailed graphs?

### 2. App Navigation & Information Architecture

- How should navigation flow work? — Modal overlay or ‘card zoom’ approach preferred; minimal touch on navigation, should feel ephemeral rather than deep pages in an app. That said, should also feel easy to get back or close the view.
- Should detail views be route-based (`/conditions/:metric`) or modal-based? — they should all be accessible by unique URLs.
- How to handle back navigation and breadcrumbs? — see above; light touch preferred (nap back arrows, close button) but breadcrumbs may be a more accessible/useful approach. Open to exploration here.
- What's the mobile vs desktop navigation pattern? — see above; mobile fullpage overlays and/or zoomable cards.

### 3. User Experience

- What information should be shown in detail views? - really as much as we can surface from the Tempest API. All are graphs that are navigable by swipe, pinch and/or scroll. They show condition over time and plot line graphs. The current implementation is poor, please see these links for examples.
https://tempestwx.com/station/204768/graph/474291/temp/2
https://tempestwx.com/station/204768/graph/474291/battery/2 — would like to explore including battery data 
https://tempestwx.com/station/204768/graph/474291/pressure/2
https://tempestwx.com/station/204768/graph/474291/wind/2
https://tempestwx.com/station/204768/graph/474291/rain/2 - should incorporate manual data



- Should users be able to compare multiple metrics? - not for v1.
- How to handle deep linking and sharing? - url routing for now is sufficient. No need to add a share feature. 

---

## Potential Implementation

- New route structure: `/conditions/:metricType` (e.g., `/conditions/temperature`)
- New component: `MetricDetailView.js` with graph visualization
- Enhanced data fetching: Extended historical data endpoints (24h, 7d, 30d)
- Graph library integration: Choose and integrate charting library

---

## Scope Consideration

- This may require significant navigation restructuring
- Could be a major point release (1.5.0 or later)
- May need separate planning document for full feature specification

---

## Related Documentation

- Current release planning: `../release-planning.md`
- Conditions list implementation: `plan-1.4.4-conditions-list.md`
