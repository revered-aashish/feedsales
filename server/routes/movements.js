import { Router } from 'express';
import db from '../db.js';
import { authenticate } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { salesman_id, visit_date, customer_id, date_from, date_to, is_issue } = req.query;
  let query = `SELECT dm.*, c.name as customer_name, c.company as customer_company,
    s.name as salesman_name,
    (SELECT COUNT(*) FROM movement_comment mc WHERE mc.movement_id = dm.id) as comment_count
    FROM daily_movement dm
    JOIN customer c ON dm.customer_id = c.id
    JOIN salesman s ON dm.salesman_id = s.id WHERE 1=1`;
  const params = [];

  if (customer_id) { query += ' AND dm.customer_id = ?'; params.push(customer_id); }
  if (salesman_id) { query += ' AND dm.salesman_id = ?'; params.push(salesman_id); }
  if (visit_date) { query += ' AND dm.visit_date = ?'; params.push(visit_date); }
  if (date_from) { query += ' AND dm.visit_date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND dm.visit_date <= ?'; params.push(date_to); }
  if (is_issue !== undefined) { query += ' AND dm.is_issue = ?'; params.push(is_issue); }
  if (req.user.role !== 'admin') { query += ' AND dm.salesman_id = ?'; params.push(req.user.id); }

  query += ' ORDER BY dm.visit_date DESC, dm.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const movement = db.prepare(`SELECT dm.*, c.name as customer_name, s.name as salesman_name
    FROM daily_movement dm JOIN customer c ON dm.customer_id = c.id
    JOIN salesman s ON dm.salesman_id = s.id WHERE dm.id = ?`).get(req.params.id);
  if (!movement) return res.status(404).json({ error: 'Movement not found' });
  res.json(movement);
});

router.post('/', (req, res) => {
  const { customer_id, visit_date, purpose, location, notes, status, is_issue } = req.body;
  if (!customer_id || !visit_date || !purpose) {
    return res.status(400).json({ error: 'customer_id, visit_date, and purpose are required' });
  }

  const result = db.prepare(
    `INSERT INTO daily_movement (customer_id, salesman_id, visit_date, purpose, location, notes, status, is_issue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(customer_id, req.user.id, visit_date, purpose, location || null, notes || null, status || 'planned', is_issue ? 1 : 0);

  res.status(201).json(db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movement not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only update your own movements' });
  }

  const { customer_id, visit_date, purpose, location, notes, status, is_issue } = req.body;
  db.prepare(
    `UPDATE daily_movement SET customer_id=?, visit_date=?, purpose=?, location=?, notes=?, status=?, is_issue=? WHERE id=?`
  ).run(customer_id || existing.customer_id, visit_date || existing.visit_date,
    purpose || existing.purpose, location ?? existing.location,
    notes ?? existing.notes, status || existing.status,
    is_issue !== undefined ? (is_issue ? 1 : 0) : existing.is_issue,
    req.params.id);

  res.json(db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Movement not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only delete your own movements' });
  }
  db.prepare('DELETE FROM movement_comment WHERE movement_id = ?').run(req.params.id);
  db.prepare('DELETE FROM daily_movement WHERE id = ?').run(req.params.id);
  res.json({ message: 'Movement deleted' });
});

// --- Comments ---

