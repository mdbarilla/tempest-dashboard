/**
 * Garden activities routes (seed-level indoor events)
 * GET    /seeds/:id/activities
 * POST   /seeds/:id/activities
 * PATCH  /activities/:id
 * DELETE /activities/:id
 *
 * Lifecycle event types (in addition to planting/observation/note):
 *   germination  — how many sprouted (amount = count)
 *   pot_up       — moved to larger container (amount = count)
 *   gift         — given away (amount = count)
 *   died         — lost / didn't make it (amount = count)
 *   eaten        — lost to predators (amount = count, notes = animal)
 *   planted_out  — moved to ground/garden (amount = count, location)
 *   season_close — marks season complete (notes = retrospective)
 */
const express = require('express');
const router = express.Router();
const gardenDb = require('../db');

const VALID_TYPES = new Set([
  'planting', 'observation', 'note',
  'germination', 'pot_up', 'gift', 'died', 'eaten', 'planted_out', 'season_close',
]);

// Types that require an amount
const AMOUNT_REQUIRED_TYPES = new Set(['planting', 'germination', 'pot_up', 'gift', 'died', 'eaten', 'planted_out']);

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

    const { type, occurred_at, amount, notes, indoor_outdoor, soil_type, container_type, location, parent_activity_id } = req.body || {};
    if (!type || !VALID_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: `type must be one of: ${[...VALID_TYPES].join(', ')}` });
    }
    if (!occurred_at) {
      return res.status(400).json({ success: false, error: 'occurred_at is required' });
    }
    if (AMOUNT_REQUIRED_TYPES.has(type) && (amount == null || isNaN(parseInt(amount, 10)))) {
      return res.status(400).json({ success: false, error: `amount is required for ${type} entries` });
    }

    const seed = await gardenDb.get('SELECT id FROM seeds WHERE id = ?', [id]);
    if (!seed) return res.status(404).json({ success: false, error: 'Seed not found' });

    // Validate parent_activity_id if provided
    if (parent_activity_id != null) {
      const parent = await gardenDb.get('SELECT id FROM activities WHERE id = ? AND seed_id = ?', [parent_activity_id, id]);
      if (!parent) return res.status(400).json({ success: false, error: 'parent_activity_id not found for this seed' });
    }

    const amt = amount != null ? parseInt(amount, 10) : null;
    const result = await gardenDb.run(
      `INSERT INTO activities (seed_id, type, occurred_at, amount, notes, indoor_outdoor, soil_type, container_type, location, parent_activity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, type, occurred_at, amt, notes || null,
       indoor_outdoor || null, soil_type || null, container_type || null, location || null,
       parent_activity_id != null ? parseInt(parent_activity_id, 10) : null]
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
      germinated_count, germinated_at, in_ground, gifted, containers_count,
      parent_activity_id } = req.body || {};
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
    if (parent_activity_id !== undefined) { updates.push('parent_activity_id = ?'); params.push(parent_activity_id == null ? null : parseInt(parent_activity_id, 10)); }

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

module.exports = router;
