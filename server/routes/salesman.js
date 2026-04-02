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

router.delete('/:id', adminOnly, (req, res) => {
  const target = db.prepare('SELECT * FROM salesman WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Salesman not found' });
  if (target.role === 'admin' && target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account' });
  }

  // Find an admin to reassign linked records to (prefer the current user)
  const admin = db.prepare('SELECT id FROM salesman WHERE role = ? AND id != ? LIMIT 1')
    .get('admin', req.params.id);
  if (!admin) return res.status(400).json({ error: 'No admin available to reassign records' });

  const reassignTo = admin.id;

  // Reassign all linked records in a transaction
  const deleteSalesman = db.transaction(() => {
    db.prepare('UPDATE customer SET salesman_id = ? WHERE salesman_id = ?').run(reassignTo, req.params.id);
    db.prepare('UPDATE trial SET salesman_id = ? WHERE salesman_id = ?').run(reassignTo, req.params.id);
    db.prepare('UPDATE complaint SET salesman_id = ? WHERE salesman_id = ?').run(reassignTo, req.params.id);
    db.prepare('UPDATE daily_movement SET salesman_id = ? WHERE salesman_id = ?').run(reassignTo, req.params.id);
    db.prepare('UPDATE daily_visit_plan SET salesman_id = ? WHERE salesman_id = ?').run(reassignTo, req.params.id);
    db.prepare('UPDATE movement_comment SET user_id = ? WHERE user_id = ?').run(reassignTo, req.params.id);
    db.prepare('DELETE FROM self_appraisal WHERE salesman_id = ?').run(req.params.id);
    db.prepare('DELETE FROM salesman WHERE id = ?').run(req.params.id);
  });

  deleteSalesman();
  res.json({ message: `Salesman deleted. Linked records reassigned to admin.` });
});

export default router;
