import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { salesman_id, visit_date, customer_id, date_from, date_to, is_issue } = req.query;
  let query = `SELECT dm.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name,
    (SELECT COUNT(*) FROM movement_comment mc WHERE mc.movement_id = dm.id) as comment_count
    FROM daily_movement dm
    JOIN customer c ON dm.customer_id = c.id
    JOIN salesman s ON dm.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND dm.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND dm.salesman_id = ?'; params.push(salesman_id); }
  if (visit_date) { query += ' AND dm.visit_date = ?'; params.push(visit_date); }
  if (date_from) { query += ' AND dm.visit_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND dm.visit_date <= ?'; params.push(date_to); }
  if (is_issue !== undefined) { query += ' AND dm.is_issue = ?'; params.push(is_issue); }
  if (req.user.role !== 'admin') { query += ' AND dm.salesman_id = ?'; params.push(req.user.id); }

  query += ' ORDER BY dm.visit_date DESC, dm.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const movement = db.prepare(`SELECT dm.*, c.name as customer_name, s.name as salesman_name
    FROM daily_movement dm JOIN customer c ON dm.customer_id = c.id
    JOIN salesman s ON dm.salesman_id = s.id WHERE dm.id = ?`).get(req.params.id);
  if (!movement) return res.status(404).json({ error: 'Movement not found' });
  res.json(movement);
});

router.post('/', (req, res) => {
  const { customer_id, visit_date, purpose, location, notes, status, is_issue } = req.body;
  if (!customer_id || !visit_date || !purpose) {
    return res.status(400).json({ error: 'customer_id, visit_date, and purpose are required' });
  }

  const result = db.prepare(
    `INSERT INTO daily_movement (customer_id, salesman_id, visit_date, purpose, location, notes, status, is_issue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(customer_id, req.user.id, visit_date, purpose, location || null, notes || null, status || 'planned', is_issue ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movement not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own movements' });
  }

  const { customer_id, visit_date, purpose, location, notes, status, is_issue } = req.body;
  db.prepare(
    `UPDATE daily_movement SET customer_id=?, visit_date=?, purpose=?, location=?, notes=?, status=?, is_issue=? WHERE id=?`
  ).run(customer_id || existing.customer_id, visit_date || existing.visit_date,
    purpose || existing.purpose, location ?? existing.location,
    notes ?? existing.notes, status || existing.status,
    is_issue !== undefined ? (is_issue ? 1 : 0) : existing.is_issue,
    req.params.id);

  res.json(db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movement not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own movements' });
  }
  db.prepare('DELETE FROM movement_comment WHERE movement_id = ?').run(req.params.id);
  db.prepare('DELETE FROM daily_movement WHERE id = ?').run(req.params.id);
  res.json({ message: 'Movement deleted' });
});

// --- Comments ---

// Get comments for a movement
router.get('/:id/comments', (req, res) => {
  const movement = db.prepare('SELECT id FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!movement) return res.status(404).json({ error: 'Movement not found' });

  const comments = db.prepare(`
    SELECT mc.*, s.name as user_name, s.role as user_role
    FROM movement_comment mc
    JOIN salesman s ON mc.user_id = s.id
    WHERE mc.movement_id = ?
    ORDER BY mc.created_at ASC
  `).all(req.params.id);

  res.json(comments);
});

// Add a comment to a movement
router.post('/:id/comments', (req, res) => {
  const movement = db.prepare('SELECT id FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!movement) return res.status(404).json({ error: 'Movement not found' });

  const { comment } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'Comment is required' });

  const result = db.prepare(
    'INSERT INTO movement_comment (movement_id, user_id, comment) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, comment.trim());

  const saved = db.prepare(`
    SELECT mc.*, s.name as user_name, s.role as user_role
    FROM movement_comment mc
    JOIN salesman s ON mc.user_id = s.id
    WHERE mc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(saved);
});

export default router;
