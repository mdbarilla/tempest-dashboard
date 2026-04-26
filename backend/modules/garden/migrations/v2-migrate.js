/**
 * Garden v2 migration
 * Creates new tables: gardens, zones, plants, plant_activities, tasks, sourcing_items, zone_photos
 * Seeds reference data from garden-seed-data.json
 *
 * Run: node modules/garden/migrations/v2-migrate.js
 *
 * Idempotent — safe to re-run. Uses INSERT OR IGNORE on all seed data.
 * On Pi: copy garden-seed-data.json into this directory before running.
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// ── Resolve seed data JSON ────────────────────────────────────────────────────
// Looks alongside this script first (Pi-friendly), then dev path
const LOCAL_JSON = path.join(__dirname, 'garden-seed-data.json');
const DEV_JSON   = path.resolve(__dirname, '../../../../../Garden/planning/v2-plan/garden-seed-data.json');

function resolveSeedDataPath() {
  if (fs.existsSync(LOCAL_JSON)) return LOCAL_JSON;
  if (fs.existsSync(DEV_JSON)) return DEV_JSON;
  throw new Error(
    `garden-seed-data.json not found.\n` +
    `Tried:\n  ${LOCAL_JSON}\n  ${DEV_JSON}\n` +
    `Copy it into: ${__dirname}`
  );
}

// ── Resolve DB path ───────────────────────────────────────────────────────────
const DEFAULT_DB     = path.join(__dirname, '../../../data/garden.db');
const DEPLOY_DB      = path.resolve(__dirname, '../../../../garden-data/data/garden.db');
const CONFIGURED_DB  = process.env.GARDEN_DB_PATH ? String(process.env.GARDEN_DB_PATH).trim() : null;

function resolveDbPath() {
  if (CONFIGURED_DB && fs.existsSync(CONFIGURED_DB)) return CONFIGURED_DB;
  if (fs.existsSync(DEPLOY_DB)) return DEPLOY_DB;
  if (fs.existsSync(DEFAULT_DB)) return DEFAULT_DB;
  // If none exist yet, prefer deploy location if directory exists; else default
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  const seedDataPath = resolveSeedDataPath();
  const dbPath = resolveDbPath();

  console.log(`[v2-migrate] DB:        ${dbPath}`);
  console.log(`[v2-migrate] Seed data: ${seedDataPath}`);

  // Ensure DB directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const data = JSON.parse(fs.readFileSync(seedDataPath, 'utf8'));
  const db = new sqlite3.Database(dbPath);

  await new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // ── Verify existing seeds table ─────────────────────────────────────
        const seedsCheck = await get(db, `SELECT name FROM sqlite_master WHERE type='table' AND name='seeds'`);
        if (!seedsCheck) {
          throw new Error('seeds table not found — is this the right database? Run the server once first to initialize the v1 schema.');
        }
        console.log('[v2-migrate] seeds table confirmed ✓');

        // ── Create new tables ───────────────────────────────────────────────
        await run(db, `
          CREATE TABLE IF NOT EXISTS gardens (
            id              INTEGER PRIMARY KEY,
            name            TEXT NOT NULL,
            slug            TEXT UNIQUE NOT NULL,
            description     TEXT,
            orientation     TEXT,
            light_conditions TEXT,
            notes           TEXT,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[v2-migrate] gardens table ready');

        await run(db, `
          CREATE TABLE IF NOT EXISTS zones (
            id              INTEGER PRIMARY KEY,
            garden_id       INTEGER NOT NULL REFERENCES gardens(id),
            name            TEXT NOT NULL,
            zone_letter     TEXT,
            zone_number     INTEGER,
            light           TEXT,
            description     TEXT,
            notes           TEXT,
            hero_photo_id   INTEGER
          )
        `);
        console.log('[v2-migrate] zones table ready');

        await run(db, `
          CREATE TABLE IF NOT EXISTS zone_photos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_id     INTEGER NOT NULL REFERENCES zones(id),
            filename    TEXT NOT NULL,
            taken_date  DATE,
            season      TEXT,
            position    INTEGER DEFAULT 1,
            is_hero     BOOLEAN DEFAULT 0,
            caption     TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[v2-migrate] zone_photos table ready');

        await run(db, `
          CREATE TABLE IF NOT EXISTS plants (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            garden_id           INTEGER NOT NULL REFERENCES gardens(id),
            zone_id             INTEGER REFERENCES zones(id),
            seed_id             INTEGER REFERENCES seeds(id),
            name                TEXT NOT NULL,
            species             TEXT,
            scientific_name     TEXT,
            plant_type          TEXT,
            origin              TEXT,
            year                INTEGER,
            quantity            INTEGER DEFAULT 1,
            quantity_in_ground  INTEGER DEFAULT 0,
            status              TEXT DEFAULT 'planned',
            label_tag           INTEGER,
            label_printed       BOOLEAN DEFAULT 0,
            source              TEXT,
            cost_per_unit       DECIMAL,
            planted_date        DATE,
            estimated_age_years INTEGER,
            bloom_time          TEXT,
            light_needs         TEXT,
            water_needs         TEXT,
            deer_resistant      BOOLEAN,
            native              BOOLEAN,
            notes               TEXT,
            created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[v2-migrate] plants table ready');

        await run(db, `
          CREATE TABLE IF NOT EXISTS plant_activities (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            plant_id    INTEGER NOT NULL REFERENCES plants(id),
            type        TEXT NOT NULL,
            occurred_at DATE NOT NULL,
            notes       TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[v2-migrate] plant_activities table ready');

        await run(db, `
          CREATE TABLE IF NOT EXISTS tasks (
            id               INTEGER PRIMARY KEY,
            garden_id        INTEGER REFERENCES gardens(id),
            zone_id          INTEGER REFERENCES zones(id),
            title            TEXT NOT NULL,
            description      TEXT,
            category         TEXT,
            priority         TEXT DEFAULT 'soon',
            due_date         DATE,
            completed        BOOLEAN DEFAULT 0,
            completed_date   DATE,
            recurring        BOOLEAN DEFAULT 0,
            recurrence_notes TEXT,
            notes            TEXT,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[v2-migrate] tasks table ready');

        await run(db, `
          CREATE TABLE IF NOT EXISTS sourcing_items (
            id             INTEGER PRIMARY KEY,
            plant_id       INTEGER REFERENCES plants(id),
            task_id        INTEGER REFERENCES tasks(id),
            item_name      TEXT NOT NULL,
            vendor         TEXT,
            vendor_type    TEXT,
            quantity       INTEGER DEFAULT 1,
            unit           TEXT,
            estimated_cost DECIMAL,
            actual_cost    DECIMAL,
            status         TEXT DEFAULT 'researching',
            priority       TEXT DEFAULT 'soon',
            url            TEXT,
            notes          TEXT,
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('[v2-migrate] sourcing_items table ready');

        // ── Indexes ─────────────────────────────────────────────────────────
        await run(db, `CREATE INDEX IF NOT EXISTS idx_zones_garden_id ON zones(garden_id)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_plants_garden_id ON plants(garden_id)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_plants_zone_id ON plants(zone_id)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_plants_seed_id ON plants(seed_id)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_plants_status ON plants(status)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_plant_activities_plant_id ON plant_activities(plant_id)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_tasks_garden_id ON tasks(garden_id)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_sourcing_status ON sourcing_items(status)`);
        await run(db, `CREATE INDEX IF NOT EXISTS idx_zone_photos_zone_id ON zone_photos(zone_id)`);
        console.log('[v2-migrate] indexes ready');

        // ── Seed gardens ─────────────────────────────────────────────────────
        let gardensInserted = 0;
        for (const g of data.gardens) {
          const r = await run(db,
            `INSERT OR IGNORE INTO gardens (id, name, slug, description, orientation, light_conditions, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [g.id, g.name, g.slug, g.description || null, g.orientation || null,
             g.light_conditions || null, g.notes || null]
          );
          if (r.changes > 0) gardensInserted++;
        }
        console.log(`[v2-migrate] gardens: ${gardensInserted} inserted, ${data.gardens.length - gardensInserted} already existed`);

        // ── Seed zones ───────────────────────────────────────────────────────
        let zonesInserted = 0;
        for (const z of data.zones) {
          const r = await run(db,
            `INSERT OR IGNORE INTO zones (id, garden_id, name, zone_letter, zone_number, light, description, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [z.id, z.garden_id, z.name, z.zone_letter || null, z.zone_number || null,
             z.light || null, z.description || null, z.notes || null]
          );
          if (r.changes > 0) zonesInserted++;
        }
        console.log(`[v2-migrate] zones: ${zonesInserted} inserted, ${data.zones.length - zonesInserted} already existed`);

        // ── Seed plants ──────────────────────────────────────────────────────
        // Note: plants use explicit IDs from JSON to avoid FK mismatches with sourcing_items
        let plantsInserted = 0;
        for (const p of data.plants) {
          // Check if this ID already exists (INSERT OR IGNORE won't work with AUTOINCREMENT + explicit ID)
          const existing = await get(db, `SELECT id FROM plants WHERE id = ?`, [p.id]);
          if (existing) continue;

          await run(db,
            `INSERT INTO plants (
               id, garden_id, zone_id, seed_id, name, species, scientific_name,
               plant_type, origin, year, quantity, quantity_in_ground, status,
               label_tag, label_printed, source, cost_per_unit,
               bloom_time, light_needs, deer_resistant, native, notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id, p.garden_id, p.zone_id || null, p.seed_id || null,
              p.name, p.species || null, p.scientific_name || null,
              p.plant_type || null, p.origin || null, p.year || null,
              p.quantity || 1, p.quantity_in_ground || 0, p.status || 'planned',
              p.label_tag || null, p.label_printed ? 1 : 0,
              p.source || null, p.cost_per_unit || null,
              p.bloom_time || null, p.light_needs || null,
              p.deer_resistant ? 1 : 0, p.native ? 1 : 0,
              p.notes || null
            ]
          );
          plantsInserted++;
        }
        console.log(`[v2-migrate] plants: ${plantsInserted} inserted, ${data.plants.length - plantsInserted} already existed`);

        // ── Seed tasks ───────────────────────────────────────────────────────
        let tasksInserted = 0;
        for (const t of data.tasks) {
          const r = await run(db,
            `INSERT OR IGNORE INTO tasks (
               id, garden_id, zone_id, title, description, category, priority,
               due_date, completed, recurring, recurrence_notes, notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              t.id, t.garden_id || null, t.zone_id || null,
              t.title, t.description || null, t.category || null,
              t.priority || 'soon', t.due_date || null,
              t.completed ? 1 : 0, t.recurring ? 1 : 0,
              t.recurrence_notes || null, t.notes || null
            ]
          );
          if (r.changes > 0) tasksInserted++;
        }
        console.log(`[v2-migrate] tasks: ${tasksInserted} inserted, ${data.tasks.length - tasksInserted} already existed`);

        // ── Seed sourcing items ──────────────────────────────────────────────
        let sourcingInserted = 0;
        for (const s of data.sourcing_items) {
          const r = await run(db,
            `INSERT OR IGNORE INTO sourcing_items (
               id, plant_id, task_id, item_name, vendor, vendor_type,
               quantity, unit, estimated_cost, status, priority, url, notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id, s.plant_id || null, s.task_id || null,
              s.item_name, s.vendor || null, s.vendor_type || null,
              s.quantity || 1, s.unit || null,
              s.estimated_cost || null, s.status || 'researching',
              s.priority || 'soon', s.url || null, s.notes || null
            ]
          );
          if (r.changes > 0) sourcingInserted++;
        }
        console.log(`[v2-migrate] sourcing_items: ${sourcingInserted} inserted, ${data.sourcing_items.length - sourcingInserted} already existed`);

        console.log('\n[v2-migrate] ✓ Migration complete');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });

  db.close();
}

migrate().catch((err) => {
  console.error('[v2-migrate] FAILED:', err.message);
  process.exit(1);
});
