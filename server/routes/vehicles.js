import { Router } from 'express';
import db from '../db.js';
import { authenticate, dispatchOrAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// All authenticated users can see active vehicles (needed for order reference)
router.get('/', (req, res) => {
  const { all } = req.query;
  const sql = all && (req.user.role === 'admin' || req.user.is_dispatch_manager)
    ? 'SELECT * FROM vehicle ORDER BY vehicle_number'
    : 'SELECT * FROM vehicle WHERE is_active=1 ORDER BY vehicle_number';
  res.json(db.prepare(sql).all());
});

router.post('/', dispatchOrAdmin, (req, res) => {
  const { vehicle_number, driver_name } = req.body;
  if (!vehicle_number?.trim() || !driver_name?.trim()) {
    return res.status(400).json({ error: 'vehicle_number and driver_name are required' });
  }
  const result = db.prepare(
    'INSERT INTO vehicle (vehicle_number, driver_name) VALUES (?, ?)'
  ).run(vehicle_number.trim(), driver_name.trim());
  res.status(201).json(db.prepare('SELECT * FROM vehicle WHERE id=?').get(result.lastInsertRowid));
});

router.put('/:id', dispatchOrAdmin, (req, res) => {
  const v = db.prepare('SELECT * FROM vehicle WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });
  const { vehicle_number, driver_name, is_active } = req.body;
  db.prepare('UPDATE vehicle SET vehicle_number=?, driver_name=?, is_active=? WHERE id=?')
    .run(vehicle_number ?? v.vehicle_number, driver_name ?? v.driver_name,
      is_active != null ? (is_active ? 1 : 0) : v.is_active, v.id);
  res.json(db.prepare('SELECT * FROM vehicle WHERE id=?').get(v.id));
});

router.delete('/:id', dispatchOrAdmin, (req, res) => {
  const v = db.prepare('SELECT * FROM vehicle WHERE id=?').get(req.params.id);
  if (!v) return res.status(404).json({ error: 'Vehicle not found' });
  // Soft delete — just deactivate
  db.prepare('UPDATE vehicle SET is_active=0 WHERE id=?').run(v.id);
  res.json({ success: true });
});

export default router;