// Get comments for a movement
router.get('/:id/comments', (req, res) => {
  const movement = db.prepare('SELECT id FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!movement) return res.status(404).json({ error: 'Movement not found' });

  const comments = db.prepare(`
    SELECT mc.*, s.name as user_name, s.role as user_role
    FROM movement_comment mc
    JOIN salesman s ON mc.user_id = s.id
    WHERE mc.movement_id = ?
    ORDER BY mc.created_at ASC
  `).all(req.params.id);

  res.json(comments);
});

// Add a comment to a movement
router.post('/:id/comments', (req, res) => {
  const movement = db.prepare('SELECT id FROM daily_movement WHERE id = ?').get(req.params.id);
  if (!movement) return res.status(404).json({ error: 'Movement not found' });

  const { comment } = req.body;
  if (!comment || !comment.trim()) return res.status(400).json({ error: 'Comment is required' });

  const result = db.prepare(
    'INSERT INTO movement_comment (movement_id, user_id, comment) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, comment.trim());

  const saved = db.prepare(`
    SELECT mc.*, s.name as user_name, s.role as user_role
    FROM movement_comment mc
    JOIN salesman s ON mc.user_id = s.id
    WHERE mc.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(saved);
});

// --- MOM PDF Download ---
router.get('/:id/download/pdf', (req, res) => {
  const movement = db.prepare(`
    SELECT dm.*, c.name as customer_name, c.company as customer_company, c.city as customer_city,
      s.name as salesman_name, s.email as salesman_email
    FROM daily_movement dm
    JOIN customer c ON dm.customer_id = c.id
    JOIN salesman s ON dm.salesman_id = s.id
    WHERE dm.id = ?
  `).get(req.params.id);

  if (!movement) return res.status(404).json({ error: 'Movement not found' });

  const comments = db.prepare(`
    SELECT mc.*, s.name as user_name, s.role as user_role
    FROM movement_comment mc JOIN salesman s ON mc.user_id = s.id
    WHERE mc.movement_id = ? ORDER BY mc.created_at ASC
  `).all(req.params.id);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="MOM_${movement.visit_date}_${movement.customer_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width - 100;

  // Header line
  doc.moveTo(50, 45).lineTo(50 + pageWidth, 45).strokeColor('#4338ca').lineWidth(3).stroke();

  // Company name
  doc.fontSize(22).fillColor('#312e81').font('Helvetica-Bold')
    .text('Feedchem (India) Limited', 50, 55, { align: 'center', width: pageWidth });

  // Subtitle
  doc.fontSize(12).fillColor('#6366f1').font('Helvetica')
    .text('Minutes of Meeting', 50, 82, { align: 'center', width: pageWidth });

  // Line below header
  doc.moveTo(50, 100).lineTo(50 + pageWidth, 100).strokeColor('#4338ca').lineWidth(1).stroke();

  let y = 115;

  // Meeting details box
  doc.roundedRect(50, y, pageWidth, 90, 5).fillAndStroke('#f5f3ff', '#c7d2fe');
  y += 12;

  const labelX = 65;
  const valueX = 170;
  const labelX2 = 310;
  const valueX2 = 400;

  const drawField = (label, value, lx, vx, yPos) => {
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica-Bold').text(label, lx, yPos);
    doc.fontSize(10).fillColor('#1f2937').font('Helvetica').text(value || 'N/A', vx, yPos, { width: 150 });
  };

  drawField('Date:', movement.visit_date, labelX, valueX, y);
  drawField('Status:', movement.status.charAt(0).toUpperCase() + movement.status.slice(1), labelX2, valueX2, y);
  y += 20;
  drawField('Customer:', movement.customer_name, labelX, valueX, y);
  drawField('Company:', movement.customer_company || 'N/A', labelX2, valueX2, y);
  y += 20;
  drawField('Location:', movement.location || movement.customer_city || 'N/A', labelX, valueX, y);
  drawField('Salesman:', movement.salesman_name, labelX2, valueX2, y);

  y = 115 + 90 + 20;

  // Purpose section
  doc.fontSize(11).fillColor('#312e81').font('Helvetica-Bold').text('Purpose of Visit', 50, y);
  y += 18;
  doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  y += 8;
  doc.fontSize(10).fillColor('#374151').font('Helvetica').text(movement.purpose, 55, y, { width: pageWidth - 10 });
  y += doc.heightOfString(movement.purpose, { width: pageWidth - 10 }) + 15;

  // Notes section
  if (movement.notes) {
    doc.fontSize(11).fillColor('#312e81').font('Helvetica-Bold').text('Discussion / Notes', 50, y);
    y += 18;
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    y += 8;
    doc.fontSize(10).fillColor('#374151').font('Helvetica').text(movement.notes, 55, y, { width: pageWidth - 10 });
    y += doc.heightOfString(movement.notes, { width: pageWidth - 10 }) + 15;
  }

  // Issue flag
  if (movement.is_issue) {
    doc.roundedRect(50, y, pageWidth, 28, 4).fillAndStroke('#fff7ed', '#fdba74');
    doc.fontSize(10).fillColor('#c2410c').font('Helvetica-Bold')
      .text('⚠ This visit has been flagged as a potential issue', 65, y + 8, { width: pageWidth - 30 });
    y += 40;
  }

  // Comments section
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

export default router;
