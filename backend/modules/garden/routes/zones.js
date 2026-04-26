/**
 * Zone routes
 * GET   /gardens/:gardenId/zones   — zones for a garden (with plant counts + hero photo)
 * GET   /zones/:id                 — single zone with plants summary
 * PATCH /zones/:id                 — update notes / description
 * GET   /zones/:id/photos          — all photos for a zone
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const EDITABLE_FIELDS = new Set([
  'name', 'zone_letter', 'zone_number', 'light', 'description', 'notes', 'hero_photo_id',
]);

// ── GET /gardens/:gardenId/zones ──────────────────────────────────────────────
router.get('/gardens/:gardenId/zones', async (req, res) => {
  try {
    const garden = await db.get(`SELECT id FROM gardens WHERE id = ?`, [req.params.gardenId]);
    if (!garden) return res.status(404).json({ error: 'Garden not found' });

    const zones = await db.all(`
      SELECT z.*,
             COUNT(p.id)   AS plant_count,
             zp.filename   AS hero_photo_filename
        FROM zones z
        LEFT JOIN plants     p  ON p.zone_id = z.id
        LEFT JOIN zone_photos zp ON zp.id = z.hero_photo_id
       WHERE z.garden_id = ?
       GROUP BY z.id
       ORDER BY z.zone_number NULLS LAST, z.name
    `, [req.params.gardenId]);

    res.json({ zones });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /zones/:id ────────────────────────────────────────────────────────────
router.get('/zones/:id', async (req, res) => {
  try {
    const zone = await db.get(`
      SELECT z.*, g.name AS garden_name, g.slug AS garden_slug
        FROM zones z
        JOIN gardens g ON g.id = z.garden_id
       WHERE z.id = ?
    `, [req.params.id]);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const plants = await db.all(`
      SELECT id, name, species, plant_type, status, label_tag, quantity, quantity_in_ground
        FROM plants
       WHERE zone_id = ?
       ORDER BY status, name
    `, [req.params.id]);

    const photos = await db.all(`
      SELECT * FROM zone_photos WHERE zone_id = ? ORDER BY is_hero DESC, position ASC
    `, [req.params.id]);

    res.json({ zone: { ...zone, plants, photos } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /zones/:id ──────────────────────────────────────────────────────────
router.patch('/zones/:id', async (req, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => EDITABLE_FIELDS.has(k))
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    const result = await db.run(`UPDATE zones SET ${cols} WHERE id = ?`, values);

    if (result.changes === 0) return res.status(404).json({ error: 'Zone not found' });

    const zone = await db.get(`SELECT * FROM zones WHERE id = ?`, [req.params.id]);
    res.json({ zone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /zones/:id/photos ─────────────────────────────────────────────────────
router.get('/zones/:id/photos', async (req, res) => {
  try {
    const zone = await db.get(`SELECT id FROM zones WHERE id = ?`, [req.params.id]);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const photos = await db.all(`
      SELECT * FROM zone_photos WHERE zone_id = ? ORDER BY is_hero DESC, position ASC
    `, [req.params.id]);

    res.json({ photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
