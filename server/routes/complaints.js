import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';
import { generateListPDF } from '../utils/pdfReport.js';
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
      cb(null, `complaint_${req.params.id}_mom_${Date.now()}.pdf`);
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
  const { customer_id, salesman_id, status, date_from, date_to } = req.query;
  let query = `SELECT co.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name,
    (SELECT COUNT(*) FROM complaint_comment cc WHERE cc.complaint_id = co.id) as comment_count
    FROM complaint co
    JOIN customer c ON co.customer_id = c.id
    JOIN salesman s ON co.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND co.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND co.salesman_id = ?'; params.push(salesman_id); }
  if (status) { query += ' AND co.status = ?'; params.push(status); }
  if (date_from) { query += ' AND co.created_at >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND co.created_at <= ?'; params.push(date_to + ' 23:59:59'); }

  query += ' ORDER BY co.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/export/pdf', (req, res) => {
  const { customer_id, salesman_id, status, date_from, date_to } = req.query;
  let query = `SELECT co.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name FROM complaint co
    JOIN customer c ON co.customer_id = c.id
    JOIN salesman s ON co.salesman_id = s.id WHERE 1=1`;
  const params = [];
  if (customer_id) { query += ' AND co.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND co.salesman_id = ?'; params.push(salesman_id); }
  if (status) { query += ' AND co.status = ?'; params.push(status); }
  if (date_from) { query += ' AND co.created_at >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND co.created_at <= ?'; params.push(date_to + ' 23:59:59'); }
  query += ' ORDER BY co.created_at DESC';
  const rows = db.prepare(query).all(...params);

  const filters = [];
  if (salesman_id) { const s = db.prepare('SELECT name FROM salesman WHERE id=?').get(salesman_id); if (s) filters.push({ label: 'Salesman', value: s.name }); }
  if (customer_id) { const c = db.prepare('SELECT company, name FROM customer WHERE id=?').get(customer_id); if (c) filters.push({ label: 'Customer', value: c.company || c.name }); }
  if (status) filters.push({ label: 'Status', value: status.replace('_', ' ') });
  if (date_from) filters.push({ label: 'From', value: date_from });
  if (date_to) filters.push({ label: 'To', value: date_to });

  const statusBadge = (v) => ({
    open: { bg: '#fee2e2', fg: '#b91c1c' },
    in_progress: { bg: '#dbeafe', fg: '#1d4ed8' },
    resolved: { bg: '#dcfce7', fg: '#15803d' },
  }[v]);

  generateListPDF(res, {
    title: 'Complaints Report',
    filename: `Complaints_${new Date().toISOString().split('T')[0]}.pdf`,
    filters,
    columns: [
      { header: 'Customer', key: 'customer', flex: 2, bold: true },
      { header: 'Subject', key: 'subject', flex: 2.5 },
      { header: 'Status', key: 'status', flex: 1, badge: statusBadge },
      { header: 'Date', key: 'date', flex: 1 },
      { header: 'Salesman', key: 'salesman_name', flex: 1.5 },
    ],
    rows: rows.map(r => ({
      ...r,
      customer: r.customer_company || r.customer_name,
      date: r.created_at ? r.created_at.split('T')[0] : '',
    })),
  });
});

router.get('/:id', (req, res) => {
  const complaint = db.prepare(`SELECT co.*, c.name as customer_name, c.company as customer_company, s.name as salesman_name
    FROM complaint co JOIN customer c ON co.customer_id = c.id
    JOIN salesman s ON co.salesman_id = s.id WHERE co.id = ?`).get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  res.json(complaint);
});

router.post('/', (req, res) => {
  const { customer_id, subject, description } = req.body;
  if (!customer_id || !subject) return res.status(400).json({ error: 'customer_id and subject are required' });

  const result = db.prepare(
    `INSERT INTO complaint (customer_id, salesman_id, subject, description) VALUES (?, ?, ?, ?)`
  ).run(customer_id, req.user.id, subject, description || null);

  res.status(201).json(db.prepare('SELECT * FROM complaint WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own complaints' });
  }

  const { subject, description, status, resolution } = req.body;
  db.prepare(
    `UPDATE complaint SET subject=?, description=?, status=?, resolution=? WHERE id=?`
  ).run(subject || existing.subject, description ?? existing.description,
    status || existing.status, resolution ?? existing.resolution, req.params.id);

  res.json(db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id));
});

// Delete complaint — admin only
router.delete('/:id', (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can delete complaints' });
  }
  const existing = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });
  // Clean up uploaded MoM file
  if (existing.mom_path) {
    const f = path.join(uploadsDir, existing.mom_path);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  db.prepare('DELETE FROM complaint_comment WHERE complaint_id = ?').run(req.params.id);
  db.prepare('DELETE FROM complaint WHERE id = ?').run(req.params.id);
  res.json({ message: 'Complaint deleted' });
});

// --- Comments ---

router.get('/:id/comments', (req, res) => {
  const complaint = db.prepare('SELECT id FROM complaint WHERE id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const comments = db.prepare(`
    SELECT cc.*, s.name as user_name, s.role as user_role
    FROM complaint_comment cc
    JOIN salesman s ON cc.user_id = s.id
    WHERE cc.complaint_id = ?
    ORDER BY cc.created_at ASC
  `).all(req.params.id);

  res.json(comments);
});

router.post('/:id/comments', (req, res) => {
  const complaint = db.prepare('SELECT id FROM complaint WHERE id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const { comment } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'Comment is required' });

  const result = db.prepare(
    'INSERT INTO complaint_comment (complaint_id, user_id, comment) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, comment.trim());

  const saved = db.prepare(`
    SELECT cc.*, s.name as user_name, s.role as user_role
    FROM complaint_comment cc
    JOIN salesman s ON cc.user_id = s.id
    WHERE cc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(saved);
});

