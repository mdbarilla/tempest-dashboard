/**
 * Garden API — seeds and plantings
 * GET  /api/garden/seeds
 * GET  /api/garden/seeds/:id
 * POST /api/garden/seeds/:id/plantings
 * GET  /api/garden/whats-growing
 * GET  /api/garden/images/* — serve seed_images from Garden project
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const gardenDb = require('../services/gardenDb');

// Resolve seed_images path from GARDEN_DB_PATH (e.g. .../Garden/data/garden.db -> .../Garden/seed_images)
function getSeedImagesDir() {
  const dbPath = process.env.GARDEN_DB_PATH || path.join(__dirname, '../data/garden.db');
  return path.join(path.dirname(path.dirname(dbPath)), 'seed_images');
}

// Whitelist for ORDER BY (safe from injection)
const SORT_COLUMNS = {
  date: 'last_planted',
  alphabetical: 'variety_name',
  type: 'type',
  brand: 'brand_source',
  planting_timing: 'planting_timing',
  purchase_period: 'purchase_period'
};
const VALID_SORT = new Set(Object.keys(SORT_COLUMNS));

/**
 * GET /api/garden/seeds
 * List seeds with optional sort and group.
 * Query: sort (date|alphabetical|type|planting_timing|purchase_period), group (planting_timing|purchase_period|type), limit
 */
