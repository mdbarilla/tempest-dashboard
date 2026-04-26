/**
 * Garden API — seeds and plantings
 * GET    /api/garden/seeds
 * GET    /api/garden/seeds/:id
 * PATCH  /api/garden/seeds/:id
 * POST   /api/garden/seeds/:id/plantings
 * PATCH  /api/garden/plantings/:id
 * DELETE /api/garden/plantings/:id
 * GET    /api/garden/whats-growing
 * GET    /api/garden/images/* — serve seed_images from Garden project
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const router = express.Router();
const gardenDb = require('../services/gardenDb');

// Deployment-relative seed_images — same logic as gardenDb.js DEPLOY_GARDEN_DB
const DEPLOY_IMAGES_DIR = path.resolve(__dirname, '../../garden-data/seed_images');

// Resolve seed_images path. Priority:
//  1. Explicit GARDEN_IMAGES_PATH env var
//  2. GARDEN_DB_PATH — derive seed_images as sibling of data/ (works for Pi and Mac)
//  3. Deployment-relative ../../garden-data/seed_images
function getSeedImagesDir() {
  if (process.env.GARDEN_IMAGES_PATH) return process.env.GARDEN_IMAGES_PATH;

  const dbPath = process.env.GARDEN_DB_PATH;
  if (dbPath) {
    return path.join(path.dirname(path.dirname(dbPath)), 'seed_images');
  }

  if (fs.existsSync(DEPLOY_IMAGES_DIR)) return DEPLOY_IMAGES_DIR;
  return path.join(__dirname, '../data/seed_images');
}

// Whitelist for ORDER BY (safe from injection)
const SORT_COLUMNS = {
  date: 'last_planted',
  alphabetical: 'variety_name',
  type: 'type',
  brand: 'brand_source',
  planting_timing: 'effective_planting_timing',
  purchase_period: 'purchase_period',
  plant_status: 'last_planted'
};
const VALID_SORT = new Set(Object.keys(SORT_COLUMNS));

// Fields that are allowed to be updated via PATCH /seeds/:id
const SEED_EDITABLE_FIELDS = new Set([
  'variety_name',
  'type',
  'purchase_period',
  'product_url',
  'catalog_url',
  'brand_source',
  'indoor_outdoor',
  'indoor_instructions',
  'outdoor_instructions',
  'recommended_method',
  'description',
  'planting_instructions',
  'notes_tips',
  'active_year',
  'url_status',
  'url_verified_at',
  'soil_type',
  'container_type',
  'year_decision',
  'indoor_planting_timing',
  'outdoor_planting_timing'
]);

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
    // total_planted and last_planted: use activities (type=planting); fallback to legacy plantings if no activities
    const nullsLast = sortCol === 'last_planted' ? 'CASE WHEN last_planted IS NULL THEN 1 ELSE 0 END, ' : '';
    const sql = `
      SELECT s.*,
        CASE
          WHEN s.year_decision = 'indoor' THEN COALESCE(s.indoor_planting_timing, s.planting_timing)
          WHEN s.year_decision = 'outdoor' THEN COALESCE(s.outdoor_planting_timing, s.planting_timing)
          ELSE COALESCE(s.indoor_planting_timing, s.outdoor_planting_timing, s.planting_timing)
        END as effective_planting_timing,
        COALESCE(
          (SELECT MAX(a.occurred_at) FROM activities a WHERE a.seed_id = s.id AND a.type = 'planting'),
          (SELECT MAX(p.date_planted) FROM plantings p WHERE p.seed_id = s.id)
        ) as last_planted,
        (SELECT COALESCE(SUM(a.amount), 0) FROM activities a WHERE a.seed_id = s.id AND a.type = 'planting')
        + (SELECT COALESCE(SUM(p.amount), 0) FROM plantings p WHERE p.seed_id = s.id) as total_planted,
        a.type              as last_activity_type,
        a.occurred_at       as last_activity_date,
        a.notes             as last_activity_notes,
        a.indoor_outdoor    as last_activity_indoor_outdoor,
        a.soil_type         as last_activity_soil,
        a.container_type    as last_activity_containers,
        a.location          as last_activity_location
      FROM seeds s
      LEFT JOIN activities a ON a.id = (
        SELECT id FROM activities
        WHERE seed_id = s.id
        ORDER BY occurred_at DESC, created_at DESC
        LIMIT 1
      )
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
    const activities = await gardenDb.all(
      'SELECT * FROM activities WHERE seed_id = ? ORDER BY occurred_at DESC, created_at DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...seed,
        plantings,
        activities
      }
    });
  } catch (err) {
    console.error('GET /api/garden/seeds/:id', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/garden/seeds
 * Create a new seed.
 * Body: variety_name (required), type?, brand_source?, product_url?, catalog_url?, description?, indoor_planting_timing?, outdoor_planting_timing?, image_url? (fetch and save image)
 */
