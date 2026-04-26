/**
 * Plant routes
 * GET  /plants                     — list with filters: ?garden_id, ?zone_id, ?status, ?type, ?q
 * GET  /plants/:id                 — single plant with activities
 * POST /plants                     — create plant
 * PATCH /plants/:id                — update plant fields
 * GET  /plants/:id/activities      — activity log for a plant
 * POST /plants/:id/activities      — add activity
 * PATCH /plant-activities/:id      — update activity
 * DELETE /plant-activities/:id     — delete activity
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const PLANT_EDITABLE_FIELDS = new Set([
  'name', 'species', 'scientific_name', 'plant_type', 'origin', 'year',
  'quantity', 'quantity_in_ground', 'status', 'label_tag', 'label_printed',
  'source', 'cost_per_unit', 'planted_date', 'estimated_age_years',
  'bloom_time', 'light_needs', 'water_needs', 'deer_resistant', 'native',
  'notes', 'zone_id', 'seed_id',
]);

const ACTIVITY_EDITABLE_FIELDS = new Set([
  'type', 'occurred_at', 'notes',
]);

// Valid plant statuses
const VALID_STATUSES = new Set(['planned', 'purchased', 'planted', 'established', 'removed']);

// ── GET /plants ───────────────────────────────────────────────────────────────
router.get('/plants', async (req, res) => {
  try {
    const { garden_id, zone_id, status, type, q } = req.query;

    const conditions = [];
    const params     = [];

    if (garden_id) { conditions.push('p.garden_id = ?'); params.push(garden_id); }
    if (zone_id)   { conditions.push('p.zone_id = ?');   params.push(zone_id); }
    if (status)    {
      const statuses = status.split(',').filter(s => VALID_STATUSES.has(s));
      if (statuses.length) {
        conditions.push(`p.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (type) { conditions.push('p.plant_type = ?'); params.push(type); }
    if (q)    {
      conditions.push('(p.name LIKE ? OR p.species LIKE ? OR p.notes LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const plants = await db.all(`
      SELECT p.*,
             g.name  AS garden_name,
             g.slug  AS garden_slug,
             z.name  AS zone_name,
             s.variety_name AS seed_variety_name
        FROM plants p
        LEFT JOIN gardens g ON g.id = p.garden_id
        LEFT JOIN zones   z ON z.id = p.zone_id
        LEFT JOIN seeds   s ON s.id = p.seed_id
       ${where}
       ORDER BY p.status, p.name
    `, params);

    res.json({ plants, count: plants.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /plants/:id ───────────────────────────────────────────────────────────
router.get('/plants/:id', async (req, res) => {
  try {
    const plant = await db.get(`
      SELECT p.*,
             g.name  AS garden_name,
             g.slug  AS garden_slug,
             z.name  AS zone_name,
             s.variety_name AS seed_variety_name
        FROM plants p
        LEFT JOIN gardens g ON g.id = p.garden_id
        LEFT JOIN zones   z ON z.id = p.zone_id
        LEFT JOIN seeds   s ON s.id = p.seed_id
       WHERE p.id = ?
    `, [req.params.id]);

    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    const activities = await db.all(
      `SELECT * FROM plant_activities WHERE plant_id = ? ORDER BY occurred_at DESC`,
      [req.params.id]
    );

    res.json({ plant: { ...plant, activities } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /plants ──────────────────────────────────────────────────────────────
router.post('/plants', async (req, res) => {
  try {
    const { garden_id, zone_id, name, plant_type, status } = req.body;

    if (!garden_id) return res.status(400).json({ error: 'garden_id required' });
    if (!name)      return res.status(400).json({ error: 'name required' });

    const garden = await db.get(`SELECT id FROM gardens WHERE id = ?`, [garden_id]);
    if (!garden) return res.status(400).json({ error: 'garden_id does not exist' });

    const result = await db.run(`
      INSERT INTO plants (garden_id, zone_id, name, plant_type, status)
      VALUES (?, ?, ?, ?, ?)
    `, [
      garden_id,
      zone_id || null,
      name,
      plant_type || null,
      (status && VALID_STATUSES.has(status)) ? status : 'planned',
    ]);

    const plant = await db.get(`SELECT * FROM plants WHERE id = ?`, [result.id]);
    res.status(201).json({ plant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /plants/:id ─────────────────────────────────────────────────────────
router.patch('/plants/:id', async (req, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => PLANT_EDITABLE_FIELDS.has(k))
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }
    if (updates.status && !VALID_STATUSES.has(updates.status)) {
      return res.status(400).json({ error: `Invalid status. Valid: ${[...VALID_STATUSES].join(', ')}` });
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    const result = await db.run(`UPDATE plants SET ${cols} WHERE id = ?`, values);

    if (result.changes === 0) return res.status(404).json({ error: 'Plant not found' });

    const plant = await db.get(`SELECT * FROM plants WHERE id = ?`, [req.params.id]);
    res.json({ plant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /plants/:id/activities ────────────────────────────────────────────────
router.get('/plants/:id/activities', async (req, res) => {
  try {
    const plant = await db.get(`SELECT id FROM plants WHERE id = ?`, [req.params.id]);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    const activities = await db.all(
      `SELECT * FROM plant_activities WHERE plant_id = ? ORDER BY occurred_at DESC`,
      [req.params.id]
    );
    res.json({ activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /plants/:id/activities ───────────────────────────────────────────────
router.post('/plants/:id/activities', async (req, res) => {
  try {
    const plant = await db.get(`SELECT id FROM plants WHERE id = ?`, [req.params.id]);
    if (!plant) return res.status(404).json({ error: 'Plant not found' });

    const { type, occurred_at, notes } = req.body;
    if (!type)        return res.status(400).json({ error: 'type required' });
    if (!occurred_at) return res.status(400).json({ error: 'occurred_at required' });

    const result = await db.run(
      `INSERT INTO plant_activities (plant_id, type, occurred_at, notes) VALUES (?, ?, ?, ?)`,
      [req.params.id, type, occurred_at, notes || null]
    );
    const activity = await db.get(
      `SELECT * FROM plant_activities WHERE id = ?`, [result.id]
    );
    res.status(201).json({ activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /plant-activities/:id ───────────────────────────────────────────────
router.patch('/plant-activities/:id', async (req, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ACTIVITY_EDITABLE_FIELDS.has(k))
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    const result = await db.run(
      `UPDATE plant_activities SET ${cols} WHERE id = ?`, values
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });

    const activity = await db.get(
      `SELECT * FROM plant_activities WHERE id = ?`, [req.params.id]
    );
    res.json({ activity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /plant-activities/:id ──────────────────────────────────────────────
router.delete('/plant-activities/:id', async (req, res) => {
  try {
    const result = await db.run(
      `DELETE FROM plant_activities WHERE id = ?`, [req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
