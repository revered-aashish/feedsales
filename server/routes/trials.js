import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { customer_id, salesman_id, status, date_from, date_to } = req.query;
  let query = `SELECT t.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM trial t
    JOIN customer c ON t.customer_id = c.id
    JOIN salesman s ON t.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND t.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND t.salesman_id = ?'; params.push(salesman_id); }
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (date_from) { query += ' AND t.start_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND t.start_date <= ?'; params.push(date_to); }
  if (req.user.role !== 'admin') { query += ' AND t.salesman_id = ?'; params.push(req.user.id); }

  query += ' ORDER BY t.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const trial = db.prepare(`SELECT t.*, c.name as customer_name, s.name as salesman_name
    FROM trial t JOIN customer c ON t.customer_id = c.id
    JOIN salesman s ON t.salesman_id = s.id WHERE t.id = ?`).get(req.params.id);
  if (!trial) return res.status(404).json({ error: 'Trial not found' });
  res.json(trial);
});

router.post('/', (req, res) => {
  const { customer_id, product, quantity, status, start_date, end_date, notes } = req.body;
  if (!customer_id || !product) return res.status(400).json({ error: 'customer_id and product are required' });

  const result = db.prepare(
    `INSERT INTO trial (customer_id, salesman_id, product, quantity, status, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(customer_id, req.user.id, product, quantity || null, status || 'pending',
    start_date || null, end_date || null, notes || null);

  const trial = db.prepare('SELECT * FROM trial WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(trial);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trial not found' });

  const { product, quantity, status, start_date, end_date, notes } = req.body;
  db.prepare(
    `UPDATE trial SET product=?, quantity=?, status=?, start_date=?, end_date=?, notes=? WHERE id=?`
  ).run(product || existing.product, quantity ?? existing.quantity, status || existing.status,
    start_date ?? existing.start_date, end_date ?? existing.end_date, notes ?? existing.notes, req.params.id);

  res.json(db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trial not found' });
  db.prepare('DELETE FROM trial WHERE id = ?').run(req.params.id);
  res.json({ message: 'Trial deleted' });
});

export default router;
