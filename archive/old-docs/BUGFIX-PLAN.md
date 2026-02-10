# Tempest Weather Dashboard - Layout & Trendline Bugfix Plan

**Date**: 2026-01-20
**Version**: Pre-deployment QA Fix
**Priority**: CRITICAL - Blocks Deployment

---

## Executive Summary

The Tempest Weather dashboard has critical layout bugs that prevent deployment to the Raspberry Pi kiosk. The primary issues are:

1. **Trendline positioning completely misaligned with temperature values**
2. **Potential layout bugs in scrolled vs unscrolled states**
3. **Dynamic scaling issues across different viewport sizes**

This document outlines a methodical approach to fix these issues, validate the fixes, perform regression testing, and prepare for deployment.

---

## Critical Bugs Identified

### BUG #1: Trendline Positioning Misalignment ⚠️ CRITICAL

**Location**: `apps/dashboard/src/components/CurrentWeather.js:157-180`

**Problem**:
- Trendline SVG uses absolute positioning with `y = minYOffset + verticalOffset`
- Temperature elements use `transform: translateY(${verticalOffset}px)`
- These two positioning systems are incompatible and don't align

**Expected** (from mocks):
- Trendline should curve smoothly through/below the temperature numbers
- As temperatures move vertically to show highs/lows, the line should follow them precisely

**Root Cause**:
```javascript
// Lines 156-163 - SVG path calculation
const y = minYOffset + verticalOffset;  // Absolute from container top

// Lines 203-207 - Temperature rendering
style={{ transform: `translateY(${verticalOffset}px)` }}  // Relative transform
```

**Fix Strategy**:
1. Calculate the natural baseline position where temperatures render
2. Calculate trendline Y coordinates relative to that baseline + the transform offset
3. Ensure SVG positioning accounts for padding-left of the scrollable container
4. Test alignment at different viewport sizes (mobile, tablet, desktop, kiosk)

---

### BUG #2: Scrolled/Unscrolled Layout Validation

**Location**:
- `apps/dashboard/src/components/CurrentWeather.css:263-372`
- `apps/dashboard/src/components/CurrentWeather.js:14-27`

**Problem**:
Need to validate that the layout transitions correctly match the mocks:

**Unscrolled State**:
- Large temperature vertical layout (temp above metadata)
- Hourly carousel starts immediately to the right
- Metadata shows: conditions, high/low, feels like (stacked)

**Scrolled State** (when user scrolls carousel):
- Temperature shrinks and switches to horizontal layout
- Vertical border separator between temp and metadata
- Metadata moves to the right side
- Transition should be smooth (0.3s ease)

**Validation Required**:
- Confirm transition timing and behavior
- Verify border separator appears/positions correctly
- Ensure no layout shift or jump during transition
- Test at all breakpoints

---

### BUG #3: Responsive Breakpoint Consistency

**Location**:
- `apps/dashboard/src/components/CurrentWeather.js:139-155` (JS)
- `apps/dashboard/src/components/CurrentWeather.css:241-469` (CSS)

**Problem**:
JavaScript calculates dimensions based on `window.innerWidth` with specific breakpoints, while CSS uses media queries. These must be perfectly synchronized.

**JS Breakpoints**:
- `>= 1280px`: itemWidth=90, gapWidth=32, paddingLeft=550
- `>= 769px`: itemWidth=80, gapWidth=28, paddingLeft=500
- `<= 480px`: itemWidth=60, gapWidth=16, paddingLeft=24
- Default: itemWidth=70, gapWidth=20, paddingLeft=32

**CSS Breakpoints**:
- `@media (min-width: 1280px)`: Large desktop
- `@media (min-width: 769px)`: Tablet+
- `@media (max-width: 768px)`: Tablet
- `@media (max-width: 480px)`: Mobile

**Issue**: The JS breakpoint logic has gaps (481-768px uses default, but CSS has specific tablet styling)

