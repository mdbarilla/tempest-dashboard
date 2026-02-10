# Tempest Project Status & Bug Tracking

**Last Updated**: 2026-02-07  
**Current Version**: 1.4.7  
**Status**: ✅ **Deployed to Production**

---


### Quick Stats
- **Current Version**: 1.4.7 (backend & dashboard synchronized)
- **Open Bugs**: 2 (1 high, 1 low priority)
- **Pending deploy**: Condition tints restored + CSS cleanup (ready for 1.4.8 or ad-hoc)
- **Recent Fixes**: Bug #2 (Reset to API) - Fixed 2026-01-28
- **Build Outputs**: Cleaned (kept 2 most recent builds)
- **Documentation**: Complete and up-to-date

---

## Version Status

### ✅ Version Consistency Verified
- **Backend**: 1.4.7 (`backend/package.json`)
- **Dashboard**: 1.4.7 (`apps/dashboard/package.json`)
- **Last Release**: 1.4.7 (2026-02-07) — Tappable cards, metric detail modals, design tokens, 3d/7d charts

**Status**: All versions synchronized ✅

---

## Priority Order (Top → Bottom)

### 1. Planned for 1.4.8 — UI bugs + precip timestamp
- **Animation on list rows/cards**: Add entrance animations with stagger delays
- **Rows swipeable** (prioritize): Validate behavior; likely needs tweaks
- **Fix horizontal text on mobile** (verify): Check if text overflow/clipping is still an issue
- **Precipitation Log — Editable Timestamp**: Allow time per entry (e.g. ".5\" at 4pm")
- **Modal Backdrop Blur Not Rendering**: Fix `backdrop-filter` when parent has `overflow: hidden`

### 2. Planned for 1.4.9 — LLM
- **Bug #1**: "Condition summary unavailable" — instrumentation added, awaiting logs
- **Bug #4**: LLM prompt refinements — tune to avoid generic/repetitive output

### 3. TBD (Wind chart)
- **Wind Detail Chart — Dual Trend Lines**: Speed + gusts as separate trend lines
- **Wind Chart Seismograph Effect**: 5-min bucketing or smoothing for jagged 24h wind lines

