import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateListPDF } from '../utils/pdfReport.js';

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

  query += ' ORDER BY t.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/export/pdf', (req, res) => {
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
  query += ' ORDER BY t.created_at DESC';
  const rows = db.prepare(query).all(...params);

  const filters = [];
  if (salesman_id) { const s = db.prepare('SELECT name FROM salesman WHERE id=?').get(salesman_id); if (s) filters.push({ label: 'Salesman', value: s.name }); }
  if (customer_id) { const c = db.prepare('SELECT company, name FROM customer WHERE id=?').get(customer_id); if (c) filters.push({ label: 'Customer', value: c.company || c.name }); }
  if (status) filters.push({ label: 'Status', value: status.replace('_', ' ') });
  if (date_from) filters.push({ label: 'From', value: date_from });
  if (date_to) filters.push({ label: 'To', value: date_to });

  const statusBadge = (v) => ({
    pending: { bg: '#fef9c3', fg: '#854d0e' },
    in_progress: { bg: '#dbeafe', fg: '#1d4ed8' },
    successful: { bg: '#dcfce7', fg: '#15803d' },
    failed: { bg: '#fee2e2', fg: '#b91c1c' },
  }[v]);

  generateListPDF(res, {
    title: 'Trials Report',
    filename: `Trials_${new Date().toISOString().split('T')[0]}.pdf`,
    filters,
    columns: [
      { header: 'Customer', key: 'customer', flex: 2, bold: true },
      { header: 'Product', key: 'product', flex: 1.5 },
      { header: 'Quantity', key: 'quantity', flex: 0.8 },
      { header: 'Status', key: 'status', flex: 1, badge: statusBadge },
      { header: 'Start Date', key: 'start_date', flex: 1 },
      { header: 'Salesman', key: 'salesman_name', flex: 1.5 },
    ],
    rows: rows.map(r => ({ ...r, customer: r.customer_company || r.customer_name })),
  });
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
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own trials' });
  }

  const { product, quantity, status, start_date, end_date, notes } = req.body;
  db.prepare(
    `UPDATE trial SET product=?, quantity=?, status=?, start_date=?, end_date=?, notes=? WHERE id=?`
  ).run(product || existing.product, quantity ?? existing.quantity, status || existing.status,
    start_date ?? existing.start_date, end_date ?? existing.end_date, notes ?? existing.notes, req.params.id);

  res.json(db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can delete trials' });
  }
  const existing = db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trial not found' });
  db.prepare('DELETE FROM trial WHERE id = ?').run(req.params.id);
  res.json({ message: 'Trial deleted' });
});

export default router;
