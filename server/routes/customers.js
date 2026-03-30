import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

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

  // Non-admin salesmen only see their own customers
  if (req.user.role !== 'admin') {
    query += ' AND c.salesman_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY c.created_at DESC';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
});

// Lost customers
router.get('/lost', (req, res) => {
  const { salesman_id, city, date_from, date_to, search } = req.query;
  let query = `SELECT c.*, s.name as salesman_name FROM customer c
    LEFT JOIN salesman s ON c.salesman_id = s.id WHERE c.is_lost = 1`;
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
  if (req.user.role !== 'admin') {
    query += ' AND c.salesman_id = ?';
    params.push(req.user.id);
  }

  query += ' ORDER BY c.lost_date DESC';
  const customers = db.prepare(query).all(...params);
  res.json(customers);
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
  if (!name) return res.status(400).json({ error: 'Customer name is required' });

  const assignedSalesman = salesman_id || req.user.id;
  const result = db.prepare(
    `INSERT INTO customer (name, company, phone, email, address, city, state, salesman_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, company || null, phone || null, email || null, address || null, city || null, state || null, assignedSalesman);

  const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(customer);
});

// Update customer
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM customer WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  const { name, company, phone, email, address, city, state, salesman_id, is_lost, lost_reason } = req.body;

  const lostDate = is_lost && !existing.is_lost ? new Date().toISOString().split('T')[0] : existing.lost_date;

  db.prepare(
    `UPDATE customer SET name=?, company=?, phone=?, email=?, address=?, city=?, state=?,
     salesman_id=?, is_lost=?, lost_reason=?, lost_date=? WHERE id=?`
  ).run(
    name || existing.name, company ?? existing.company, phone ?? existing.phone,
    email ?? existing.email, address ?? existing.address, city ?? existing.city,
    state ?? existing.state, salesman_id || existing.salesman_id,
    is_lost ?? existing.is_lost, lost_reason ?? existing.lost_reason,
    lostDate, req.params.id
  );

  const customer = db.prepare('SELECT * FROM customer WHERE id = ?').get(req.params.id);
  res.json(customer);
});

// Delete customer
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM customer WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });

  db.prepare('DELETE FROM daily_movement WHERE customer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM complaint WHERE customer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM trial WHERE customer_id = ?').run(req.params.id);
  db.prepare('DELETE FROM customer WHERE id = ?').run(req.params.id);
  res.json({ message: 'Customer deleted' });
});

export default router;
