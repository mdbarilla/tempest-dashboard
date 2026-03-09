/**
 * Garden seed and planting database.
 * Uses separate SQLite file: data/garden.db
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Set GARDEN_DB_PATH to point at Garden/data/garden.db (e.g. /path/to/Garden/data/garden.db)
const DEFAULT_DB = path.join(__dirname, '../data/garden.db');
const DB_PATH = process.env.GARDEN_DB_PATH || DEFAULT_DB;

let db = null;
let resolvedDbPath = DB_PATH;

function ensureDirectoryFor(dbPath) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function getDb() {
  if (db) return db;

  try {
    ensureDirectoryFor(resolvedDbPath);
  } catch (err) {
    // If the configured garden path is not writable on target hosts, fall back to local backend data path.
    if (resolvedDbPath !== DEFAULT_DB && (err.code === 'EACCES' || err.code === 'EPERM')) {
      console.warn(`Garden DB path not writable (${resolvedDbPath}). Falling back to ${DEFAULT_DB}.`);
      resolvedDbPath = DEFAULT_DB;
      ensureDirectoryFor(resolvedDbPath);
    } else {
      throw err;
    }
  }

  db = new sqlite3.Database(resolvedDbPath, (err) => {
    if (err) {
      console.error('Garden DB error:', err);
    }
  });
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function initSchema() {
  const d = getDb();
  d.serialize(() => {
    d.run(`
      CREATE TABLE IF NOT EXISTS seeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variety_name TEXT NOT NULL,
        brand_source TEXT,
        purchase_period TEXT,
        type TEXT,
        indoor_outdoor TEXT,
        planting_timing TEXT,
        description TEXT,
        planting_instructions TEXT,
        notes_tips TEXT,
        image_path TEXT,
        source_year TEXT,
        catalog_url TEXT,
        product_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    d.run(`ALTER TABLE seeds ADD COLUMN product_url TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds product_url:', err);
    });
    d.run(`
      CREATE TABLE IF NOT EXISTS plantings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seed_id INTEGER NOT NULL,
        date_planted DATE NOT NULL,
        amount INTEGER,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (seed_id) REFERENCES seeds(id)
      )
    `);
    d.run(`CREATE INDEX IF NOT EXISTS idx_seeds_type ON seeds(type)`);
    d.run(`CREATE INDEX IF NOT EXISTS idx_seeds_planting_timing ON seeds(planting_timing)`);
    d.run(`CREATE INDEX IF NOT EXISTS idx_seeds_purchase_period ON seeds(purchase_period)`);
    d.run(`CREATE INDEX IF NOT EXISTS idx_plantings_seed_id ON plantings(seed_id)`);
    d.run(`CREATE INDEX IF NOT EXISTS idx_plantings_date ON plantings(date_planted DESC)`);
  });
}

// Initialize on first require
initSchema();

module.exports = {
  run,
  get,
  all,
  getDb,
  initSchema
};