router.post('/seeds', async (req, res) => {
  try {
    const body = req.body || {};
    const varietyName = (body.variety_name || '').trim();
    if (!varietyName) {
      return res.status(400).json({ success: false, error: 'variety_name is required' });
    }
    if (varietyName.length > 200) {
      return res.status(400).json({ success: false, error: 'variety_name too long' });
    }

    const productUrl = body.product_url || null;
    const catalogUrl = body.catalog_url || null;
    if (productUrl) {
      try { new URL(productUrl); } catch { return res.status(400).json({ success: false, error: 'product_url is not a valid URL' }); }
    }
    if (catalogUrl) {
      try { new URL(catalogUrl); } catch { return res.status(400).json({ success: false, error: 'catalog_url is not a valid URL' }); }
    }

    const currentYear = String(new Date().getFullYear());
    const result = await gardenDb.run(
      `INSERT INTO seeds (
        variety_name, type, brand_source, purchase_period, product_url, catalog_url,
        description, indoor_planting_timing, outdoor_planting_timing, active_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        varietyName,
        body.type || null,
        (body.brand_source || '').trim() || null,
        (body.purchase_period || '').trim() || null,
        productUrl,
        catalogUrl,
        (body.description || '').trim() || null,
        (body.indoor_planting_timing || '').trim() || null,
        (body.outdoor_planting_timing || '').trim() || null,
        currentYear
      ]
    );

    let seed = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [result.id]);
    const imageUrl = body.image_url;
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      try {
        const imgPath = await fetchAndSaveImage(imageUrl, result.id, varietyName);
        if (imgPath) {
          await gardenDb.run('UPDATE seeds SET image_path = ? WHERE id = ?', [imgPath, result.id]);
          seed = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [result.id]);
        }
      } catch (e) {
        console.warn('Could not fetch image from URL:', e.message);
      }
    }
    res.status(201).json({ success: true, data: { ...seed, plantings: [], activities: [] } });
  } catch (err) {
    console.error('POST /api/garden/seeds', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function fetchAndSaveImage(url, seedId, varietyName) {
  const baseDir = getSeedImagesDir();
  const customDir = path.join(baseDir, 'custom');
  if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
  const slug = varietyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || `seed-${seedId}`;
  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const safeExt = /^\.(jpg|jpeg|png|gif|webp)$/i.test(ext) ? ext : '.jpg';
  const filename = `${slug}${safeExt}`;
  const filepath = path.join(customDir, filename);

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 15000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const buf = Buffer.concat(chunks);
          fs.writeFileSync(filepath, buf);
          resolve(`custom/${filename}`);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * POST /api/garden/seeds/:id/image-from-url
 * Fetch image from URL and save to seed_images. Body: { image_url }
 */
router.post('/seeds/:id/image-from-url', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid seed id' });
    const seed = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [id]);
    if (!seed) return res.status(404).json({ success: false, error: 'Seed not found' });
    const imageUrl = req.body?.image_url;
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      return res.status(400).json({ success: false, error: 'image_url (http/https) is required' });
    }
    const imgPath = await fetchAndSaveImage(imageUrl, id, seed.variety_name);
    await gardenDb.run('UPDATE seeds SET image_path = ? WHERE id = ?', [imgPath, id]);
    const updated = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('POST /api/garden/seeds/:id/image-from-url', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/garden/seeds/:id
 * Update editable fields on a seed.
 * Body: any subset of editable fields.
 */
router.patch('/seeds/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid seed id' });
    }

    const existing = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Seed not found' });
    }

    const body = req.body || {};
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(body)) {
      if (!SEED_EDITABLE_FIELDS.has(key)) continue;

      if (key === 'variety_name') {
        const trimmed = (value || '').trim();
        if (!trimmed) return res.status(400).json({ success: false, error: 'variety_name cannot be empty' });
        if (trimmed.length > 200) return res.status(400).json({ success: false, error: 'variety_name too long' });
        updates.push('variety_name = ?');
        params.push(trimmed);
        continue;
      }

      if (key === 'product_url' || key === 'catalog_url') {
        if (value) {
          try {
            const parsed = new URL(value);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              return res.status(400).json({ success: false, error: `${key} must be an http or https URL` });
            }
          } catch {
            return res.status(400).json({ success: false, error: `${key} is not a valid URL` });
          }
        }
        updates.push(`${key} = ?`);
        params.push(value || null);
        continue;
      }

      updates.push(`${key} = ?`);
      params.push(value === '' ? null : value);
    }

    if (updates.length === 0) {
      return res.json({ success: true, data: existing });
    }

    params.push(id);
    await gardenDb.run(
      `UPDATE seeds SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const seed = await gardenDb.get('SELECT * FROM seeds WHERE id = ?', [id]);
    const plantings = await gardenDb.all(
      'SELECT * FROM plantings WHERE seed_id = ? ORDER BY date_planted DESC',
      [id]
    );
    res.json({ success: true, data: { ...seed, plantings } });
  } catch (err) {
    console.error('PATCH /api/garden/seeds/:id', err);
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
 * GET /api/garden/seeds/:id/activities
 * All activities for a seed (planting, observation, note) ordered newest first.
 */
router.get('/seeds/:id/activities', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid seed id' });
    const activities = await gardenDb.all(
      'SELECT * FROM activities WHERE seed_id = ? ORDER BY occurred_at DESC, created_at DESC',
      [id]
    );
    res.json({ success: true, data: activities });
  } catch (err) {
    console.error('GET /api/garden/seeds/:id/activities', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/garden/seeds/:id/activities
 * Add a new activity (planting, observation, or note).
 * Body: { type, occurred_at, amount?, notes? }
 */
router.post('/seeds/:id/activities', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid seed id' });

    const { type, occurred_at, amount, notes } = req.body || {};
    const VALID_TYPES = new Set(['planting', 'observation', 'note']);
    if (!type || !VALID_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: 'type must be planting, observation, or note' });
    }
    if (!occurred_at) {
      return res.status(400).json({ success: false, error: 'occurred_at is required' });
    }
    if (type === 'planting' && (amount == null || isNaN(parseInt(amount, 10)))) {
      return res.status(400).json({ success: false, error: 'amount is required for planting entries' });
    }

    const seed = await gardenDb.get('SELECT id FROM seeds WHERE id = ?', [id]);
    if (!seed) return res.status(404).json({ success: false, error: 'Seed not found' });

    const { indoor_outdoor, soil_type, container_type, location } = req.body || {};
    const amt = amount != null ? parseInt(amount, 10) : null;
    const result = await gardenDb.run(
      `INSERT INTO activities (seed_id, type, occurred_at, amount, notes, indoor_outdoor, soil_type, container_type, location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, occurred_at, amt, notes || null,
       indoor_outdoor || null, soil_type || null, container_type || null, location || null]
    );
    const row = await gardenDb.get('SELECT * FROM activities WHERE id = ?', [result.id]);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    console.error('POST /api/garden/seeds/:id/activities', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/garden/activities/:id
 * Update an activity record.
 */
router.patch('/activities/:id', async (req, res) => {
  try {
    const actId = parseInt(req.params.id, 10);
    if (isNaN(actId)) return res.status(400).json({ success: false, error: 'Invalid activity id' });

    const existing = await gardenDb.get('SELECT * FROM activities WHERE id = ?', [actId]);
    if (!existing) return res.status(404).json({ success: false, error: 'Activity not found' });

    const { occurred_at, amount, notes, indoor_outdoor, soil_type, container_type, location,
      germinated_count, germinated_at, in_ground, gifted, containers_count } = req.body || {};
    const updates = [];
    const params = [];

    if (occurred_at !== undefined) { updates.push('occurred_at = ?'); params.push(occurred_at); }
    if (amount !== undefined) {
      const amt = parseInt(amount, 10);
      if (isNaN(amt) || amt < 0) return res.status(400).json({ success: false, error: 'amount must be a positive number' });
      updates.push('amount = ?'); params.push(amt);
    }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes || null); }
    if (indoor_outdoor !== undefined) { updates.push('indoor_outdoor = ?'); params.push(indoor_outdoor || null); }
    if (soil_type !== undefined) { updates.push('soil_type = ?'); params.push(soil_type || null); }
    if (container_type !== undefined) { updates.push('container_type = ?'); params.push(container_type || null); }
    if (location !== undefined) { updates.push('location = ?'); params.push(location || null); }
    if (germinated_count !== undefined) { updates.push('germinated_count = ?'); params.push(germinated_count === '' || germinated_count == null ? null : parseInt(germinated_count, 10)); }
    if (germinated_at !== undefined) { updates.push('germinated_at = ?'); params.push(germinated_at || null); }
    if (in_ground !== undefined) { updates.push('in_ground = ?'); params.push(in_ground === '' || in_ground == null ? null : parseInt(in_ground, 10)); }
    if (gifted !== undefined) { updates.push('gifted = ?'); params.push(gifted === '' || gifted == null ? null : parseInt(gifted, 10)); }
    if (containers_count !== undefined) { updates.push('containers_count = ?'); params.push(containers_count === '' || containers_count == null ? null : parseInt(containers_count, 10)); }

    if (updates.length === 0) return res.json({ success: true, data: existing });

    params.push(actId);
    await gardenDb.run(`UPDATE activities SET ${updates.join(', ')} WHERE id = ?`, params);
    const row = await gardenDb.get('SELECT * FROM activities WHERE id = ?', [actId]);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error('PATCH /api/garden/activities/:id', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/garden/activities/:id
 * Delete an activity record.
 */
router.delete('/activities/:id', async (req, res) => {
  try {
    const actId = parseInt(req.params.id, 10);
    if (isNaN(actId)) return res.status(400).json({ success: false, error: 'Invalid activity id' });
    const existing = await gardenDb.get('SELECT * FROM activities WHERE id = ?', [actId]);
    if (!existing) return res.status(404).json({ success: false, error: 'Activity not found' });
    await gardenDb.run('DELETE FROM activities WHERE id = ?', [actId]);
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error('DELETE /api/garden/activities/:id', err);
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
      SELECT * FROM (
        SELECT s.id, s.variety_name, s.type, s.image_path, s.planting_timing, s.catalog_url,
          COALESCE(
            (SELECT MAX(a.occurred_at) FROM activities a WHERE a.seed_id = s.id AND a.type = 'planting'),
            (SELECT MAX(p.date_planted) FROM plantings p WHERE p.seed_id = s.id)
          ) as last_planted
        FROM seeds s
        WHERE s.image_path IS NOT NULL
      )
      ORDER BY CASE WHEN last_planted IS NULL THEN 1 ELSE 0 END, last_planted DESC, planting_timing ASC, variety_name ASC
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
