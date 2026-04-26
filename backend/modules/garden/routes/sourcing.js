/**
 * Sourcing routes
 * GET   /sourcing          — list with filters: ?status, ?priority, ?plant_id, ?task_id
 * POST  /sourcing          — create sourcing item
 * PATCH /sourcing/:id      — update sourcing item
 * DELETE /sourcing/:id     — delete sourcing item
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_STATUSES    = new Set(['researching', 'ordered', 'received', 'done', 'cancelled']);
const VALID_PRIORITIES  = new Set(['urgent', 'soon', 'someday']);
const VALID_VENDOR_TYPES = new Set(['nursery', 'online', 'hardware', 'seed_company', 'local', 'other']);

const EDITABLE_FIELDS = new Set([
  'item_name', 'vendor', 'vendor_type', 'quantity', 'unit',
  'estimated_cost', 'actual_cost', 'status', 'priority', 'url', 'notes',
  'plant_id', 'task_id',
]);

// ── GET /sourcing ─────────────────────────────────────────────────────────────
router.get('/sourcing', async (req, res) => {
  try {
    const { status, priority, plant_id, task_id } = req.query;

    const conditions = [];
    const params     = [];

    if (status   && VALID_STATUSES.has(status))     { conditions.push('s.status = ?');   params.push(status); }
    if (priority && VALID_PRIORITIES.has(priority)) { conditions.push('s.priority = ?'); params.push(priority); }
    if (plant_id) { conditions.push('s.plant_id = ?'); params.push(plant_id); }
    if (task_id)  { conditions.push('s.task_id = ?');  params.push(task_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = await db.all(`
      SELECT s.*,
             p.name AS plant_name,
             t.title AS task_title
        FROM sourcing_items s
        LEFT JOIN plants p ON p.id = s.plant_id
        LEFT JOIN tasks  t ON t.id = s.task_id
       ${where}
       ORDER BY
         CASE s.priority WHEN 'urgent' THEN 0 WHEN 'soon' THEN 1 ELSE 2 END,
         CASE s.status WHEN 'researching' THEN 0 WHEN 'ordered' THEN 1 ELSE 2 END,
         s.item_name ASC
    `, params);

    res.json({ items, count: items.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /sourcing ────────────────────────────────────────────────────────────
router.post('/sourcing', async (req, res) => {
  try {
    const {
      item_name, plant_id, task_id, vendor, vendor_type,
      quantity, unit, estimated_cost, status, priority, url, notes,
    } = req.body;

    if (!item_name) return res.status(400).json({ error: 'item_name required' });

    const result = await db.run(`
      INSERT INTO sourcing_items
        (item_name, plant_id, task_id, vendor, vendor_type, quantity, unit, estimated_cost, status, priority, url, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      item_name,
      plant_id  || null,
      task_id   || null,
      vendor    || null,
      (vendor_type && VALID_VENDOR_TYPES.has(vendor_type)) ? vendor_type : null,
      quantity  || 1,
      unit      || null,
      estimated_cost || null,
      (status && VALID_STATUSES.has(status)) ? status : 'researching',
      (priority && VALID_PRIORITIES.has(priority)) ? priority : 'soon',
      url   || null,
      notes || null,
    ]);

    const item = await db.get(`SELECT * FROM sourcing_items WHERE id = ?`, [result.id]);
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /sourcing/:id ───────────────────────────────────────────────────────
router.patch('/sourcing/:id', async (req, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => EDITABLE_FIELDS.has(k))
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }
    if (updates.status   && !VALID_STATUSES.has(updates.status))     return res.status(400).json({ error: 'Invalid status' });
    if (updates.priority && !VALID_PRIORITIES.has(updates.priority)) return res.status(400).json({ error: 'Invalid priority' });

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    const result = await db.run(`UPDATE sourcing_items SET ${cols} WHERE id = ?`, values);

    if (result.changes === 0) return res.status(404).json({ error: 'Sourcing item not found' });

    const item = await db.get(`SELECT * FROM sourcing_items WHERE id = ?`, [req.params.id]);
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /sourcing/:id ──────────────────────────────────────────────────────
router.delete('/sourcing/:id', async (req, res) => {
  try {
    const result = await db.run(`DELETE FROM sourcing_items WHERE id = ?`, [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Sourcing item not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
