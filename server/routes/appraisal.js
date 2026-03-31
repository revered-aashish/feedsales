import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List appraisals — admin sees all, salesman sees own
router.get('/', (req, res) => {
  const { salesman_id, month, year } = req.query;
  let query = `SELECT sa.*, s.name as salesman_name
    FROM self_appraisal sa
    JOIN salesman s ON sa.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (salesman_id) { query += ' AND sa.salesman_id = ?'; params.push(salesman_id); }
  if (month) { query += ' AND sa.month = ?'; params.push(month); }
  if (year) { query += ' AND sa.year = ?'; params.push(year); }
  if (req.user.role !== 'admin') { query += ' AND sa.salesman_id = ?'; params.push(req.user.id); }

  query += ' ORDER BY sa.year DESC, sa.month DESC';
  res.json(db.prepare(query).all(...params));
});

// Create or update appraisal (upsert — one per salesman per month)
router.post('/', (req, res) => {
  const { month, year, coating_target, coating_sales, resin_target, resin_sales, coalseam_target, coalseam_sales } = req.body;
  if (!month || !year) return res.status(400).json({ error: 'Month and year are required' });

  const salesman_id = req.user.id;

  // Check if entry already exists for this salesman+month+year
  const existing = db.prepare(
    'SELECT * FROM self_appraisal WHERE salesman_id = ? AND month = ? AND year = ?'
  ).get(salesman_id, month, year);

  if (existing) {
    // Only creator or admin can update
    if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own appraisals' });
    }

    db.prepare(`UPDATE self_appraisal SET
      coating_target=?, coating_sales=?, resin_target=?, resin_sales=?,
      coalseam_target=?, coalseam_sales=?, updated_at=datetime('now')
      WHERE id=?`
    ).run(
      coating_target || 0, coating_sales || 0,
      resin_target || 0, resin_sales || 0,
      coalseam_target || 0, coalseam_sales || 0,
      existing.id
    );

    res.json(db.prepare('SELECT sa.*, s.name as salesman_name FROM self_appraisal sa JOIN salesman s ON sa.salesman_id = s.id WHERE sa.id = ?').get(existing.id));
  } else {
    const result = db.prepare(`INSERT INTO self_appraisal
      (salesman_id, month, year, coating_target, coating_sales, resin_target, resin_sales, coalseam_target, coalseam_sales)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      salesman_id, month, year,
      coating_target || 0, coating_sales || 0,
      resin_target || 0, resin_sales || 0,
      coalseam_target || 0, coalseam_sales || 0
    );

    res.status(201).json(db.prepare('SELECT sa.*, s.name as salesman_name FROM self_appraisal sa JOIN salesman s ON sa.salesman_id = s.id WHERE sa.id = ?').get(result.lastInsertRowid));
  }
});

// Update appraisal
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM self_appraisal WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appraisal not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own appraisals' });
  }

  const { coating_target, coating_sales, resin_target, resin_sales, coalseam_target, coalseam_sales } = req.body;

  db.prepare(`UPDATE self_appraisal SET
    coating_target=?, coating_sales=?, resin_target=?, resin_sales=?,
    coalseam_target=?, coalseam_sales=?, updated_at=datetime('now')
    WHERE id=?`
  ).run(
    coating_target ?? existing.coating_target, coating_sales ?? existing.coating_sales,
    resin_target ?? existing.resin_target, resin_sales ?? existing.resin_sales,
    coalseam_target ?? existing.coalseam_target, coalseam_sales ?? existing.coalseam_sales,
    req.params.id
  );

  res.json(db.prepare('SELECT sa.*, s.name as salesman_name FROM self_appraisal sa JOIN salesman s ON sa.salesman_id = s.id WHERE sa.id = ?').get(req.params.id));
});

// Delete appraisal — owner or admin only
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM self_appraisal WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appraisal not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own appraisals' });
  }
  db.prepare('DELETE FROM self_appraisal WHERE id = ?').run(req.params.id);
  res.json({ message: 'Appraisal deleted' });
});

export default router;
