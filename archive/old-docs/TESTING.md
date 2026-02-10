# Tempest Weather Dashboard - Testing Guide

## Test Cases for New Features

### 1. Manual Precipitation Logging

#### Test Case 1.1: Log Snow Precipitation
**Steps:**
1. Navigate to the dashboard
2. Locate the Precipitation metric card
3. Click "Log Precipitation" button
4. Select "Snow" as precipitation type
5. Enter amount: 2.5 inches
6. Enter notes: "Heavy wet snow, started at 2pm"
7. Click Submit

**Expected Result:**
- Modal closes
- Page reloads
- Precipitation metric shows "2.50 in"
- Secondary text shows "snow (manual) · [API value] in last hour"
- Notes appear below in italics
- Button changes to "Manual Entry"

#### Test Case 1.2: Update Manual Entry
**Steps:**
1. With existing manual entry, click "Manual Entry" button
2. Change type to "Mixed"
3. Update amount to 3.0 inches
4. Update notes
5. Click Submit

**Expected Result:**
- New entry replaces old one
- Display updates with new values

#### Test Case 1.3: Validate Input Constraints
**Steps:**
1. Click "Log Precipitation"
2. Try to submit without selecting type
3. Try to submit without entering amount
4. Enter negative amount
5. Enter non-numeric amount

**Expected Result:**
- Submit button disabled when fields incomplete
- HTML5 validation prevents invalid numbers
- User-friendly error messages

#### Test Case 1.4: Precipitation Types
**Test all 6 types:**
- Snow ❄️
- Rain 🌧️
- Sleet 🌨️
- Freezing Rain 🧊
- Hail 🌨️
- Mixed 🌦️

**Expected Result:**
- Each type displays correctly with icon
- Backend accepts and stores each type
- Type shown in metric secondary text

---

### 2. Persistent Condition Corrections

#### Test Case 2.1: Condition Correction Persists Across Page Reload
**Steps:**
1. Note current weather condition
2. Click "Report Different"
3. Select different condition (e.g., "Cloudy" if showing "Clear")
4. Click Submit
5. Wait for page reload
6. Refresh browser (Cmd/Ctrl + R)
7. Check condition still shows corrected value

**Expected Result:**
- Corrected condition persists after reload
- Button shows "Corrected" state
- Condition displays user-selected value, not API value

#### Test Case 2.2: Correction Persists for Full Day
**Steps:**
1. Submit a condition correction in the morning
2. Wait several hours
3. Refresh the page multiple times throughout the day
4. Check at different times of day

**Expected Result:**
- Correction remains active all day
- Resets at midnight (new day)
- "Corrected" button state persists

#### Test Case 2.3: Multiple Device Sync
**Steps:**
1. Open dashboard on Device A
2. Submit condition correction
3. Open dashboard on Device B (different browser/device)
4. Verify correction appears on Device B

**Expected Result:**
- Correction visible on all devices
- Backend stores single source of truth
- Both devices show "Corrected" state

#### Test Case 2.4: Correction History
**Steps:**
1. Submit multiple corrections throughout the day
2. Use API endpoint: `GET /api/weather/corrections?limit=10`
3. Review correction history

**Expected Result:**
- All corrections stored in database
- Timestamps accurate
- Most recent correction applied to current weather

---

### 3. Offline Detection & Error Handling

#### Test Case 3.1: Tempest Station Goes Offline
**Steps:**
1. Ensure dashboard is working normally
2. Disconnect Tempest station from WiFi (or simulate by blocking API)
3. Wait for next refresh cycle (60 seconds)

**Expected Result:**
- Orange/yellow banner appears: "⚠️ Tempest station offline - showing cached data"
- Data continues displaying (from cache)
- Last update timestamp shown
- Automatic retry attempts in background

#### Test Case 3.2: Backend Server Down
**Steps:**
1. Stop the backend server: `pm2 stop tempest-backend`
2. Observe dashboard behavior

**Expected Result:**
- Connection banner appears
- Cached data loads from localStorage
- Message indicates retrying
- After 3 retry attempts, shows cached data with timestamp

#### Test Case 3.3: localStorage Fallback
**Steps:**
1. Load dashboard with working connection
2. Wait for data to cache (automatic)
3. Stop backend server
4. Refresh page (Cmd/Ctrl + R)

