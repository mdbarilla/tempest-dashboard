# Tempest Weather Dashboard - Test Plan

## Overview
This document outlines the test procedures for the Tempest Weather Dashboard's user-controlled features, including manual overrides and the offline status indicator.

---

## 1. Manual Precipitation Entry

### 1.1 Add Precipitation Entry
**Steps:**
1. Navigate to the dashboard main view
2. Locate the Precipitation metric card in the metrics section
3. Click the kebab menu button (⋮) on the Precipitation card
4. Select "Add Entry" from the dropdown menu
5. Select a precipitation type (Snow, Rain, Sleet, Freezing Rain, Hail, Mixed)
6. Enter an amount in inches (e.g., 1.25)
7. Optionally add notes (e.g., "Heavy wet snow")
8. Click "Add to Total"

**Expected Results:**
- [ ] Modal appears with precipitation type options and input fields
- [ ] Amount field validates numeric input only
- [ ] Submission succeeds and modal closes
- [ ] Dashboard reloads with updated precipitation total
- [ ] Precipitation card displays cumulative total from all entries
- [ ] Secondary text shows "(manual)" indicator

### 1.2 View Precipitation History
**Steps:**
1. After adding at least one manual entry, click the kebab menu on Precipitation card
2. Select "View History"

**Expected Results:**
- [ ] History modal opens showing all today's entries
- [ ] Total sum is displayed at the top
- [ ] Each entry shows amount, type, time, and notes (if any)
- [ ] Delete button (×) appears for each entry

### 1.3 Delete Individual Entry
**Steps:**
1. Open the precipitation history view
2. Click the delete button (×) next to an entry

**Expected Results:**
- [ ] Entry is removed from the list
- [ ] Total recalculates immediately
- [ ] Dashboard refreshes with updated total

### 1.4 Delete All Entries
**Steps:**
1. Open the precipitation history view with multiple entries
2. Click "Delete All" button
3. Confirm in the dialog

**Expected Results:**
- [ ] All entries are deleted
- [ ] Dashboard returns to showing API-reported precipitation
- [ ] Manual indicator no longer appears

---

## 2. Condition Correction (Manual Override)

### 2.1 Submit Condition Correction
**Steps:**
1. Observe the current weather condition displayed (e.g., "Clear")
2. Click the kebab menu button (⋮) next to the condition
3. Select "Edit Condition"
4. Select the actual observed condition from the grid (e.g., "Snow")
5. Click "Submit"

**Expected Results:**
- [ ] Modal appears with condition options
- [ ] Selected condition is highlighted
- [ ] Submission succeeds and page reloads
- [ ] Dashboard displays the corrected condition
- [ ] "CORRECTED" label appears next to the condition
- [ ] Weather icon updates to match the new condition

### 2.2 Reset Correction to API
**Steps:**
1. With an active correction (CORRECTED label visible), click kebab menu
2. Select "Reset to API"

**Expected Results:**
- [ ] Correction is removed from database
- [ ] Dashboard reloads with original API condition
- [ ] CORRECTED label disappears
- [ ] Weather icon reverts to API-reported condition

### 2.3 Correction Persistence
**Steps:**
1. Submit a condition correction
2. Close the browser/tab
3. Reopen the dashboard within 30 minutes

**Expected Results:**
- [ ] Correction persists across page refreshes
- [ ] Correction appears on any device accessing the dashboard
- [ ] Correction expires after 30 minutes automatically

---

## 3. Offline/Stale Status Indicator

### 3.1 Offline Banner (Connection Lost)
**Trigger:** Stop the backend server or disconnect network

**Expected Results:**
- [ ] Red banner appears at top: "Tempest offline - showing cached data from [time]"
- [ ] Banner includes clickable link to Tempest station website
- [ ] "Retry Now" button is visible
- [ ] Dashboard continues displaying cached data

### 3.2 Retry Connection
**Steps:**
1. With offline banner visible, click "Retry Now"
2. If connection restored, observe behavior

**Expected Results:**
- [ ] If successful: Banner disappears, fresh data loads
- [ ] If still offline: Banner remains with updated message

### 3.3 Stale Data Banner
**Trigger:** Keep dashboard open for 10+ minutes without new data

**Expected Results:**
- [ ] Green/olive banner appears: "No new data for 10+ minutes"
- [ ] Last update time is displayed
- [ ] "Refresh" button is available

### 3.4 Cache Behavior
**Steps:**
1. Load dashboard with active connection
2. Kill backend server
3. Refresh page

