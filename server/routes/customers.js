import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateListPDF } from '../utils/pdfReport.js';

const router = Router();
router.use(authenticate);

// List all customers (with optional filters)
router.get('/', (req, res) => {
  const { salesman_id, search, is_lost, city } = req.query;
  let query = `SELECT c.*, s.name as salesman_name FROM customer c
    LEFT JOIN salesman s ON c.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (salesman_id) {
    query += ' AND c.salesman_id = ?';
    params.push(salesman_id);
  }
  if (is_lost !== undefined) {
    query += ' AND c.is_lost = ?';
    params.push(is_lost);
  }
  if (city) {
    query += ' AND c.city = ?';
    params.push(city);
  }
  if (search) {
    query += ' AND (c.name LIKE ? OR c.company LIKE ? OR c.city LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY c.created_at DESC';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
});

// Lost customers
router.get('/lost', (req, res) => {
  const { salesman_id, city, date_from, date_to, search } = req.query;
  let query = `SELECT c.*, s.name as salesman_name FROM customer c
    LEFT JOIN salesman s ON c.salesman_id = s.id WHERE c.is_lost IN (1, 2)`;
  const params = [];

  if (salesman_id) { query += ' AND c.salesman_id = ?'; params.push(salesman_id); }
  if (city) { query += ' AND c.city = ?'; params.push(city); }
  if (date_from) { query += ' AND c.lost_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND c.lost_date <= ?'; params.push(date_to); }
  if (search) {
    query += ' AND (c.name LIKE ? OR c.company LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  query += ' ORDER BY c.lost_date DESC';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
});

// Customers list export — before /:id
router.get('/export/pdf', (req, res) => {
  const { salesman_id, search, is_lost, city } = req.query;
  let query = `SELECT c.*, s.name as salesman_name FROM customer c
    LEFT JOIN salesman s ON c.salesman_id = s.id WHERE 1=1`;
  const params = [];
  if (salesman_id) { query += ' AND c.salesman_id = ?'; params.push(salesman_id); }
  if (is_lost !== undefined && is_lost !== '') { query += ' AND c.is_lost = ?'; params.push(is_lost); }
  if (city) { query += ' AND c.city = ?'; params.push(city); }
  if (search) { query += ' AND (c.name LIKE ? OR c.company LIKE ? OR c.city LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
  query += ' ORDER BY c.created_at DESC';
  const rows = db.prepare(query).all(...params);

  const filters = [];
  if (salesman_id) { const s = db.prepare('SELECT name FROM salesman WHERE id=?').get(salesman_id); if (s) filters.push({ label: 'Salesman', value: s.name }); }
  if (city) filters.push({ label: 'City', value: city });
  if (is_lost === '0') filters.push({ label: 'Status', value: 'Active' });
  else if (is_lost === '1') filters.push({ label: 'Status', value: 'Fully Lost' });
  else if (is_lost === '2') filters.push({ label: 'Status', value: 'Partially Lost' });
  if (search) filters.push({ label: 'Search', value: search });

  const statusBadge = (v) => ({ 0: { bg: '#dcfce7', fg: '#15803d' }, 1: { bg: '#fee2e2', fg: '#b91c1c' }, 2: { bg: '#ffedd5', fg: '#c2410c' } }[String(v)]);

  generateListPDF(res, {
    title: 'Customer Report',
    filename: `Customers_${new Date().toISOString().split('T')[0]}.pdf`,
    filters,
    columns: [
      { header: 'Company', key: 'company', flex: 2.5, bold: true },
      { header: 'City', key: 'city', flex: 1.2 },
      { header: 'Salesman', key: 'salesman_name', flex: 1.5 },
      { header: 'Status', key: 'is_lost', flex: 1, badge: (v) => statusBadge(Number(v)) },
    ],
    rows: rows.map(r => ({ ...r, company: r.company || r.name, is_lost: r.is_lost === 2 ? 'Partial' : r.is_lost === 1 ? 'Lost' : 'Active' })),
  });
});

// Lost customers export — before /:id
router.get('/lost/export/pdf', (req, res) => {
  const { salesman_id, city, date_from, date_to, search, is_lost } = req.query;
  let query = `SELECT c.*, s.name as salesman_name FROM customer c
    LEFT JOIN salesman s ON c.salesman_id = s.id WHERE c.is_lost IN (1, 2)`;
  const params = [];
  if (salesman_id) { query += ' AND c.salesman_id = ?'; params.push(salesman_id); }
  if (city) { query += ' AND c.city = ?'; params.push(city); }
  if (date_from) { query += ' AND c.lost_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND c.lost_date <= ?'; params.push(date_to); }
  if (is_lost) { query += ' AND c.is_lost = ?'; params.push(is_lost); }
  if (search) { query += ' AND (c.name LIKE ? OR c.company LIKE ?)'; const s = `%${search}%`; params.push(s, s); }
  query += ' ORDER BY c.lost_date DESC';
  const rows = db.prepare(query).all(...params);

  const filters = [];
  if (salesman_id) { const s = db.prepare('SELECT name FROM salesman WHERE id=?').get(salesman_id); if (s) filters.push({ label: 'Salesman', value: s.name }); }
  if (city) filters.push({ label: 'City', value: city });
  if (date_from) filters.push({ label: 'From', value: date_from });
  if (date_to) filters.push({ label: 'To', value: date_to });
  if (is_lost === '1') filters.push({ label: 'Type', value: 'Fully Lost' });
  else if (is_lost === '2') filters.push({ label: 'Type', value: 'Partially Lost' });
  if (search) filters.push({ label: 'Search', value: search });

  const typeBadge = (v) => v === 'Partial' ? { bg: '#ffedd5', fg: '#c2410c' } : { bg: '#fee2e2', fg: '#b91c1c' };

  generateListPDF(res, {
    title: 'Lost Customers Report',
    filename: `LostCustomers_${new Date().toISOString().split('T')[0]}.pdf`,
    filters,
    columns: [
      { header: 'Company', key: 'company', flex: 2, bold: true },
      { header: 'City', key: 'city', flex: 1 },
      { header: 'Salesman', key: 'salesman_name', flex: 1.5 },
      { header: 'Type', key: 'type', flex: 0.8, badge: typeBadge },
      { header: 'Lost Date', key: 'lost_date', flex: 1 },
      { header: 'Product / Reason', key: 'details', flex: 2.2 },
    ],
    rows: rows.map(r => ({
      ...r,
      company: r.company || r.name,
      type: r.is_lost === 2 ? 'Partial' : 'Lost',
      details: r.is_lost === 2
        ? [r.partial_loss_product && `Product: ${r.partial_loss_product}`, r.partial_loss_reason].filter(Boolean).join(' — ')
        : (r.lost_reason || ''),
    })),
  });
});

// Get single customer
router.get('/:id', (req, res) => {
  const customer = db.prepare(`SELECT c.*, s.name as salesman_name FROM customer c
    LEFT JOIN salesman s ON c.salesman_id = s.id WHERE c.id = ?`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json(customer);
});

// Create customer
router.post('/', (req, res) => {
  const { name, company, phone, email, address, city, state, salesman_id } = req.body;
  if (!company) return res.status(400).json({ error: 'Company name is required' });

  // Duplicate company name check (case-insensitive)
  const duplicate = db.prepare('SELECT id FROM customer WHERE LOWER(TRIM(company)) = LOWER(TRIM(?))').get(company);
  if (duplicate) return res.status(409).json({ error: `A customer named "${company}" already exists` });

  const assignedSalesman = salesman_id || req.user.id;
  const result = db.prepare(
    `INSERT INTO customer (name, company, phone, email, address, city, state, salesman_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name || company, company, phone || null, email || null, address || null, city || null, state || null, assignedSalesman);

  const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(customer);
});