**Expected Result:**
- Page loads immediately with cached data
- Banner shows offline status
- Last update timestamp displays correctly
- Data is less than 10 minutes old (or doesn't load if too stale)

#### Test Case 3.4: Stale Data Detection
**Steps:**
1. Load dashboard normally
2. Stop automatic updates (pause in debugger or block network)
3. Wait 5+ minutes

**Expected Result:**
- After 5 minutes, banner changes to: "⏱️ Data may be stale - last updated [time]"
- Background color changes to yellow/amber
- Data still displays but marked as stale

#### Test Case 3.5: Connection Recovery
**Steps:**
1. Simulate offline state (stop backend)
2. Wait for offline banner to appear
3. Restart backend server
4. Wait for next retry attempt (exponential backoff)

**Expected Result:**
- Within 1-10 seconds, connection restored
- Banner disappears with fade animation
- Fresh data loads
- "Last updated" timestamp updates
- Cached data replaced with live data

#### Test Case 3.6: Exponential Backoff Retry
**Steps:**
1. Monitor console logs (F12 → Console)
2. Stop backend server
3. Observe retry attempts

**Expected Result:**
- Retry 1: Immediately
- Retry 2: After 2 seconds
- Retry 3: After 4 seconds
- After 3 retries: Gives up, shows cached data
- Console logs show retry attempts

#### Test Case 3.7: Network Timeout
**Steps:**
1. Throttle network to "Slow 3G" in DevTools
2. Observe request timeouts (10 second limit)

**Expected Result:**
- Requests timeout after 10 seconds
- Retry logic triggers
- User not stuck waiting indefinitely
- Cached data loads if retries fail

#### Test Case 3.8: Partial Data Failure
**Steps:**
1. Block only `/api/weather/recent` endpoint
2. Allow `/api/weather/complete` to work

**Expected Result:**
- Main weather data loads normally
- Sparkline/recent data gracefully omitted
- No error screen shown
- Metrics display without trend sparklines

---

### 4. Edge Cases & Error Scenarios

#### Test Case 4.1: Empty Cache + Offline
**Steps:**
1. Clear localStorage: `localStorage.clear()`
2. Clear browser cache
3. Load page with backend offline

**Expected Result:**
- Loading spinner shows
- Retries 3 times
- After retries, shows error screen:
  - "Unable to fetch weather data"
  - "Retry" button available
  - Helpful error message

#### Test Case 4.2: Corrupt Cached Data
**Steps:**
1. Set invalid JSON in localStorage:
   ```javascript
   localStorage.setItem('weatherData', '{invalid json}');
   ```
2. Reload page

**Expected Result:**
- Catches JSON parse error
- Ignores corrupt cache
- Fetches fresh data from API
- Console logs error but doesn't crash

#### Test Case 4.3: API Returns Invalid Data
**Steps:**
1. Modify backend to return malformed data
2. Observe error handling

**Expected Result:**
- Error caught gracefully
- Fallback to cached data if available
- Error message displayed
- App doesn't crash

#### Test Case 4.4: Simultaneous Manual Entries
**Steps:**
1. Open dashboard on two devices
2. Submit different manual precipitation entries simultaneously

**Expected Result:**
- Last write wins (database timestamp)
- Both devices eventually show same data after refresh
- No data corruption

#### Test Case 4.5: Very Old Cached Data
**Steps:**
1. Set weatherDataTimestamp to 24 hours ago:
   ```javascript
   localStorage.setItem('weatherDataTimestamp', Date.now() - 24*60*60*1000);
   ```
2. Load page with backend offline

**Expected Result:**
- Old cached data ignored (> 10 minutes)
- Shows error screen instead
- "No cached data available" message

---

## Manual Testing Checklist

### Before Release:
- [ ] All manual precipitation types work
- [ ] Condition corrections persist across page reloads
- [ ] Condition corrections persist across devices
- [ ] Offline banner appears when Tempest disconnects
- [ ] Stale banner appears after 5 minutes without updates
- [ ] Cached data loads when offline
- [ ] Connection automatically restores when back online
- [ ] Retry logic works with exponential backoff
- [ ] localStorage caching works correctly
- [ ] Error states display helpful messages
- [ ] Responsive design works on mobile
- [ ] Light/dark theme works correctly
- [ ] No console errors in normal operation

### Browser Compatibility:
Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Network Conditions:
Test with:
- [ ] Normal connection
- [ ] Slow 3G
- [ ] Offline mode
- [ ] Intermittent connection

---

## Automated Testing (Future Enhancement)

### Suggested Test Framework:
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: Playwright or Cypress
- **API Tests**: Supertest

### Priority Test Coverage:
1. localStorage caching functions
2. Retry logic with exponential backoff
3. Connection status detection
4. API error handling
5. Manual data entry validation
6. Condition correction persistence

---

## Performance Testing

### Metrics to Monitor:
- **Initial Load Time**: < 2 seconds (with cache)
- **Time to Interactive**: < 3 seconds
- **Refresh Cycle**: 60 seconds
- **Cache Size**: < 500KB localStorage
- **API Response Time**: < 1 second (normal)
- **Retry Timeout**: 10 seconds max

### Tools:
- Chrome DevTools Lighthouse
- Network tab for request timing
- Performance tab for rendering metrics

---

## Deployment Verification

After deploying to production:

1. **Verify Backend Migration**:
   ```bash
   # SSH into Raspberry Pi
   cd ~/tempest/backend
   sqlite3 data/weather.db "SELECT name FROM sqlite_master WHERE type='table';"
   ```
   - Confirm `manual_precipitation` table exists
   - Confirm `condition_corrections` table exists

2. **Test API Endpoints**:
   ```bash
   # Test manual precipitation endpoint
   curl -X POST http://localhost:3001/api/weather/precipitation/manual \
     -H "Content-Type: application/json" \
     -d '{"timestamp":1234567890,"amountInches":1.5,"precipType":"snow","notes":"Test entry"}'

   # Verify condition correction
   curl http://localhost:3001/api/weather/corrections?limit=5
   ```

3. **Monitor Logs**:
   ```bash
   pm2 logs tempest-backend
   ```

4. **Test from External Network**:
   - Access dashboard from phone (not on local network)
   - Verify all features work remotely

---

## Troubleshooting Guide

### Issue: "Tempest station offline" banner won't go away
**Solution:**
1. Check Tempest is connected to WiFi
2. Verify API credentials in backend `.env`
3. Check backend logs: `pm2 logs tempest-backend`
4. Test API manually: `curl http://localhost:3001/api/weather/current`

### Issue: Manual precipitation not saving
**Solution:**
1. Check database permissions: `ls -la ~/tempest/backend/data/`
2. Verify table exists: `sqlite3 data/weather.db ".tables"`
3. Check backend logs for database errors
4. Test endpoint manually with curl

### Issue: Cached data not loading
**Solution:**
1. Open DevTools → Application → Local Storage
2. Verify `weatherData` and `weatherDataTimestamp` exist
3. Check timestamp is not too old (< 10 minutes)
4. Clear cache and test fresh: `localStorage.clear()`

### Issue: Condition corrections not persisting
**Solution:**
1. Check database has corrections:
   ```bash
   sqlite3 data/weather.db "SELECT * FROM condition_corrections ORDER BY created_at DESC LIMIT 5;"
   ```
2. Verify `getTodayCorrection()` function works
3. Check browser is not blocking cookies/localStorage
4. Test on different device to rule out local issue

---

## Success Criteria

All features are considered working when:

1. ✅ Manual precipitation entries save and display correctly
2. ✅ Precipitation data persists across page reloads and devices
3. ✅ Condition corrections persist for full day
4. ✅ Condition corrections sync across all devices
5. ✅ Offline detection triggers within 1 refresh cycle
6. ✅ Cached data loads when offline
7. ✅ Connection restores automatically when back online
8. ✅ No errors in console during normal operation
9. ✅ All manual tests pass
10. ✅ Performance metrics met

---

## Test Data Examples

### Valid Manual Precipitation Entry:
```json
{
  "timestamp": 1705680000,
  "amountInches": 2.5,
  "precipType": "snow",
  "notes": "Heavy wet snow, started at 2pm",
  "temperature": 32.5
}
```

### Valid Condition Correction:
```json
{
  "timestamp": 1705680000,
  "reportedCondition": "Snow",
  "originalCondition": "Partly Cloudy",
  "temperature": 32.5
}
```

### Cached Data Structure:
```json
{
  "current": { ... },
  "forecast": { ... }
}
```

---

**Last Updated:** 2026-01-18
**Version:** 2.0.0
**Status:** Ready for Testing
