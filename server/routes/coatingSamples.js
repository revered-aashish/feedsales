import { Router } from 'express';
import db from '../db.js';
import { authenticate, adminOnly, regionClause } from '../middleware/auth.js';
import PDFDocument from 'pdfkit';

const router = Router();
router.use(authenticate);

// Editable data-sheet fields (everything the salesman fills in)
const SHEET_FIELDS = [
  'customer_id', 'client_name',
  'casting_weight', 'casting_thickness', 'metal_type', 'pouring_temperature', 'pouring_time', 'pouring_mode',
  'application', 'baume_as_is', 'dilution_ratio', 'viscosity_diluted', 'baume_diluted', 'wft_diluted', 'mixing_process', 'coating_layers',
  'binder_system', 'sand_afs', 'drying_method',
  'current_coating_used', 'current_coating_issues', 'approximate_consumption',
  'remarks',
];

function logAudit(sampleId, userId, action, details) {
  db.prepare('INSERT INTO coating_sample_audit (sample_id, user_id, action, details) VALUES (?, ?, ?, ?)')
    .run(sampleId, userId, action, details || null);
}

// ── List ───────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { salesman_id, customer_id, status, region } = req.query;
  let query = `SELECT cs.*, c.company AS customer_company, c.name AS customer_name,
    s.name AS salesman_name, rb.name AS recommended_by_name
    FROM coating_sample cs
    JOIN salesman s ON cs.salesman_id = s.id
    LEFT JOIN customer c ON cs.customer_id = c.id
    LEFT JOIN salesman rb ON cs.recommended_by = rb.id
    WHERE 1=1`;
  const params = [];

  const rc = regionClause(req.user, region);
  query += rc.sql; params.push(...rc.params);

  if (salesman_id) { query += ' AND cs.salesman_id = ?'; params.push(salesman_id); }
  if (customer_id) { query += ' AND cs.customer_id = ?'; params.push(customer_id); }
  if (status) { query += ' AND cs.status = ?'; params.push(status); }

  query += ' ORDER BY cs.created_at DESC';
  res.json(db.prepare(query).all(...params));
});

// ── Get single ───────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const sample = db.prepare(`SELECT cs.*, c.company AS customer_company, c.name AS customer_name,
    s.name AS salesman_name, rb.name AS recommended_by_name
    FROM coating_sample cs
    JOIN salesman s ON cs.salesman_id = s.id
    LEFT JOIN customer c ON cs.customer_id = c.id
    LEFT JOIN salesman rb ON cs.recommended_by = rb.id
    WHERE cs.id = ?`).get(req.params.id);
  if (!sample) return res.status(404).json({ error: 'Coating sample not found' });
  res.json(sample);
});

// ── Create (salesman) ────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const b = req.body;
  const cols = ['salesman_id', ...SHEET_FIELDS];
  const vals = [req.user.id, ...SHEET_FIELDS.map(f => (b[f] === '' || b[f] === undefined ? null : b[f]))];
  const placeholders = cols.map(() => '?').join(', ');

  const result = db.prepare(`INSERT INTO coating_sample (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
  logAudit(result.lastInsertRowid, req.user.id, 'created', 'Coating sample data sheet created');

  res.status(201).json(db.prepare('SELECT * FROM coating_sample WHERE id = ?').get(result.lastInsertRowid));
});

