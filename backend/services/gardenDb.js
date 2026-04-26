/**
 * Garden seed and planting database.
 * Uses separate SQLite file: data/garden.db
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Set GARDEN_DB_PATH to point at garden-data/data/garden.db.
const DEFAULT_DB = path.join(__dirname, '../data/garden.db');
const DEPLOY_GARDEN_DB = path.resolve(__dirname, '../../garden-data/data/garden.db');
const CONFIGURED_DB = process.env.GARDEN_DB_PATH ? String(process.env.GARDEN_DB_PATH).trim() : null;

let db = null;

function isFile(dbPath) {
  try {
    return fs.existsSync(dbPath) && fs.statSync(dbPath).isFile();
  } catch {
    return false;
  }
}

function looksLikeMacPath(dbPath) {
  if (!dbPath) return false;
  const normalized = dbPath.replace(/\\/g, '/');
  return normalized.startsWith('/Users/') || normalized.includes('/Library/Mobile Documents/');
}

function resolveDbPath() {
  // Prefer explicit configured DB only when the file already exists.
  if (CONFIGURED_DB && isFile(CONFIGURED_DB)) return CONFIGURED_DB;
  // Prefer shared garden-data DB in deployment so weather and garden apps stay aligned.
  if (isFile(DEPLOY_GARDEN_DB)) return DEPLOY_GARDEN_DB;
  if (isFile(DEFAULT_DB)) return DEFAULT_DB;

  // If configured path is clearly from another host (e.g. macOS path on Pi), ignore it.
  if (CONFIGURED_DB && looksLikeMacPath(CONFIGURED_DB)) {
    console.warn(`Garden DB path appears host-specific and was not found: ${CONFIGURED_DB}`);
  } else if (CONFIGURED_DB) {
    return CONFIGURED_DB;
  }

  // Fresh setup fallback: prefer deployment garden-data location when directory exists.
  if (fs.existsSync(path.dirname(DEPLOY_GARDEN_DB))) return DEPLOY_GARDEN_DB;
  return DEFAULT_DB;
}

let resolvedDbPath = resolveDbPath();

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
    // If current path is not writable, try known safe fallbacks in order.
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      const fallbackCandidates = [DEPLOY_GARDEN_DB, DEFAULT_DB].filter((p, idx, arr) => p !== resolvedDbPath && arr.indexOf(p) === idx);
      let switched = false;
      for (const candidate of fallbackCandidates) {
        try {
          ensureDirectoryFor(candidate);
          console.warn(`Garden DB path not writable (${resolvedDbPath}). Falling back to ${candidate}.`);
          resolvedDbPath = candidate;
          switched = true;
          break;
        } catch {
          // Try next fallback candidate.
        }
      }
      if (!switched) throw err;
    } else {
      throw err;
    }
  }

  console.log(`[gardenDb] using database at ${resolvedDbPath}`);
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
    d.run(`ALTER TABLE seeds ADD COLUMN active_year TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds active_year:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN indoor_instructions TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds indoor_instructions:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN outdoor_instructions TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds outdoor_instructions:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN recommended_method TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds recommended_method:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN url_status TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds url_status:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN url_verified_at DATETIME`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds url_verified_at:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN soil_type TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds soil_type:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN container_type TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds container_type:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN year_decision TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds year_decision:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN indoor_planting_timing TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds indoor_planting_timing:', err);
    });
    d.run(`ALTER TABLE seeds ADD COLUMN outdoor_planting_timing TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('seeds outdoor_planting_timing:', err);
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
    d.run(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seed_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'planting',
        occurred_at DATE NOT NULL,
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
    d.run(`ALTER TABLE activities ADD COLUMN indoor_outdoor TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities indoor_outdoor:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN soil_type TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities soil_type:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN container_type TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities container_type:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN location TEXT`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities location:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN germinated_count INTEGER`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities germinated_count:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN germinated_at DATE`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities germinated_at:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN in_ground INTEGER`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities in_ground:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN gifted INTEGER`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities gifted:', err);
    });
    d.run(`ALTER TABLE activities ADD COLUMN containers_count INTEGER`, (err) => {
      if (err && !/duplicate column name/i.test(err.message)) console.error('activities containers_count:', err);
    });
    d.run(`CREATE INDEX IF NOT EXISTS idx_activities_seed_id ON activities(seed_id)`);
    d.run(`CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(occurred_at DESC)`);
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
