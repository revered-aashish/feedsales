import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { salesman_id, visit_date, customer_id, date_from, date_to } = req.query;
  let query = `SELECT dm.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM daily_movement dm
    JOIN customer c ON dm.customer_id = c.id
    JOIN salesman s ON dm.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND dm.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND dm.salesman_id = ?'; params.push(salesman_id); }
  if (visit_date) { query += ' AND dm.visit_date = ?'; params.push(visit_date); }
  if (date_from) { query += ' AND dm.visit_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND dm.visit_date <= ?'; params.push(date_to); }
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
  const { customer_id, visit_date, purpose, location, notes, status } = req.body;
  if (!customer_id || !visit_date || !purpose) {
    return res.status(400).json({ error: 'customer_id, visit_date, and purpose are required' });
  }

  const result = db.prepare(
    `INSERT INTO daily_movement (customer_id, salesman_id, visit_date, purpose, location, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(customer_id, req.user.id, visit_date, purpose, location || null, notes || null, status || 'planned');

  res.status(201).json(db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movement not found' });

  const { customer_id, visit_date, purpose, location, notes, status } = req.body;
  db.prepare(
    `UPDATE daily_movement SET customer_id=?, visit_date=?, purpose=?, location=?, notes=?, status=? WHERE id=?`
  ).run(customer_id || existing.customer_id, visit_date || existing.visit_date,
    purpose || existing.purpose, location ?? existing.location,
    notes ?? existing.notes, status || existing.status, req.params.id);

  res.json(db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movement not found' });
  db.prepare('DELETE FROM daily_movement WHERE id = ?').run(req.params.id);
  res.json({ message: 'Movement deleted' });
});

export default router;