// Update customer
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM customer WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const { name, company, phone, email, address, city, state, salesman_id, is_lost, lost_reason,
          partial_loss_product, partial_loss_reason } = req.body;

  // Duplicate company name check (exclude self, case-insensitive)
  if (company) {
    const duplicate = db.prepare(
      'SELECT id FROM customer WHERE LOWER(TRIM(company)) = LOWER(TRIM(?)) AND id != ?'
    ).get(company, req.params.id);
    if (duplicate) return res.status(409).json({ error: `A customer named "${company}" already exists` });
  }

  const newIsLost = is_lost ?? existing.is_lost;
  const lostDate = (newIsLost && !existing.is_lost) ? new Date().toISOString().split('T')[0] : existing.lost_date;

  db.prepare(
    `UPDATE customer SET name=?, company=?, phone=?, email=?, address=?, city=?, state=?,
     salesman_id=?, is_lost=?, lost_reason=?, lost_date=?,
     partial_loss_product=?, partial_loss_reason=? WHERE id=?`
  ).run(
    name || existing.name, company ?? existing.company, phone ?? existing.phone,
    email ?? existing.email, address ?? existing.address, city ?? existing.city,
    state ?? existing.state, salesman_id || existing.salesman_id,
    newIsLost, lost_reason ?? existing.lost_reason, lostDate,
    partial_loss_product ?? existing.partial_loss_product,
    partial_loss_reason ?? existing.partial_loss_reason,
    req.params.id
  );

  const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(req.params.id);
  res.json(customer);
});

// Delete customer — admin only, cascade deletes related entries
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can delete customers' });
  }
  const existing = db.prepare('SELECT * FROM customer WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const deleteCustomer = db.transaction(() => {
    // Delete comments on movements for this customer
    const movementIds = db.prepare('SELECT id FROM daily_movement WHERE customer_id = ?').all(req.params.id);
    for (const m of movementIds) {
      db.prepare('DELETE FROM movement_comment WHERE movement_id = ?').run(m.id);
    }
    db.prepare('DELETE FROM daily_movement WHERE customer_id = ?').run(req.params.id);
    db.prepare('DELETE FROM daily_visit_plan WHERE customer_id = ?').run(req.params.id);
    db.prepare('DELETE FROM complaint WHERE customer_id = ?').run(req.params.id);
    db.prepare('DELETE FROM trial WHERE customer_id = ?').run(req.params.id);
    db.prepare('DELETE FROM customer WHERE id = ?').run(req.params.id);
  });

  deleteCustomer();
  res.json({ message: 'Customer and all related entries deleted' });
});

export default router;
