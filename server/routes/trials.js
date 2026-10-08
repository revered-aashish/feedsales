import { Router } from 'express';
import db from '../db.js';
import { authenticate, regionClause } from '../middleware/auth.js';
import { generateListPDF } from '../utils/pdfReport.js';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const dbPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', process.env.DB_PATH || './data/feedsales.db');
const uploadsDir = path.join(path.dirname(dbPath), 'uploads');

const momUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      cb(null, `trial_${req.params.id}_mom_${Date.now()}.pdf`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { customer_id, salesman_id, status, date_from, date_to, region } = req.query;
  let query = `SELECT t.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM trial t
    JOIN customer c ON t.customer_id = c.id
    JOIN salesman s ON t.salesman_id = s.id WHERE 1=1`;
  const params = [];

  const rc = regionClause(req.user, region);
  query += rc.sql; params.push(...rc.params);

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
  if (existing.mom_path) {
    const f = path.join(uploadsDir, existing.mom_path);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  db.prepare('DELETE FROM trial WHERE id = ?').run(req.params.id);
  res.json({ message: 'Trial deleted' });
});

// Generate a Minutes of Meeting PDF from the trial details
router.get('/:id/download/pdf', (req, res) => {
  const t = db.prepare(`
    SELECT t.*, c.name as customer_name, c.company as customer_company, c.city as customer_city,
      s.name as salesman_name, s.email as salesman_email
    FROM trial t
    JOIN customer c ON t.customer_id = c.id
    JOIN salesman s ON t.salesman_id = s.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Trial not found' });

  const fmt = (d) => { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : (d || 'N/A'); };
  const company = t.customer_company || t.customer_name;
  const statusLabel = t.status.charAt(0).toUpperCase() + t.status.slice(1).replace('_', ' ');

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="MOM_Trial_${(company || '').replace(/[^a-zA-Z0-9]/g, '_')}_${t.id}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - 100;

  doc.moveTo(50, 45).lineTo(50 + pageWidth, 45).strokeColor('#4338ca').lineWidth(3).stroke();
  doc.fontSize(22).fillColor('#312e81').font('Helvetica-Bold')
    .text('Feedchem (India) Limited', 50, 55, { align: 'center', width: pageWidth });
  doc.fontSize(12).fillColor('#6366f1').font('Helvetica')
    .text('Minutes of Meeting - Product Trial', 50, 82, { align: 'center', width: pageWidth });
  doc.moveTo(50, 100).lineTo(50 + pageWidth, 100).strokeColor('#4338ca').lineWidth(1).stroke();

  let y = 115;
  doc.roundedRect(50, y, pageWidth, 110, 5).fillAndStroke('#f5f3ff', '#c7d2fe');
  y += 12;
  const drawField = (label, value, lx, vx, yPos) => {
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text(label, lx, yPos);
    doc.fontSize(10).fillColor('#1f2937').font('Helvetica').text(value || 'N/A', vx, yPos, { width: 140 });
  };
  drawField('Company:', company, 65, 150, y);
  drawField('Status:', statusLabel, 310, 390, y);
  y += 20;
  drawField('Location:', t.customer_city, 65, 150, y);
  drawField('Salesman:', t.salesman_name, 310, 390, y);
  y += 20;
  drawField('Product:', t.product, 65, 150, y);
  drawField('Quantity:', t.quantity, 310, 390, y);
  y += 20;
  drawField('Start Date:', fmt(t.start_date), 65, 150, y);
  drawField('End Date:', fmt(t.end_date), 310, 390, y);

  y = 115 + 110 + 20;
  const section = (title, text) => {
    doc.fontSize(11).fillColor('#312e81').font('Helvetica-Bold').text(title, 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(10).fillColor('#374151').font('Helvetica').text(text, 55, y, { width: pageWidth - 10 });
    y += doc.heightOfString(text, { width: pageWidth - 10 }) + 15;
  };
  section('Trial Details', `Trial of ${t.product} at ${company}${t.quantity ? ` (${t.quantity})` : ''}. Current status: ${statusLabel}.`);
  section('Discussion / Notes', t.notes || 'No notes recorded.');

  const footerY = doc.page.height - 50;
  doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
    .text(`Generated on ${fmt(new Date().toISOString())} | Feedchem (India) Limited | Confidential`, 50, footerY - 12, { align: 'center', width: pageWidth, lineBreak: false });

  doc.end();
});

// Upload MoM PDF for a trial
router.post('/:id/upload-mom', (req, res) => {
  const existing = db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Trial not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id)
    return res.status(403).json({ error: 'You can only upload MoM for your own trials' });

  momUpload.single('mom')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (existing.mom_path) {
      const old = path.join(uploadsDir, existing.mom_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    db.prepare('UPDATE trial SET mom_path = ? WHERE id = ?').run(req.file.filename, req.params.id);
    res.json({ message: 'MoM uploaded', mom_path: req.file.filename });
  });
});

// Download the uploaded MoM PDF
router.get('/:id/mom', (req, res) => {
  const trial = db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id);
  if (!trial) return res.status(404).json({ error: 'Trial not found' });
  if (!trial.mom_path) return res.status(404).json({ error: 'No MoM uploaded for this trial' });

  const filePath = path.join(uploadsDir, trial.mom_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="MoM_Trial_${trial.id}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

// Delete the uploaded MoM PDF
router.delete('/:id/mom', (req, res) => {
  const trial = db.prepare('SELECT * FROM trial WHERE id = ?').get(req.params.id);
  if (!trial) return res.status(404).json({ error: 'Trial not found' });
  if (req.user.role !== 'admin' && trial.salesman_id !== req.user.id)
    return res.status(403).json({ error: 'You can only delete MoM for your own trials' });
  if (!trial.mom_path) return res.status(404).json({ error: 'No MoM to delete' });

  const filePath = path.join(uploadsDir, trial.mom_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('UPDATE trial SET mom_path = NULL WHERE id = ?').run(req.params.id);
  res.json({ message: 'MoM deleted' });
});

export default router;
