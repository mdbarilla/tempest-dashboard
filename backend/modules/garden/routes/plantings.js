/**
 * Garden plantings routes (legacy planting records)
 * POST   /seeds/:id/plantings
 * PATCH  /plantings/:id
 * DELETE /plantings/:id
 */
const express = require('express');
const router = express.Router();
const gardenDb = require('../db');

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

module.exports = router;
