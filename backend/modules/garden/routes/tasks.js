/**
 * Task routes
 * GET   /tasks          — list with filters: ?garden_id, ?zone_id, ?completed, ?priority, ?category
 * POST  /tasks          — create task
 * PATCH /tasks/:id      — update task (complete, reassign, edit)
 * DELETE /tasks/:id     — delete task
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

const VALID_PRIORITIES = new Set(['urgent', 'soon', 'someday']);

const EDITABLE_FIELDS = new Set([
  'title', 'description', 'category', 'priority', 'due_date',
  'completed', 'completed_date', 'recurring', 'recurrence_notes',
  'notes', 'garden_id', 'zone_id',
]);

// ── GET /tasks ─────────────────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    const { garden_id, zone_id, completed, priority, category } = req.query;

    const conditions = [];
    const params     = [];

    if (garden_id !== undefined) { conditions.push('t.garden_id = ?'); params.push(garden_id); }
    if (zone_id   !== undefined) { conditions.push('t.zone_id = ?');   params.push(zone_id); }
    if (completed !== undefined) { conditions.push('t.completed = ?'); params.push(completed === '1' || completed === 'true' ? 1 : 0); }
    if (priority  !== undefined && VALID_PRIORITIES.has(priority)) {
      conditions.push('t.priority = ?'); params.push(priority);
    }
    if (category !== undefined) { conditions.push('t.category = ?'); params.push(category); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const tasks = await db.all(`
      SELECT t.*,
             g.name AS garden_name,
             z.name AS zone_name
        FROM tasks t
        LEFT JOIN gardens g ON g.id = t.garden_id
        LEFT JOIN zones   z ON z.id = t.zone_id
       ${where}
       ORDER BY
         CASE t.priority WHEN 'urgent' THEN 0 WHEN 'soon' THEN 1 ELSE 2 END,
         t.due_date NULLS LAST,
         t.created_at ASC
    `, params);

    res.json({ tasks, count: tasks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /tasks ────────────────────────────────────────────────────────────────
router.post('/tasks', async (req, res) => {
  try {
    const { title, garden_id, zone_id, description, category, priority, due_date, notes } = req.body;

    if (!title) return res.status(400).json({ error: 'title required' });

    const resolvedPriority = (priority && VALID_PRIORITIES.has(priority)) ? priority : 'soon';

    const result = await db.run(`
      INSERT INTO tasks (garden_id, zone_id, title, description, category, priority, due_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      garden_id || null,
      zone_id   || null,
      title,
      description || null,
      category    || null,
      resolvedPriority,
      due_date    || null,
      notes       || null,
    ]);

    const task = await db.get(`SELECT * FROM tasks WHERE id = ?`, [result.id]);
    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /tasks/:id ──────────────────────────────────────────────────────────
router.patch('/tasks/:id', async (req, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => EDITABLE_FIELDS.has(k))
    );
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable fields provided' });
    }
    if (updates.priority && !VALID_PRIORITIES.has(updates.priority)) {
      return res.status(400).json({ error: `Invalid priority. Valid: ${[...VALID_PRIORITIES].join(', ')}` });
    }
    // Auto-set completed_date when marking complete
    if (updates.completed === true || updates.completed === 1 || updates.completed === '1') {
      updates.completed = 1;
      if (!updates.completed_date) updates.completed_date = new Date().toISOString().slice(0, 10);
    } else if (updates.completed === false || updates.completed === 0 || updates.completed === '0') {
      updates.completed = 0;
      updates.completed_date = null;
    }

    const cols   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), req.params.id];
    const result = await db.run(`UPDATE tasks SET ${cols} WHERE id = ?`, values);

    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });

    const task = await db.get(`SELECT * FROM tasks WHERE id = ?`, [req.params.id]);
    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /tasks/:id ─────────────────────────────────────────────────────────
router.delete('/tasks/:id', async (req, res) => {
  try {
    const result = await db.run(`DELETE FROM tasks WHERE id = ?`, [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