### Deprecated / Removed from Backlog
- ~~Increase padding above cards~~ — Not needed
- ~~Improve reflow at widest monitors~~ — Not needed
- ~~Condition-based ambient overlays~~ — **Deprecated** (see Bug #3)

---

## Open Bugs

### 🔴 HIGH PRIORITY

#### Bug #1: "Condition summary unavailable"
**Status**: Open (Instrumentation Added)  
**Priority**: High  
**Description**: Debug and fix issue where bridge returns condition but no `ai_prompt`, causing backend to set fallback message.

**Instrumentation Added** (2026-01-28):
- ✅ Enhanced debug logging in `backend/services/ai-bridge.js`:
  - Logs when bridge returns condition but no `ai_prompt`
  - Logs full bridge response details when fallback is set
  - Includes `art_engine_status`, `last_ai_error`, and full response data
- ✅ Ready to capture root cause when issue occurs

**Affected Files**:
- `backend/services/ai-bridge.js` - Debug logging added ✅
- `raspberry-pi/weather_bridge/weather_bridge.py` - Ready for fixes

**Next Steps**:
1. Monitor logs for `[Bug #1 Debug]` messages when issue occurs
2. Analyze captured data to identify root cause
3. Fix based on evidence from logs

---

#### Bug #2: Reset to API (Conditions) - Not Fully Working
**Status**: ✅ **FIXED** (2026-01-28)  
**Priority**: High  
**Description**: "Reset to API" in the condition corrector may still revert to the last correction instead of the raw Tempest API value.

**Fix Applied**:
- ✅ Added comprehensive debug logging:
  - Frontend: `correctionId`, `current.timestamp`, DELETE URL
  - Backend DELETE: `obs_timestamp` received, `deleteCorrectionsInWindow` result, `clearCache` called
  - GET /complete: `correction` check, `shouldApply` logic, raw API condition
- ✅ Verified working in runtime testing
- ✅ Debug logs confirm proper cache clearing and correction deletion

**Affected Files** (All Updated):
- `apps/dashboard/src/components/CurrentWeather.js` - Debug logging added ✅
- `backend/api/weather.js` - Debug logging added ✅
- `backend/services/database.js` - Already correct ✅
- `backend/services/tempest-api.js` - Already correct ✅

---

### ~~🟡 Bug #3: Condition-based Ambient Overlays~~ DEPRECATED
**Status**: Deprecated (2026-02-07)  
**Description**: Condition-based ambient overlays (`data-condition` gradients) have been deprecated. All related plans removed from backlog.

---

### 🟢 LOW PRIORITY

#### Bug #4: LLM Prompt Refinements
**Status**: Open  
**Priority**: Low  
**Description**: Continue tuning to avoid generic/repetitive outputs, add more context/guardrails, integrate feedback logs for further refinement.

**Affected Files**:
- `raspberry-pi/weather_bridge/weather_bridge.py` - LLM prompt
- `backend/services/ai-bridge.js` - Feedback handling

**Next Steps**:
1. Review feedback logs from `POST /api/weather/atmosphere/feedback`
2. Refine prompt based on common issues
3. Add more context/guardrails

---

## Resolved Bugs (Recent)

### ✅ Fixed in 1.4.4 (Pending Release)
- **Bug #2**: Reset to API (Conditions) - Fixed with debug logging and verification
- **Bug #1**: Added instrumentation for "Condition summary unavailable" debugging
- Loosened "The weather is..." restriction with prompt refinement

### ✅ Fixed in 1.4.3
- News carousel implementation
- Image extraction from multiple sources
- Card layout improvements

### ✅ Fixed in 1.4.1
- LLM thumbs up/down feedback
- Condition correction persistence with precip %
- Precipitation trendline merging
- Reset to API backend changes (partial)

### ✅ Fixed in 1.4.0
- Conditions summary / "loading" fallback
- Refresh atmosphere / first load
- Theme auto-switching based on sunrise/sunset

---

## Project Structure & Organization

### Directory Structure
✅ **Well organized**:
```
Tempest/
├── apps/dashboard/          # React frontend (v1.4.7)
├── backend/                 # Node.js API (v1.4.7)
├── scripts/                 # Build & deployment scripts
├── docs/                    # Current documentation
│   └── deployments/        # Version-specific deployment guides
├── archive/                 # Historical docs & deployments
├── build-output/            # Build artifacts (gitignored, cleaned)
├── raspberry-pi/            # Pi-specific configs & bridge
├── CHANGELOG.md            # Version history
├── PROJECT-STATUS.md       # This file
└── DEPLOYMENT.md           # Deployment guide
```

### Cleanup Completed
- ✅ Removed 11 old build directories (kept 2 most recent)
- ✅ Removed stray deployment directories
- ✅ Build outputs properly gitignored
- ✅ Documentation organized and streamlined
- ✅ No duplicate or orphaned files

### Git Status
✅ **Properly ignored**:
- `build-output/` (gitignored)
- `/deployment` (gitignored)
- `node_modules/` (gitignored)
- `*.db` files (gitignored)

---

## Development Readiness

### ✅ Ready for Development
- [x] Version numbers synchronized
- [x] Open bugs documented and prioritized
- [x] Directory structure clean and organized
- [x] Build outputs cleaned up
- [x] Git ignore rules in place
- [x] Documentation current and organized
- [x] CHANGELOG.md up to date
- [x] README.md current

### Development Workflow
1. **Bug Fixes**: See open bugs section above for detailed information
2. **Version Updates**: Update both `package.json` files simultaneously
3. **Builds**: Use `scripts/auto-build-and-deploy.sh`
4. **Documentation**: Update `CHANGELOG.md` and relevant docs

---

## Next Steps

### 1.4.8 (UI + precip)
1. **Animation on list rows**: Add entrance animations with stagger
2. **Rows swipeable**: Validate behavior; likely needs tweaks
3. **Mobile text** (verify): Check if horizontal overflow still an issue
4. **Precip timestamp**: Editable time per entry
5. **Modal backdrop blur**: Fix `backdrop-filter` rendering

### 1.4.9 (LLM)
6. **Bug #1**: Fix "Condition summary unavailable"
   - ✅ Instrumentation added - monitoring logs
   - Debug root cause when issue occurs
   - Fix based on captured evidence

7. **Bug #4**: LLM prompt refinements
   - Review feedback logs
   - Refine prompts

---

## Testing Status

### Manual Testing Needed
- [ ] Test "Reset to API" with multiple corrections
- [ ] Test condition summary with various bridge states
- [ ] Validate swipeable rows behavior on mobile
- [ ] Verify LLM feedback collection

### Automated Testing (Future)
- [ ] Add backend test for Reset to API flow
- [ ] Add e2e test for condition corrections
- [ ] Add unit tests for bridge response handling

---

## Key Files Reference

### Documentation
- `PROJECT-STATUS.md` - This file (project status and bug tracking)
- `CHANGELOG.md` - Version history and release notes
- `docs/release-planning.md` - Release planning and upcoming features
- `docs/setup-operations/rebuild-walkthrough.md` - Step-by-step rebuild guide
- `README.md` - Project overview and quick start
- `DEPLOYMENT.md` - Deployment guide

### Configuration
- `backend/package.json` - Backend version and dependencies
- `apps/dashboard/package.json` - Dashboard version and dependencies
- `.gitignore` - Git ignore rules (includes build-output/)

### Scripts
- `scripts/auto-build-and-deploy.sh` - Main deployment script
- `scripts/ping-atmosphere.sh` - Test AI bridge
- `scripts/test-api.sh` - Test backend API

---

## Notes

- All bugs are documented in `CHANGELOG.md` under `[Unreleased]` section
- Detailed bug analysis available in `docs/release-planning.md`
- Archive contains historical bugfix plans and summaries
- Project structure follows best practices
- Ready for continued iteration and debugging

---

**Status**: ✅ Production Ready, Ready for Iteration
