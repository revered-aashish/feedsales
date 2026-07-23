import { Router } from 'express';
import db from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List all regions (available to everyone so dropdowns can populate)
router.get('/', (req, res) => {
  const regions = db.prepare('SELECT r.*, (SELECT COUNT(*) FROM salesman s WHERE s.region = r.name) AS salesman_count FROM region r ORDER BY r.name').all();
  res.json(regions);
});

// Add a new region (admin)
router.post('/', adminOnly, (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Region name is required' });

  const exists = db.prepare('SELECT id FROM region WHERE LOWER(name) = LOWER(?)').get(name);
  if (exists) return res.status(409).json({ error: `Region "${name}" already exists` });

  const result = db.prepare('INSERT INTO region (name) VALUES (?)').run(name);
  res.status(201).json(db.prepare('SELECT * FROM region WHERE id = ?').get(result.lastInsertRowid));
});

// Rename a region (admin) — cascades the new name to every salesman in it
router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM region WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Region not found' });

  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Region name is required' });

  const dup = db.prepare('SELECT id FROM region WHERE LOWER(name) = LOWER(?) AND id != ?').get(name, req.params.id);
  if (dup) return res.status(409).json({ error: `Another region named "${name}" already exists` });

  const rename = db.transaction(() => {
    db.prepare('UPDATE salesman SET region = ? WHERE region = ?').run(name, existing.name);
    db.prepare('UPDATE region SET name = ? WHERE id = ?').run(name, req.params.id);
  });
  rename();

  res.json(db.prepare('SELECT * FROM region WHERE id = ?').get(req.params.id));
});

// Delete a region (admin) — blocked if salesmen are still assigned to it
router.delete('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM region WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Region not found' });

  const count = db.prepare('SELECT COUNT(*) AS c FROM salesman WHERE region = ?').get(existing.name).c;
  if (count > 0) {
    return res.status(400).json({ error: `Cannot delete — ${count} salesman(en) still assigned to this region` });
  }

  db.prepare('DELETE FROM region WHERE id = ?').run(req.params.id);
  res.json({ message: 'Region deleted' });
});

export default router;
