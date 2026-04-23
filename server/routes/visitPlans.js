import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { generateListPDF } from '../utils/pdfReport.js';

const router = Router();
router.use(authenticate);

// Get visit plans (grouped by date & salesman)
router.get('/', (req, res) => {
  const { salesman_id, visit_date, customer_id, date_from, date_to } = req.query;
  let query = `SELECT vp.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM daily_visit_plan vp
    JOIN customer c ON vp.customer_id = c.id
    JOIN salesman s ON vp.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND vp.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND vp.salesman_id = ?'; params.push(salesman_id); }
  if (visit_date) { query += ' AND vp.visit_date = ?'; params.push(visit_date); }
  if (date_from) { query += ' AND vp.visit_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND vp.visit_date <= ?'; params.push(date_to); }

  query += ' ORDER BY vp.visit_date DESC, vp.salesman_id, vp.slot_number ASC';
  res.json(db.prepare(query).all(...params));
});

router.get('/export/pdf', (req, res) => {
  const { salesman_id, customer_id, date_from, date_to } = req.query;
  let query = `SELECT vp.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM daily_visit_plan vp
    JOIN customer c ON vp.customer_id = c.id
    JOIN salesman s ON vp.salesman_id = s.id WHERE 1=1`;
  const params = [];
  if (customer_id) { query += ' AND vp.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND vp.salesman_id = ?'; params.push(salesman_id); }
  if (date_from) { query += ' AND vp.visit_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND vp.visit_date <= ?'; params.push(date_to); }
  query += ' ORDER BY vp.visit_date DESC, vp.salesman_id, vp.slot_number ASC';
  const rawRows = db.prepare(query).all(...params);

  const filters = [];
  if (salesman_id) { const s = db.prepare('SELECT name FROM salesman WHERE id=?').get(salesman_id); if (s) filters.push({ label: 'Salesman', value: s.name }); }
  if (customer_id) { const c = db.prepare('SELECT company, name FROM customer WHERE id=?').get(customer_id); if (c) filters.push({ label: 'Customer', value: c.company || c.name }); }
  if (date_from) filters.push({ label: 'From', value: date_from });
  if (date_to) filters.push({ label: 'To', value: date_to });

  // Group by date+salesman for display
  const grouped = {};
  rawRows.forEach(r => {
    const key = `${r.visit_date}__${r.salesman_id}`;
    if (!grouped[key]) grouped[key] = { visit_date: r.visit_date, salesman_name: r.salesman_name, customers: [] };
    grouped[key].customers.push(r.customer_company || r.customer_name);
  });
  const rows = Object.values(grouped).sort((a, b) => b.visit_date.localeCompare(a.visit_date));

  generateListPDF(res, {
    title: 'Daily Visit Planning Report',
    filename: `VisitPlans_${new Date().toISOString().split('T')[0]}.pdf`,
    filters,
    columns: [
      { header: 'Date', key: 'visit_date', flex: 1.2, bold: true },
      { header: 'Salesman', key: 'salesman_name', flex: 1.5 },
      { header: 'Visits', key: 'visits', flex: 0.6 },
      { header: 'Customers Planned', key: 'customers_str', flex: 4 },
    ],
    rows: rows.map(r => ({
      ...r,
      visits: String(r.customers.length),
      customers_str: r.customers.join(', '),
    })),
  });
});

// Get a single visit plan
router.get('/:id', (req, res) => {
  const plan = db.prepare(`SELECT vp.*, c.name as customer_name, s.name as salesman_name
    FROM daily_visit_plan vp JOIN customer c ON vp.customer_id = c.id
    JOIN salesman s ON vp.salesman_id = s.id WHERE vp.id = ?`).get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Visit plan not found' });
  res.json(plan);
});

// Save visit plan for a date (bulk save — replaces all slots for that salesman+date)
router.post('/save', (req, res) => {
  const { visit_date, plans } = req.body;
  // plans = [{ customer_id, purpose, remark }, ...] — up to 8

  if (!visit_date) return res.status(400).json({ error: 'visit_date is required' });
  if (!plans || !Array.isArray(plans)) return res.status(400).json({ error: 'plans array is required' });
  if (plans.length > 8) return res.status(400).json({ error: 'Maximum 8 visits per day' });

  const salesman_id = req.user.id;

  // Check for at least one valid customer
  const validPlans = plans.filter(p => p.customer_id);
  if (validPlans.length === 0) return res.status(400).json({ error: 'At least one customer is required' });

  const saveTransaction = db.transaction(() => {
    // Delete existing plans for this salesman on this date
    db.prepare('DELETE FROM daily_visit_plan WHERE salesman_id = ? AND visit_date = ?')
      .run(salesman_id, visit_date);

    // Insert new plans
    const insert = db.prepare(
      `INSERT INTO daily_visit_plan (salesman_id, visit_date, customer_id, purpose, remark, slot_number)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    for (let i = 0; i < validPlans.length; i++) {
      const p = validPlans[i];
      insert.run(salesman_id, visit_date, p.customer_id, p.purpose || null, p.remark || null, i + 1);
    }
  });

  try {
    saveTransaction();
    // Return saved plans
    const saved = db.prepare(`SELECT vp.*, c.name as customer_name, c.company as customer_company,
      s.name as salesman_name FROM daily_visit_plan vp
      JOIN customer c ON vp.customer_id = c.id
      JOIN salesman s ON vp.salesman_id = s.id
      WHERE vp.salesman_id = ? AND vp.visit_date = ?
      ORDER BY vp.slot_number ASC`).all(salesman_id, visit_date);
    res.json({ message: 'Visit plan saved', plans: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save visit plan', details: err.message });
  }
});

// Create a single visit plan entry
router.post('/', (req, res) => {
  const { visit_date, customer_id, purpose, remark } = req.body;
  if (!visit_date || !customer_id) return res.status(400).json({ error: 'visit_date and customer_id are required' });

  // Check how many plans exist for this salesman+date
  const count = db.prepare('SELECT COUNT(*) as cnt FROM daily_visit_plan WHERE salesman_id = ? AND visit_date = ?')
    .get(req.user.id, visit_date).cnt;
  if (count >= 8) return res.status(400).json({ error: 'Maximum 8 visits per day reached' });

  const result = db.prepare(
    `INSERT INTO daily_visit_plan (salesman_id, visit_date, customer_id, purpose, remark, slot_number)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, visit_date, customer_id, purpose || null, remark || null, count + 1);

  res.status(201).json(db.prepare('SELECT * FROM daily_visit_plan WHERE id = ?').get(result.lastInsertRowid));
});

// Update a single visit plan
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_visit_plan WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Visit plan not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own visit plans' });
  }

  const { customer_id, purpose, remark } = req.body;
  db.prepare('UPDATE daily_visit_plan SET customer_id=?, purpose=?, remark=? WHERE id=?')
    .run(customer_id || existing.customer_id, purpose ?? existing.purpose, remark ?? existing.remark, req.params.id);

  res.json(db.prepare('SELECT * FROM daily_visit_plan WHERE id = ?').get(req.params.id));
});

// Delete a single visit plan
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can delete visit plans' });
  }
  const existing = db.prepare('SELECT * FROM daily_visit_plan WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Visit plan not found' });
  db.prepare('DELETE FROM daily_visit_plan WHERE id = ?').run(req.params.id);
  res.json({ message: 'Visit plan deleted' });
});

export default router;
