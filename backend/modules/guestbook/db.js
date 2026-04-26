/**
 * Guestbook database adapter.
 *
 * Uses the same SQLite file as the weather module (weather.db), but opens its
 * own connection with the raw sqlite3 callback API — matching how the route
 * handlers are written.
 *
 * Creates the guestbook table on first use.
 */

const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const dbPath = process.env.DATABASE_PATH
  || path.resolve(__dirname, '../../data/weather.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('[guestbook db] open error:', err);
});

db.run(`
  CREATE TABLE IF NOT EXISTS guestbook (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id  TEXT    NOT NULL,
    name      TEXT    NOT NULL,
    message   TEXT,
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error('[guestbook db] schema error:', err);
});

module.exports = db;