---

### BUG #4: Trendline SVG Container Positioning

**Location**: `apps/dashboard/src/components/CurrentWeather.js:179`

**Problem**:
```javascript
style={{ position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: 0 }}
```

The SVG is positioned at `left: 0` but the hourly carousel has significant left padding (500-550px on desktop to clear the temperature zone). The trendline coordinates are calculated without accounting for this padding offset.

**Fix Required**:
- Either add left offset to SVG positioning to match carousel padding
- Or adjust trendline path coordinates to account for container padding

---

## Implementation Plan

### Phase 1: Trendline Positioning Fix (CRITICAL)

**Tasks**:
1. [ ] Calculate the actual rendered baseline of temperature elements
2. [ ] Determine the correct formula for trendline Y coordinates
3. [ ] Update trendline SVG positioning to account for carousel padding-left
4. [ ] Implement the fix in CurrentWeather.js
5. [ ] Test alignment at all viewport sizes

**Acceptance Criteria**:
- Trendline curves smoothly through/below temperature numbers
- Alignment is perfect at 480px, 769px, 1024px, 1280px, and 1920px widths
- No visual misalignment when scrolling
- Trendline starts at correct X position (not offset)

---

### Phase 2: Layout & Transition Validation

**Tasks**:
1. [ ] Test unscrolled state layout against mock Image 1 & 3 (left)
2. [ ] Test scrolled state layout against mock Image 2 & 3 (right)
3. [ ] Validate scroll threshold (currently 10px)
4. [ ] Verify transition smoothness (0.3s ease)
5. [ ] Check border separator positioning
6. [ ] Ensure no content jump during transition

**Acceptance Criteria**:
- Layout matches mocks pixel-perfect
- Transition is smooth with no flicker
- Temperature shrinks proportionally
- Metadata repositions correctly
- Border separator appears in right place

---

### Phase 3: Responsive Breakpoint Synchronization

**Tasks**:
1. [ ] Audit all breakpoints in JS vs CSS
2. [ ] Create a breakpoint constants file for consistency
3. [ ] Update JS logic to match CSS breakpoints exactly
4. [ ] Add viewport resize handler for live updates
5. [ ] Test at each breakpoint transition

**Acceptance Criteria**:
- Breakpoints are consistent between JS and CSS
- No layout breaks when resizing window
- Dimensions calculate correctly at all sizes
- Kiosk mode (1024x600 typical Pi display) looks perfect

---

### Phase 4: Horizontal Scrolling & Dynamic Scaling

**Tasks**:
1. [ ] Test scrolling behavior on touch devices
2. [ ] Validate scroll smoothness
3. [ ] Check scrollbar visibility/styling
4. [ ] Test carousel at different data lengths (12hr, 24hr, 48hr)
5. [ ] Verify last item padding/spacing

**Acceptance Criteria**:
- Smooth scrolling on all devices
- No content cutoff
- Scrollbar appears/hides correctly
- Works with varying amounts of hourly data

---

### Phase 5: Regression Testing

**Tasks**:
1. [ ] Test Metrics section (ensure no impact)
2. [ ] Test Forecast section (10-day cards)
3. [ ] Test Weather icon rendering
4. [ ] Test Condition corrector functionality
5. [ ] Test Precipitation logger
6. [ ] Test navigation between pages
7. [ ] Test auto-refresh (60s interval)
8. [ ] Test with various weather conditions
9. [ ] **MOBILE**: Validate 2x3 grid layout for metrics (not single list)
10. [ ] **MOBILE**: Test full-screen edit menus for condition corrector
11. [ ] **MOBILE**: Test full-screen edit menus for precipitation logger

**Test Devices**:
- Mobile: 375px, 414px, 480px
- Tablet: 768px, 834px, 1024px
- Desktop: 1280px, 1440px, 1920px
- Pi Kiosk: 1024x600

