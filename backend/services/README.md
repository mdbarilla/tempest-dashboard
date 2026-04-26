# services/ — Archived

These files have been migrated to `modules/` as part of the Step 0 module restructure.

| Old location | New location |
|---|---|
| `services/database.js` | `modules/weather/services/database.js` |
| `services/tempest-api.js` | `modules/weather/services/tempest-api.js` |
| `services/nws-api.js` | `modules/weather/services/nws-api.js` |
| `services/ai-bridge.js` | `modules/weather/services/ai-bridge.js` |
| `services/data-collector.js` | `modules/weather/services/data-collector.js` |
| `services/gardenDb.js` | `modules/garden/db.js` (already canonical) |

`server.js` no longer imports from this directory. Safe to delete once confirmed stable on Pi.
