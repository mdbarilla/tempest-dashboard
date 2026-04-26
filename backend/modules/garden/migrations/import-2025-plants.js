/**
 * Garden v2 — 2025 plant inventory import
 * Reads 4 CSV files and creates plants records.
 *
 * CSV → garden/zone mapping (actual DB IDs after v2 migration):
 *   Front.csv                 → garden_id=2 (Front Gardens),     zone_id=6  (Front Beds)
 *   Peachtree.csv             → garden_id=1 (Trailside Gardens), zone_id=1  (Peachtree)
 *   Rear Gardens.csv Shade    → garden_id=3 (Rear Gardens),      zone_id=10 (Shade Garden)
 *   Rear Gardens.csv Joanne's → garden_id=3 (Rear Gardens),      zone_id=8  (Joanne's Garden)
 *   Vegetable.csv             → garden_id=1 (Trailside Gardens), zone_id=4  (Vegetable)
 *
 * Run:  node modules/garden/migrations/import-2025-plants.js
 *
 * Idempotent — skips rows where (garden_id, zone_id, name, species) already exists.
 * On Pi: copy csv-exports/ directory into this migrations/ directory before running.
 */

const path = require('path');
const fs   = require('fs');
const sqlite3 = require('sqlite3').verbose();

// ── CSV directory ─────────────────────────────────────────────────────────────
// Looks for csv-exports/ alongside this script first (Pi-friendly), then dev path
const LOCAL_CSV_DIR = path.join(__dirname, 'csv-exports');
const DEV_CSV_DIR   = path.resolve(__dirname, '../../../../../Garden/planning/v2-plan/csv-exports');

function resolveCsvDir() {
  if (fs.existsSync(LOCAL_CSV_DIR)) return LOCAL_CSV_DIR;
  if (fs.existsSync(DEV_CSV_DIR))   return DEV_CSV_DIR;
  throw new Error(
    `csv-exports directory not found.\nTried:\n  ${LOCAL_CSV_DIR}\n  ${DEV_CSV_DIR}\n` +
    `Copy the csv-exports/ folder into: ${__dirname}`
  );
}

// ── DB path resolution ────────────────────────────────────────────────────────
const DEFAULT_DB    = path.join(__dirname, '../../../data/garden.db');
const DEPLOY_DB     = path.resolve(__dirname, '../../../../garden-data/data/garden.db');
const CONFIGURED_DB = process.env.GARDEN_DB_PATH ? String(process.env.GARDEN_DB_PATH).trim() : null;

function resolveDbPath() {
  if (CONFIGURED_DB && fs.existsSync(CONFIGURED_DB)) return CONFIGURED_DB;
  if (fs.existsSync(DEPLOY_DB))  return DEPLOY_DB;
  if (fs.existsSync(DEFAULT_DB)) return DEFAULT_DB;
  if (fs.existsSync(path.dirname(DEPLOY_DB))) return DEPLOY_DB;
  return DEFAULT_DB;
}

// ── Promise wrappers ──────────────────────────────────────────────────────────
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

// ── CSV parser ────────────────────────────────────────────────────────────────
// Simple line-split parser — sufficient for these files (no embedded commas/quotes).
function parseCsv(filepath) {
  const lines = fs.readFileSync(filepath, 'utf8')
    .split('\n')
    .filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] !== undefined ? values[i] : ''; });
    return row;
  });
}

