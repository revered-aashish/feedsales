import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { customer_id, salesman_id, status, date_from, date_to } = req.query;
  let query = `SELECT co.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM complaint co
    JOIN customer c ON co.customer_id = c.id
    JOIN salesman s ON co.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND co.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND co.salesman_id = ?'; params.push(salesman_id); }
  if (status) { query += ' AND co.status = ?'; params.push(status); }
  if (date_from) { query += ' AND co.created_at >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND co.created_at <= ?'; params.push(date_to + ' 23:59:59'); }

  query += ' ORDER BY co.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const complaint = db.prepare(`SELECT co.*, c.name as customer_name, s.name as salesman_name
    FROM complaint co JOIN customer c ON co.customer_id = c.id
    JOIN salesman s ON co.salesman_id = s.id WHERE co.id = ?`).get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  res.json(complaint);
});

router.post('/', (req, res) => {
  const { customer_id, subject, description } = req.body;
  if (!customer_id || !subject) return res.status(400).json({ error: 'customer_id and subject are required' });

  const result = db.prepare(
    `INSERT INTO complaint (customer_id, salesman_id, subject, description) VALUES (?, ?, ?, ?)`
  ).run(customer_id, req.user.id, subject, description || null);

  res.status(201).json(db.prepare('SELECT * FROM complaint WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own complaints' });
  }

  const { subject, description, status, resolution } = req.body;
  db.prepare(
    `UPDATE complaint SET subject=?, description=?, status=?, resolution=? WHERE id=?`
  ).run(subject || existing.subject, description ?? existing.description,
    status || existing.status, resolution ?? existing.resolution, req.params.id);

  res.json(db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id));
});

// Delete complaint — admin only
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can delete complaints' });
  }
  const existing = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });
  db.prepare('DELETE FROM complaint WHERE id = ?').run(req.params.id);
  res.json({ message: 'Complaint deleted' });
});

export default router;