**Expected Results:**
- [ ] Dashboard loads from localStorage cache
- [ ] Offline banner displays with cache timestamp
- [ ] Retry button clears cache on click (forcing fresh fetch attempt)

---

## 4. Menu/Icon Consistency

### 4.1 Kebab Menu Visibility
**Check across both themes:**
1. Light theme (6 AM - 8 PM)
2. Dark theme (8 PM - 6 AM)

**Expected Results:**
- [ ] All kebab menu buttons have consistent appearance
- [ ] Buttons use `--text-secondary` color without opacity variations
- [ ] Buttons are equally visible on both light and dark backgrounds
- [ ] Hover states work correctly

### 4.2 Metric Icons
**Visual inspection of all metric cards:**

**Expected Results:**
- [ ] Pressure: Gauge icon with dial indicator
- [ ] Humidity: Filled water droplet (not outlined)
- [ ] Wind: Wind swirl icon
- [ ] Precipitation: Cloud with rain lines
- [ ] Solar: Sun with rays
- [ ] Sunset/Sunrise: Half sun with horizon

---

## 5. Sparkline Trend Indicators

### 5.1 Sparkline Data Display
**Prerequisite:** Dashboard running for 6+ hours with data collection

**Expected Results:**
- [ ] Pressure sparkline visible (if 6 hours of data exists)
- [ ] Humidity sparkline visible
- [ ] Wind sparkline visible
- [ ] Precipitation sparkline visible (if precipitation recorded)
- [ ] Sparklines show oldest data on left, newest on right
- [ ] Sparklines respond to hover (increased opacity/stroke)

### 5.2 Sparkline Pressure Debug
**If pressure sparkline not appearing:**
1. Check API endpoint: `GET /api/weather/recent`
2. Verify `data.pressure` array has 2+ non-null values

**Expected API Response:**
```json
{
  "success": true,
  "count": 6,
  "data": {
    "pressure": [1015.2, 1015.5, 1015.8, 1016.0, 1016.2, 1016.5],
    "humidity": [...],
    "wind": [...],
    "precipitation": [...]
  }
}
```

---

## 6. Layout & Spacing Verification

### 6.1 Horizontal Alignment Check
**Verify consistent left/right padding across sections:**

**Expected Results:**
- [ ] Header: 3rem horizontal padding
- [ ] Current Weather: 3rem horizontal padding
- [ ] Hourly Preview: Extends to 3rem from each edge
- [ ] Metrics Grid: 3rem horizontal padding
- [ ] 10-Day Forecast: 3rem horizontal padding
- [ ] Footer: 3rem horizontal padding

### 6.2 Responsive Breakpoints
**Test at various screen widths:**
- [ ] 1440px+ (wide): 6-column metrics layout
- [ ] 1024-1439px: 3x2 metrics grid
- [ ] 768-1023px: 2x3 metrics grid
- [ ] 480-767px: Adjusted padding, smaller fonts
- [ ] <480px: Single-column stacked layout

---

## 7. API Endpoints Verification

### Manual Precipitation
| Endpoint | Method | Test |
|----------|--------|------|
| `/api/weather/precipitation/manual` | POST | Create entry |
| `/api/weather/precipitation/today` | GET | List today's entries |
| `/api/weather/precipitation/manual/:id` | DELETE | Remove entry |

### Condition Corrections
| Endpoint | Method | Test |
|----------|--------|------|
| `/api/weather/correction` | POST | Submit correction |
| `/api/weather/corrections` | GET | List all corrections |
| `/api/weather/correction/:id` | DELETE | Cancel correction |

### Historical Data
| Endpoint | Method | Test |
|----------|--------|------|
| `/api/weather/recent` | GET | Get 6-hour sparkline data |
| `/api/weather/complete` | GET | Full weather data with overrides |

---

## Test Environment

- **Backend:** Node.js/Express with SQLite database
- **Frontend:** React 18 with CSS custom properties
- **Browser Support:** Chrome, Safari, Firefox (latest)
- **Device Types:** Desktop, Tablet, Raspberry Pi kiosk

---

## Sign-off

| Test Section | Tester | Date | Pass/Fail |
|--------------|--------|------|-----------|
| Manual Precipitation | | | |
| Condition Correction | | | |
| Offline Status | | | |
| Menu/Icon Consistency | | | |
| Sparkline Trends | | | |
| Layout Verification | | | |
| API Endpoints | | | |
