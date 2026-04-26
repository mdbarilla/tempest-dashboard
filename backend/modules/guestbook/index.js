/**
 * Guestbook module
 *
 * Owns: visit entries, guestbook signing.
 * Storage: guestbook table in weather.db (shared SQLite via weather module's database service).
 *
 * No cross-module events currently. Future possibilities:
 *   weather.frost.clear  →  show planting season note on guest visit page
 */

const router = require('./router');

function register(app, eventBus) {
  app.use('/api/guestbook', router);
}

module.exports = { register };
