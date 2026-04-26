# api/ — Archived

These files have been migrated to `modules/` as part of the Step 0 module restructure.

| Old location | New location |
|---|---|
| `api/weather.js` | `modules/weather/routes/weather.js` |
| `api/guestbook.js` | `modules/guestbook/routes/guestbook.js` |
| `api/garden.js` | Superseded by `modules/garden/routes/` (seeds, activities, plantings) |

`server.js` no longer imports from this directory. Safe to delete once confirmed stable on Pi.