// ── Update sheet (owner or admin) ────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM coating_sample WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Coating sample not found' });
  if (req.user.role !== 'admin' && existing.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'You can only edit your own coating samples' });
  }

  const b = req.body;
  const sets = SHEET_FIELDS.map(f => `${f} = ?`).join(', ');
  const vals = SHEET_FIELDS.map(f => (b[f] !== undefined ? (b[f] === '' ? null : b[f]) : existing[f]));
  db.prepare(`UPDATE coating_sample SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...vals, req.params.id);
  logAudit(req.params.id, req.user.id, 'updated', 'Data sheet details updated');

  res.json(db.prepare('SELECT * FROM coating_sample WHERE id = ?').get(req.params.id));
});

// ── Admin recommendation ─────────────────────────────────────────────────────
router.put('/:id/recommend', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM coating_sample WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Coating sample not found' });

  const { recommended_product, recommendation_remarks } = req.body;
  if (!recommended_product || !recommended_product.trim()) {
    return res.status(400).json({ error: 'A recommended product is required' });
  }

  db.prepare(`UPDATE coating_sample SET recommended_product = ?, recommendation_remarks = ?,
    recommended_by = ?, recommended_at = datetime('now'), status = 'recommended', updated_at = datetime('now')
    WHERE id = ?`).run(recommended_product.trim(), recommendation_remarks || null, req.user.id, req.params.id);

  const action = existing.recommended_product ? 'recommendation_updated' : 'recommended';
  logAudit(req.params.id, req.user.id, action, `Recommended product: ${recommended_product.trim()}`);

  res.json(db.prepare('SELECT * FROM coating_sample WHERE id = ?').get(req.params.id));
});

// ── Audit log ────────────────────────────────────────────────────────────────
router.get('/:id/audit', (req, res) => {
  const sample = db.prepare('SELECT id FROM coating_sample WHERE id = ?').get(req.params.id);
  if (!sample) return res.status(404).json({ error: 'Coating sample not found' });

  const log = db.prepare(`SELECT a.*, s.name AS user_name, s.role AS user_role
    FROM coating_sample_audit a JOIN salesman s ON a.user_id = s.id
    WHERE a.sample_id = ? ORDER BY a.created_at DESC`).all(req.params.id);
  res.json(log);
});

// ── Delete (admin) ───────────────────────────────────────────────────────────
router.delete('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT id FROM coating_sample WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Coating sample not found' });
  db.prepare('DELETE FROM coating_sample_audit WHERE sample_id = ?').run(req.params.id);
  db.prepare('DELETE FROM coating_sample WHERE id = ?').run(req.params.id);
  res.json({ message: 'Coating sample deleted' });
});

// ── PDF download ─────────────────────────────────────────────────────────────
router.get('/:id/download/pdf', (req, res) => {
  const s = db.prepare(`SELECT cs.*, c.company AS customer_company, c.name AS customer_name,
    sm.name AS salesman_name, rb.name AS recommended_by_name
    FROM coating_sample cs
    JOIN salesman sm ON cs.salesman_id = sm.id
    LEFT JOIN customer c ON cs.customer_id = c.id
    LEFT JOIN salesman rb ON cs.recommended_by = rb.id
    WHERE cs.id = ?`).get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Coating sample not found' });

  const clientDisplay = s.client_name || s.customer_company || s.customer_name || '';
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const safeName = (clientDisplay || `sample_${s.id}`).replace(/[^a-zA-Z0-9_\- ]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Coating_Sample_${safeName}.pdf"`);
  doc.pipe(res);

  const M = 40;
  const pageW = doc.page.width - M * 2;
  const BRAND = '#1e1b4b', ACCENT = '#4338ca', GRAY = '#6b7280', DARK = '#1f2937';

  // Header band
  doc.rect(M, M, pageW, 60).fill(BRAND);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(18)
    .text('Coating Sample Data Sheet', M + 16, M + 12, { width: pageW - 32 });
  doc.fillColor('#c7d2fe').font('Helvetica').fontSize(8.5)
    .text('FEEDCHEM (INDIA) LTD.  ·  Plot No. 28 to 38, Gokul Industrial-C, J K Industrial Zone, Piplana, Rajkot 360030', M + 16, M + 38, { width: pageW - 32 });

  let y = M + 60 + 16;

  // Top meta row
  doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY).text('Client:', M, y, { continued: true })
    .font('Helvetica').fillColor(DARK).text('  ' + (clientDisplay || 'N/A'));
  doc.font('Helvetica-Bold').fillColor(GRAY).text('Salesman:', M + pageW / 2, y, { continued: true })
    .font('Helvetica').fillColor(DARK).text('  ' + (s.salesman_name || 'N/A'));
  y += 15;
  doc.font('Helvetica-Bold').fillColor(GRAY).text('Date:', M, y, { continued: true })
    .font('Helvetica').fillColor(DARK).text('  ' + (s.created_at ? s.created_at.split(' ')[0] : ''));
  doc.font('Helvetica-Bold').fillColor(GRAY).text('Status:', M + pageW / 2, y, { continued: true })
    .font('Helvetica').fillColor(DARK).text('  ' + (s.status === 'recommended' ? 'Recommended' : 'Pending'));
  y += 20;

  const colW = (pageW - 12) / 2;

  // Render a titled section of label/value pairs into a column starting at (x, startY). Returns end Y.
  const section = (title, rows, x, startY) => {
    let yy = startY;
    doc.rect(x, yy, colW, 18).fill('#eef2ff');
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9.5).text(title, x + 8, yy + 5, { width: colW - 16 });
    yy += 18;
    doc.font('Helvetica').fontSize(8.5);
    for (const [label, value] of rows) {
      const v = (value === null || value === undefined || value === '') ? '—' : String(value);
      const vh = doc.heightOfString(v, { width: colW * 0.55 - 10 });
      const rowH = Math.max(16, vh + 6);
      doc.fillColor(GRAY).font('Helvetica').text(label, x + 8, yy + 3, { width: colW * 0.45 - 10 });
      doc.fillColor(DARK).font('Helvetica-Bold').text(v, x + colW * 0.45, yy + 3, { width: colW * 0.55 - 10 });
      yy += rowH;
      doc.moveTo(x, yy).lineTo(x + colW, yy).strokeColor('#f0f0f4').lineWidth(0.5).stroke();
    }
    return yy;
  };

  const leftTop = y, rightTop = y;
  const leftEnd = section('CASTING DETAILS', [
    ['Weight of Casting (Kg)', s.casting_weight],
    ['Casting Thickness (mm)', s.casting_thickness],
    ['Metal Type', s.metal_type],
    ['Pouring Temperature (°C)', s.pouring_temperature],
    ['Pouring Time', s.pouring_time],
    ['Pouring Mode', s.pouring_mode],
  ], M, leftTop);

  const rightEnd = section('MOULD SECTION', [
    ['Binder System', s.binder_system],
    ['Sand AFS', s.sand_afs],
    ['Drying Method', s.drying_method],
  ], M + colW + 12, rightTop);

  y = Math.max(leftEnd, rightEnd) + 12;

  const leftEnd2 = section('COATING SECTION', [
    ['Application', s.application],
    ['Baume (As It Is)', s.baume_as_is],
    ['Dilution Ratio', s.dilution_ratio],
    ['Viscosity (Diluted)', s.viscosity_diluted],
    ['Baume (Diluted)', s.baume_diluted],
    ['WFT (Diluted / Micron)', s.wft_diluted],
    ['Mixing Process', s.mixing_process],
    ['No. of Coating Layers', s.coating_layers],
  ], M, y);

  const rightEnd2 = section('CURRENT COATING', [
    ['Current Coating Used', s.current_coating_used],
    ['Issues in Current Coating', s.current_coating_issues],
    ['Approximate Consumption', s.approximate_consumption],
  ], M + colW + 12, y);

  y = Math.max(leftEnd2, rightEnd2) + 12;

  // Remarks (full width)
  doc.rect(M, y, pageW, 18).fill('#eef2ff');
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9.5).text('REMARKS', M + 8, y + 5);
  y += 22;
  doc.fillColor(DARK).font('Helvetica').fontSize(9).text(s.remarks || '—', M + 8, y, { width: pageW - 16 });
  y += doc.heightOfString(s.remarks || '—', { width: pageW - 16 }) + 14;

  // Recommendation (full width, highlighted)
  doc.rect(M, y, pageW, 18).fill('#dcfce7');
  doc.fillColor('#15803d').font('Helvetica-Bold').fontSize(9.5).text('FEEDCHEM RECOMMENDATION', M + 8, y + 5);
  y += 22;
  doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text('Recommended Product', M + 8, y, { width: colW * 0.45 });
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text(s.recommended_product || '— Not yet recommended —', M + colW * 0.45, y, { width: pageW - colW * 0.45 - 8 });
  y += 18;
  if (s.recommendation_remarks) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text('Remarks', M + 8, y, { width: colW * 0.45 });
    doc.fillColor(DARK).font('Helvetica').fontSize(9).text(s.recommendation_remarks, M + colW * 0.45, y, { width: pageW - colW * 0.45 - 8 });
    y += doc.heightOfString(s.recommendation_remarks, { width: pageW - colW * 0.45 - 8 }) + 6;
  }
  if (s.recommended_by_name) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(8).text(`Recommended by ${s.recommended_by_name}${s.recommended_at ? ' on ' + s.recommended_at.split(' ')[0] : ''}`, M + 8, y);
    y += 16;
  }

  // Footer
  const fy = doc.page.height - 40;
  doc.moveTo(M, fy).lineTo(M + pageW, fy).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.fillColor('#9ca3af').font('Helvetica').fontSize(7.5)
    .text('Feedchem (India) Ltd.  ·  marketing@feedchem.co.in  ·  +91 81400 03456', M, fy + 6, { width: pageW, align: 'center' });

  doc.end();
});

export default router;
