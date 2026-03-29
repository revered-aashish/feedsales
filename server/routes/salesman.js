import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const salesmen = db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM salesman ORDER BY name').all();
  res.json(salesmen);
});

router.get('/:id', (req, res) => {
  const salesman = db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM salesman WHERE id = ?').get(req.params.id);
  if (!salesman) return res.status(404).json({ error: 'Salesman not found' });
  res.json(salesman);
});

router.post('/', adminOnly, (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, and password are required' });

  const exists = db.prepare('SELECT id FROM salesman WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO salesman (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)'
  ).run(name, email, hash, phone || null, role || 'salesman');

  const salesman = db.prepare('SELECT id, name, email, phone, role, created_at FROM salesman WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(salesman);
});

router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM salesman WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Salesman not found' });

  const { name, email, password, phone, role, is_active } = req.body;
  const hash = password ? bcrypt.hashSync(password, 10) : existing.password;

  db.prepare(
    'UPDATE salesman SET name=?, email=?, password=?, phone=?, role=?, is_active=? WHERE id=?'
  ).run(name || existing.name, email || existing.email, hash, phone ?? existing.phone,
    role || existing.role, is_active ?? existing.is_active, req.params.id);

  const salesman = db.prepare('SELECT id, name, email, phone, role, is_active, created_at FROM salesman WHERE id = ?').get(req.params.id);
  res.json(salesman);
});

export default router;