// ── Field parsers ─────────────────────────────────────────────────────────────
function parseTag(raw) {
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

function parseLabelPrinted(raw) {
  return (raw || '').toUpperCase() === 'TRUE' ? 1 : 0;
}

// Handles 'Existing', 'Exisitng' (typo in source), and year values like '2025'.
function parseOriginYear(raw) {
  const norm = (raw || '').trim().toLowerCase();
  if (norm === 'existing' || norm === 'exisitng') {
    return { origin: 'existing', year: null };
  }
  const y = parseInt(raw, 10);
  return { origin: 'purchased', year: isNaN(y) ? null : y };
}

function clean(v) {
  const s = (v || '').trim();
  return s === '' || s === '<unknown>' ? null : s;
}

// ── Insert with idempotency check ─────────────────────────────────────────────
async function insertPlant(db, plant) {
  const existing = await get(db,
    `SELECT id FROM plants
     WHERE garden_id = ?
       AND zone_id   = ?
       AND LOWER(name) = LOWER(?)
       AND LOWER(IFNULL(species, '')) = LOWER(IFNULL(?, ''))`,
    [plant.garden_id, plant.zone_id, plant.name, plant.species]
  );
  if (existing) return false;

  await run(db,
    `INSERT INTO plants
       (garden_id, zone_id, name, species, scientific_name,
        origin, year, quantity, quantity_in_ground, status,
        label_tag, label_printed)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'established', ?, ?)`,
    [
      plant.garden_id, plant.zone_id,
      plant.name, plant.species, plant.scientific_name,
      plant.origin, plant.year,
      plant.label_tag, plant.label_printed,
    ]
  );
  return true;
}

// ── Import one CSV file ───────────────────────────────────────────────────────
// subGardenMap: null for single-zone CSVs, or an object keyed by lowercased
//   Sub-Garden value, e.g. { 'shade': { garden_id:3, zone_id:10 }, "joanne's": {...} }
async function importFile(db, filepath, defaultGardenId, defaultZoneId, subGardenMap) {
  const rows = parseCsv(filepath);
  let inserted = 0, skipped = 0, blank = 0;

  for (const row of rows) {
    let name, species, scientific_name, tag_raw, label_raw, year_raw;
    let garden_id = defaultGardenId;
    let zone_id   = defaultZoneId;

    if (subGardenMap) {
      const sub = (row['Sub-Garden'] || '').trim();
      name            = row['Name'];
      species         = row['Species'];
      scientific_name = row['Scientific name'];
      tag_raw         = row['Tag #'];
      label_raw       = row['Label'];
      year_raw        = row['Year Planted'];

      if (!name || !name.trim()) { blank++; continue; }

      const mapping = subGardenMap[sub.toLowerCase()];
      if (!mapping) {
        console.warn(`  Skipped — unknown Sub-Garden: "${sub}"`);
        skipped++;
        continue;
      }
      garden_id = mapping.garden_id;
      zone_id   = mapping.zone_id;
    } else {
      name            = row['Name'];
      species         = row['Species'];
      scientific_name = row['Scientific name'];
      tag_raw         = row['Tag #'];
      label_raw       = row['Label'];
      year_raw        = row['Year Planted'];

      if (!name || !name.trim()) { blank++; continue; }
    }

    const plantName = clean(name);
    if (!plantName) { blank++; continue; }

    const { origin, year } = parseOriginYear(year_raw);

    const plant = {
      garden_id,
      zone_id,
      name:            plantName,
      species:         clean(species),
      scientific_name: clean(scientific_name),
      origin,
      year,
      label_tag:       parseTag(tag_raw),
      label_printed:   parseLabelPrinted(label_raw),
    };

    const wasInserted = await insertPlant(db, plant);
    if (wasInserted) inserted++;
    else skipped++;
  }

  console.log(`  ${path.basename(filepath)}: ${inserted} inserted, ${skipped} skipped, ${blank} blank rows ignored`);
  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const csvDir = resolveCsvDir();
  const dbPath = resolveDbPath();

  console.log(`[import-2025-plants] DB:      ${dbPath}`);
  console.log(`[import-2025-plants] CSV dir: ${csvDir}\n`);

  const db = new sqlite3.Database(dbPath);
  let total = 0;

  await new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        const check = await get(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='gardens'`);
        if (!check) throw new Error('gardens table not found — run v2-migrate.js first');
        console.log('[import-2025-plants] gardens table confirmed ✓\n');

        total += await importFile(
          db,
          path.join(csvDir, '142 Plain Road - Garden Inventory - Front.csv'),
          2, 6, null
        );

        total += await importFile(
          db,
          path.join(csvDir, '142 Plain Road - Garden Inventory - Peachtree.csv'),
          1, 1, null
        );

        total += await importFile(
          db,
          path.join(csvDir, '142 Plain Road - Garden Inventory - Rear Gardens.csv'),
          3, null,
          {
            'shade':     { garden_id: 3, zone_id: 10 },
            "joanne's":  { garden_id: 3, zone_id: 8  },
          }
        );

        total += await importFile(
          db,
          path.join(csvDir, '142 Plain Road - Garden Inventory - Vegetable.csv'),
          1, 4, null
        );

        console.log(`\n[import-2025-plants] ✓ Import complete — ${total} plants inserted`);
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  db.close();
}

main().catch(err => {
  console.error('[import-2025-plants] FAILED:', err.message);
  process.exit(1);
});
