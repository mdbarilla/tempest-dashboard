/**
 * Guestbook API
 *
 * GET  /api/guestbook?visitId=<id>   — entries for one visit
 * GET  /api/guestbook/all            — all entries grouped by visit, newest visit first
 * POST /api/guestbook                — sign the guestbook { visitId, name, message? }
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// ── GET /api/guestbook?visitId=<id> ──────────────────────────────────────────
// Returns all entries for a specific visit, oldest-first (chronological read order).
router.get('/', (req, res) => {
  const { visitId } = req.query;
  if (!visitId) return res.status(400).json({ error: 'visitId query param required' });

  db.all(
    `SELECT id, visit_id, name, message, signed_at
     FROM guestbook
     WHERE visit_id = ?
     ORDER BY signed_at ASC`,
    [visitId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ visitId, entries: rows || [] });
    }
  );
});

// ── GET /api/guestbook/all ────────────────────────────────────────────────────
// Returns all entries grouped by visit, most recent visit first.
// Used by a future guestbook history page.
router.get('/all', (req, res) => {
  db.all(
    `SELECT id, visit_id, name, message, signed_at
     FROM guestbook
     ORDER BY visit_id DESC, signed_at ASC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Group by visit_id
      const visits = {};
      (rows || []).forEach(row => {
        if (!visits[row.visit_id]) visits[row.visit_id] = [];
        visits[row.visit_id].push(row);
      });

      // Return as sorted array [ { visitId, entries[] }, ... ]
      const grouped = Object.entries(visits)
        .sort(([a], [b]) => b.localeCompare(a))   // newest visit_id first
        .map(([visitId, entries]) => ({ visitId, entries }));

      res.json({ visits: grouped });
    }
  );
});

// ── POST /api/guestbook ───────────────────────────────────────────────────────
// Sign the guestbook. Body: { visitId, name, message? }
router.post('/', (req, res) => {
  const { visitId, name, message } = req.body || {};

  if (!visitId || typeof visitId !== 'string' || visitId.length > 100) {
    return res.status(400).json({ error: 'valid visitId required' });
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name required' });
  }

  const cleanName    = name.trim().slice(0, 100);
  const cleanMessage = message ? String(message).trim().slice(0, 1000) : null;

  db.run(
    `INSERT INTO guestbook (visit_id, name, message) VALUES (?, ?, ?)`,
    [visitId, cleanName, cleanMessage],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        ok: true,
        entry: {
          id:        this.lastID,
          visit_id:  visitId,
          name:      cleanName,
          message:   cleanMessage,
          signed_at: new Date().toISOString(),
        },
      });
    }
  );
});

module.exports = router;