// --- PDF Download ---

router.get('/:id/download/pdf', (req, res) => {
  const complaint = db.prepare(`
    SELECT co.*, c.name as customer_name, c.company as customer_company, c.city as customer_city,
      s.name as salesman_name, s.email as salesman_email
    FROM complaint co
    JOIN customer c ON co.customer_id = c.id
    JOIN salesman s ON co.salesman_id = s.id
    WHERE co.id = ?
  `).get(req.params.id);

  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

  const comments = db.prepare(`
    SELECT cc.*, s.name as user_name, s.role as user_role
    FROM complaint_comment cc JOIN salesman s ON cc.user_id = s.id
    WHERE cc.complaint_id = ? ORDER BY cc.created_at ASC
  `).all(req.params.id);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const companyName = (complaint.customer_company || complaint.customer_name || '').replace(/[^a-zA-Z0-9]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Complaint_${companyName}_${complaint.id}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - 100;

  // Header
  doc.moveTo(50, 45).lineTo(50 + pageWidth, 45).strokeColor('#4338ca').lineWidth(3).stroke();
  doc.fontSize(22).fillColor('#312e81').font('Helvetica-Bold')
    .text('Feedchem (India) Limited', 50, 55, { align: 'center', width: pageWidth });
  doc.fontSize(12).fillColor('#6366f1').font('Helvetica')
    .text('Complaint Report', 50, 82, { align: 'center', width: pageWidth });
  doc.moveTo(50, 100).lineTo(50 + pageWidth, 100).strokeColor('#4338ca').lineWidth(1).stroke();

  let y = 115;

  // Details box
  doc.roundedRect(50, y, pageWidth, 70, 5).fillAndStroke('#f5f3ff', '#c7d2fe');
  y += 12;

  const labelX = 65, valueX = 170, labelX2 = 310, valueX2 = 400;
  const drawField = (label, value, lx, vx, yPos) => {
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text(label, lx, yPos);
    doc.fontSize(10).fillColor('#1f2937').font('Helvetica').text(value || 'N/A', vx, yPos, { width: 150 });
  };

  drawField('Company:', complaint.customer_company || complaint.customer_name, labelX, valueX, y);
  drawField('Status:', complaint.status.charAt(0).toUpperCase() + complaint.status.slice(1).replace('_', ' '), labelX2, valueX2, y);
  y += 20;
  drawField('Salesman:', complaint.salesman_name, labelX, valueX, y);
  drawField('Date:', complaint.created_at?.split('T')[0] || complaint.created_at?.split(' ')[0], labelX2, valueX2, y);

  y = 115 + 70 + 20;

  // Subject
  doc.fontSize(11).fillColor('#312e81').font('Helvetica-Bold').text('Subject', 50, y);
  y += 18;
  doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  y += 8;
  doc.fontSize(10).fillColor('#374151').font('Helvetica').text(complaint.subject, 55, y, { width: pageWidth - 10 });
  y += doc.heightOfString(complaint.subject, { width: pageWidth - 10 }) + 15;

  // Description
  if (complaint.description) {
    doc.fontSize(11).fillColor('#312e81').font('Helvetica-Bold').text('Description', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(10).fillColor('#374151').font('Helvetica').text(complaint.description, 55, y, { width: pageWidth - 10 });
    y += doc.heightOfString(complaint.description, { width: pageWidth - 10 }) + 15;
  }

  // Resolution
  if (complaint.resolution) {
    doc.fontSize(11).fillColor('#16a34a').font('Helvetica-Bold').text('Resolution', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(10).fillColor('#374151').font('Helvetica').text(complaint.resolution, 55, y, { width: pageWidth - 10 });
    y += doc.heightOfString(complaint.resolution, { width: pageWidth - 10 }) + 15;
  }

  // Comments
  if (comments.length > 0) {
    doc.fontSize(11).fillColor('#312e81').font('Helvetica-Bold').text('Comments & Follow-up', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 10;

    for (const c of comments) {
      if (y > 720) { doc.addPage(); y = 50; }
      const timestamp = c.created_at?.replace('T', ' ').substring(0, 16) || '';
      doc.fontSize(9).fillColor('#6366f1').font('Helvetica-Bold')
        .text(`${c.user_name}${c.user_role === 'admin' ? ' (Admin)' : ''}`, 55, y, { continued: true })
        .fillColor('#9ca3af').font('Helvetica').text(`  ${timestamp}`);
      y += 14;
      doc.fontSize(10).fillColor('#374151').font('Helvetica').text(c.comment, 60, y, { width: pageWidth - 20 });
      y += doc.heightOfString(c.comment, { width: pageWidth - 20 }) + 12;
    }
  }

  // Footer
  const footerY = doc.page.height - 50;
  doc.moveTo(50, footerY).lineTo(50 + pageWidth, footerY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.fontSize(8).fillColor('#9ca3af').font('Helvetica')
    .text(`Generated on ${new Date().toISOString().split('T')[0]} | Feedchem (India) Limited | Confidential`, 50, footerY + 8, { align: 'center', width: pageWidth });

  doc.end();
});

// Upload MoM PDF for a complaint
router.post('/:id/upload-mom', (req, res) => {
  const existing = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Complaint not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id)
    return res.status(403).json({ error: 'You can only upload MoM for your own complaints' });

  momUpload.single('mom')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Delete old MoM file if it exists
    if (existing.mom_path) {
      const old = path.join(uploadsDir, existing.mom_path);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }

    db.prepare('UPDATE complaint SET mom_path = ? WHERE id = ?').run(req.file.filename, req.params.id);
    res.json({ message: 'MoM uploaded', mom_path: req.file.filename });
  });
});

// Download the uploaded MoM PDF
router.get('/:id/mom', (req, res) => {
  const complaint = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  if (!complaint.mom_path) return res.status(404).json({ error: 'No MoM uploaded for this complaint' });

  const filePath = path.join(uploadsDir, complaint.mom_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });

  const safeName = (complaint.customer_company || complaint.customer_name || `complaint_${complaint.id}`).replace(/[^a-zA-Z0-9_\- ]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="MoM_${safeName}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

// Delete the uploaded MoM PDF
router.delete('/:id/mom', (req, res) => {
  const complaint = db.prepare('SELECT * FROM complaint WHERE id = ?').get(req.params.id);
  if (!complaint) return res.status(404).json({ error: 'Complaint not found' });
  if (req.user.role !== 'admin' && complaint.salesman_id !== req.user.id)
    return res.status(403).json({ error: 'You can only delete MoM for your own complaints' });
  if (!complaint.mom_path) return res.status(404).json({ error: 'No MoM to delete' });

  const filePath = path.join(uploadsDir, complaint.mom_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('UPDATE complaint SET mom_path = NULL WHERE id = ?').run(req.params.id);
  res.json({ message: 'MoM deleted' });
});

export default router;