**Acceptance Criteria**:
- All existing functionality still works
- No visual regressions
- Performance is acceptable
- No console errors

---

### Phase 6: Documentation & Deployment Prep

**Tasks**:
1. [ ] Update CHANGELOG.md with bug fixes
2. [ ] Document the trendline positioning algorithm
3. [ ] Create deployment checklist
4. [ ] Update version number (1.3.3 or 1.4.0?)
5. [ ] Build production bundle
6. [ ] Test production build locally
7. [ ] Create deployment package
8. [ ] Write deployment instructions for Pi

**Deliverables**:
- Updated documentation
- Tested production build
- Deployment package (tar.gz)
- Version tag in git (if using version control)

---

## Testing Checklist

### Visual Regression Tests
- [ ] Compare unscrolled state to Mock Image 1
- [ ] Compare scrolled state to Mock Image 2
- [ ] Compare grid overlay alignment (Mock Image 3)
- [ ] Verify trendline alignment at all breakpoints
- [ ] Check temperature/metadata positioning
- [ ] Validate hourly carousel spacing
- [ ] Test metrics grid layout
- [ ] Test forecast cards layout

### Functional Tests
- [ ] Horizontal scroll works smoothly
- [ ] Scroll triggers layout transition at correct threshold
- [ ] Temperature shrink animation is smooth
- [ ] Weather icons render correctly
- [ ] Condition corrector opens/closes
- [ ] Precipitation logger works
- [ ] Navigation works
- [ ] Auto-refresh works
- [ ] Touch scrolling works on mobile

### Performance Tests
- [ ] Page load time < 2s
- [ ] Scroll performance is 60fps
- [ ] No memory leaks
- [ ] CPU usage acceptable

### Cross-Browser Tests
- [ ] Chrome/Chromium (Pi uses this)
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Deployment Process

### Pre-Deployment
1. Complete all bug fixes
2. Pass all regression tests
3. Get user approval on visual alignment
4. Build production bundle: `npm run build`
5. Test production build locally
6. Create deployment package

### Deployment to Pi
1. SSH into Raspberry Pi
2. Backup current deployment
3. Stop running services
4. Extract new deployment package
5. Update environment variables if needed
6. Start services
7. Verify application loads
8. Monitor for 5 minutes

### Post-Deployment
1. Visual inspection on actual Pi display
2. Test touch interaction (if touchscreen)
3. Monitor auto-refresh
4. Check logs for errors
5. User acceptance testing

---

## Risk Assessment

### High Risk
- Trendline positioning changes could break layout further
- Breakpoint changes might cause responsive issues
- SVG rendering differences across browsers

### Mitigation
- Test extensively at each breakpoint before moving to next
- Keep backup of working code
- Deploy to staging/test Pi first if available
- Have rollback plan ready

### Low Risk
- Documentation updates
- CSS-only changes
- Minor spacing adjustments

---

## Success Criteria

**Definition of Done**:
- ✅ Trendline aligns perfectly with temperature values
- ✅ Layout matches mocks at all viewport sizes
- ✅ Scrolling is smooth and responsive
- ✅ No layout bugs in scrolled/unscrolled states
- ✅ All regression tests pass
- ✅ User approves visual alignment
- ✅ Successfully deployed to Pi
- ✅ Documentation updated

---

## Timeline Estimate

- Phase 1 (Trendline Fix): 1-2 hours
- Phase 2 (Layout Validation): 30-45 min
- Phase 3 (Breakpoints): 30-45 min
- Phase 4 (Scrolling): 15-30 min
- Phase 5 (Regression): 1 hour
- Phase 6 (Documentation): 30 min
- **Total**: 3.5-5 hours

---

## Notes

- Work methodically through each phase
- Test after each change
- Get user approval before proceeding to deployment
- Document any deviations from plan
- Keep changelog updated

---

**Status**: READY TO BEGIN
**Next Step**: Phase 1 - Fix trendline positioning