router.get('/seeds', async (req, res) => {
  try {
    const sort = req.query.sort || 'date';
    const group = req.query.group || null;
    const limit = parseInt(req.query.limit, 10) || 500;

    const sortCol = VALID_SORT.has(sort) ? SORT_COLUMNS[sort] : 'last_planted';
    const sortOrder = sortCol === 'variety_name' ? 'ASC' : 'DESC';

    // SQLite: NULLs first for DESC; use CASE to put null last when sorting by date
    const nullsLast = sortCol === 'last_planted' ? 'CASE WHEN last_planted IS NULL THEN 1 ELSE 0 END, ' : '';
    const sql = `
      SELECT s.*,
        (SELECT MAX(p.date_planted) FROM plantings p WHERE p.seed_id = s.id) as last_planted,
        (SELECT SUM(p.amount) FROM plantings p WHERE p.seed_id = s.id) as total_planted
      FROM seeds s
      ORDER BY ${nullsLast}${sortCol} ${sortOrder}, s.variety_name ASC
      LIMIT ?
    `;

    const seeds = await gardenDb.all(sql, [limit]);

    if (group && SORT_COLUMNS[group]) {
      const groups = {};
      for (const seed of seeds) {
        const key = seed[group] || 'Other';
        if (!groups[key]) groups[key] = [];
        groups[key].push(seed);
      }
      return res.json({ success: true, data: { grouped: groups, seeds } });
    }

    res.json({ success: true, data: seeds });
  } catch (err) {
    console.error('GET /api/garden/seeds', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/garden/seeds/:id
 * Seed detail with plantings.
 */
router.get('/seeds/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid seed id' });
    }

    const seed = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [id]);
    if (!seed) {
      return res.status(404).json({ success: false, error: 'Seed not found' });
    }

    const plantings = await gardenDb.all(
      'SELECT * FROM plantings WHERE seed_id = ? ORDER BY date_planted DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...seed,
        plantings
      }
    });
  } catch (err) {
    console.error('GET /api/garden/seeds/:id', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/garden/seeds/:id/plantings
 * Add a planting record.
 * Body: { date_planted, amount, notes }
 */
router.post('/seeds/:id/plantings', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid seed id' });
    }

    const { date_planted, amount, notes } = req.body || {};
    if (!date_planted) {
      return res.status(400).json({ success: false, error: 'date_planted is required' });
    }
    if (amount == null || amount === '' || isNaN(parseInt(amount, 10))) {
      return res.status(400).json({ success: false, error: 'amount (number planted) is required' });
    }

    const seed = await gardenDb.get('SELECT id FROM seeds WHERE id = ?', [id]);
    if (!seed) {
      return res.status(404).json({ success: false, error: 'Seed not found' });
    }

    const amt = parseInt(amount, 10);
    const result = await gardenDb.run(
      'INSERT INTO plantings (seed_id, date_planted, amount, notes) VALUES (?, ?, ?, ?)',
      [id, date_planted, amt, notes || null]
    );

    const row = await gardenDb.get('SELECT * FROM plantings WHERE id = ?', [result.id]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('POST /api/garden/seeds/:id/plantings', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/garden/plantings/:id
 * Update a planting record.
 * Body: { date_planted?, amount?, notes? }
 */
router.patch('/plantings/:id', async (req, res) => {
  try {
    const plantingId = parseInt(req.params.id, 10);
    if (isNaN(plantingId)) {
      return res.status(400).json({ success: false, error: 'Invalid planting id' });
    }

    const existing = await gardenDb.get('SELECT * FROM plantings WHERE id = ?', [plantingId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Planting not found' });
    }

    const { date_planted, amount, notes } = req.body || {};
    const updates = [];
    const params = [];

    if (date_planted !== undefined) {
      updates.push('date_planted = ?');
      params.push(date_planted);
    }
    if (amount !== undefined) {
      const amt = parseInt(amount, 10);
      if (isNaN(amt) || amt < 0) {
        return res.status(400).json({ success: false, error: 'amount must be a positive number' });
      }
      updates.push('amount = ?');
      params.push(amt);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.json({ success: true, data: existing });
    }

    params.push(plantingId);
    await gardenDb.run(
      `UPDATE plantings SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const row = await gardenDb.get('SELECT * FROM plantings WHERE id = ?', [plantingId]);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('PATCH /api/garden/plantings/:id', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/garden/plantings/:id
 * Delete a planting record.
 */
router.delete('/plantings/:id', async (req, res) => {
  try {
    const plantingId = parseInt(req.params.id, 10);
    if (isNaN(plantingId)) {
      return res.status(400).json({ success: false, error: 'Invalid planting id' });
    }

    const existing = await gardenDb.get('SELECT * FROM plantings WHERE id = ?', [plantingId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Planting not found' });
    }

    await gardenDb.run('DELETE FROM plantings WHERE id = ?', [plantingId]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('DELETE /api/garden/plantings/:id', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/garden/whats-growing
 * Subset for "What's Growing" — seeds with recent plantings or by planting timing.
 * Returns seeds with thumbnails for the dashboard widget.
 */
router.get('/whats-growing', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 12;

    const sql = `
      SELECT s.id, s.variety_name, s.type, s.image_path, s.planting_timing, s.catalog_url,
        MAX(p.date_planted) as last_planted
      FROM seeds s
      LEFT JOIN plantings p ON p.seed_id = s.id
      WHERE s.image_path IS NOT NULL
      GROUP BY s.id
      ORDER BY CASE WHEN last_planted IS NULL THEN 1 ELSE 0 END, last_planted DESC, s.planting_timing ASC, s.variety_name ASC
      LIMIT ?
    `;

    const seeds = await gardenDb.all(sql, [limit]);
    res.json({ success: true, data: seeds });
  } catch (err) {
    console.error('GET /api/garden/whats-growing', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/garden/images/*
 * Serve seed images from Garden/seed_images. Path is e.g. vegetables/tomato/tomato-honeycomb.jpg
 */
router.get(/\/images\/(.+)/, (req, res) => {
  const m = req.originalUrl.match(/\/images\/(.+?)(?:\?|$)/);
  const relPath = m ? decodeURIComponent(m[1]) : '';
  if (!relPath || relPath.includes('..')) {
    return res.status(400).send('Invalid path');
  }
  const base = getSeedImagesDir();
  const fullPath = path.join(base, relPath);
  const exists = fs.existsSync(fullPath);
  const isFile = exists && fs.statSync(fullPath).isFile();
  if (!fullPath.startsWith(path.resolve(base))) {
    return res.status(403).send('Forbidden');
  }
  if (!exists || !isFile) {
    return res.status(404).send('Not found');
  }
  // Read into buffer before sending—iCloud Drive may stream placeholders and cause
  // img decode failures; buffering forces full content to be available.
  try {
    const buf = fs.readFileSync(fullPath);
    // Some files have .jpg extension but are actually SVG (wrong content-type breaks img decode)
    const start = buf.slice(0, 1024).toString('utf8', 0, Math.min(1024, buf.length));
    const isSvg = /^\s*<\?xml/i.test(start) || /^\s*<svg/i.test(start);
    const ext = path.extname(relPath).toLowerCase();
    const mime = isSvg ? 'image/svg+xml'
      : ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    res.type(mime).send(buf);
  } catch (err) {
    console.error('Error serving seed image:', relPath, err.message);
    res.status(500).send('Error loading image');
  }
});

module.exports = router;
