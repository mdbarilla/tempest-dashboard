/**
 * Garden routes
 * GET   /gardens              — list all gardens with zone/plant counts
 * GET   /gardens/:id          — single garden with its zones
 * PATCH /gardens/:id          — update notes / description fields
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const EDITABLE_FIELDS = new Set([
  'name', 'description', 'orientation', 'light_conditions', 'notes',
]);

// ── GET /gardens ──────────────────────────────────────────────────────────────
router.get('/gardens', async (req, res) => {
  try {
    const gardens = await db.all(`
      SELECT g.*,
             COUNT(DISTINCT z.id)  AS zone_count,
             COUNT(DISTINCT p.id)  AS plant_count
        FROM gardens g
        LEFT JOIN zones  z ON z.garden_id = g.id
        LEFT JOIN plants p ON p.garden_id = g.id
       GROUP BY g.id
       ORDER BY g.name
    `);
    res.json({ gardens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /gardens/:id ──────────────────────────────────────────────────────────
router.get('/gardens/:id', async (req, res) => {
  try {
    const garden = await db.get(
      `SELECT * FROM gardens WHERE id = ?`, [req.params.id]
    );
    if (!garden) return res.status(404).json({ error: 'Garden not found' });

    const zones = await db.all(`
      SELECT z.*,
             COUNT(p.id)  AS plant_count,
             zp.filename  AS hero_photo_filename
        FROM zones z
        LEFT JOIN plants     p  ON p.zone_id = z.id
        LEFT JOIN zone_photos zp ON zp.id = z.hero_photo_id
       WHERE z.garden_id = ?
       GROUP BY z.id
       ORDER BY z.zone_number NULLS LAST, z.name
    `, [req.params.id]);

    res.json({ garden: { ...garden, zones } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /gardens/:id ────────────────────────────────────────────────────────
router.patch('/gardens/:id', async (req, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => EDITABLE_FIELDS.has(k))
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    const result = await db.run(`UPDATE gardens SET ${cols} WHERE id = ?`, values);

    if (result.changes === 0) return res.status(404).json({ error: 'Garden not found' });

    const garden = await db.get(`SELECT * FROM gardens WHERE id = ?`, [req.params.id]);
    res.json({ garden });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
