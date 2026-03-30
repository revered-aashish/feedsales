import { Router } from 'express';
import XLSX from 'xlsx';
import PDFDocument from 'pdfkit';
import db from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List all products
router.get('/', (req, res) => {
  const { search, category, is_active } = req.query;
  let query = 'SELECT * FROM product WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR category LIKE ? OR hsn_code LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (is_active !== undefined) { query += ' AND is_active = ?'; params.push(is_active); }

  query += ' ORDER BY name ASC';
  res.json(db.prepare(query).all(...params));
});

// Get all unique categories
router.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT DISTINCT category FROM product WHERE category IS NOT NULL ORDER BY category').all();
  res.json(categories.map(c => c.category));
});

// Download as Excel
router.get('/download/excel', (req, res) => {
  try {
    const products = db.prepare('SELECT name, category, description, unit, price, hsn_code, is_active, created_at FROM product ORDER BY name').all();

    const data = products.map(p => ({
      'Product Name': p.name,
      'Category': p.category || '',
      'Description': p.description || '',
      'Unit': p.unit || '',
      'Price': p.price || '',
      'HSN Code': p.hsn_code || '',
      'Status': p.is_active ? 'Active' : 'Inactive',
      'Created': p.created_at || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 25 }, { wch: 18 }, { wch: 35 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=FeedSales_Products.xlsx');
    res.send(Buffer.from(buf));
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate Excel', details: err.message });
  }
});

// Download as PDF
router.get('/download/pdf', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM product ORDER BY name').all();

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=FeedSales_Products.pdf');
    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('FeedSales - Product List', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#666')
      .text(`Generated on ${new Date().toLocaleDateString('en-IN')} | Total: ${products.length} products`, { align: 'center' });
    doc.moveDown(1);

    // Table header
    const startX = 40;
    let y = doc.y;
    const colWidths = [30, 160, 100, 180, 50, 70, 80, 60];
    const headers = ['#', 'Product Name', 'Category', 'Description', 'Unit', 'Price', 'HSN Code', 'Status'];

    doc.fillColor('#312e81').rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 22).fill();
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);

    let x = startX + 5;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 6, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });
    y += 25;

    // Table rows
    doc.font('Helvetica').fontSize(8).fillColor('#333');
    products.forEach((p, idx) => {
      if (y > 520) {
        doc.addPage();
        y = 40;
      }

      // Alternate row bg
      if (idx % 2 === 0) {
        doc.fillColor('#f5f5ff').rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 20).fill();
      }

      doc.fillColor('#333');
      x = startX + 5;
      const row = [
        String(idx + 1),
        p.name || '',
        p.category || '',
        (p.description || '').substring(0, 40),
        p.unit || '',
        p.price ? `Rs.${p.price}` : '',
        p.hsn_code || '',
        p.is_active ? 'Active' : 'Inactive'
      ];

      row.forEach((val, i) => {
        doc.text(val, x, y + 5, { width: colWidths[i] - 10 });
        x += colWidths[i];
      });
      y += 20;
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
});

// Get single product
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

// Create product (admin only)
router.post('/', adminOnly, (req, res) => {
  const { name, category, description, unit, price, hsn_code } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  const result = db.prepare(
    'INSERT INTO product (name, category, description, unit, price, hsn_code) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, category || null, description || null, unit || 'kg', price || null, hsn_code || null);

  res.status(201).json(db.prepare('SELECT * FROM product WHERE id = ?').get(result.lastInsertRowid));
});

// Update product (admin only)
router.put('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const { name, category, description, unit, price, hsn_code, is_active } = req.body;
  db.prepare(
    'UPDATE product SET name=?, category=?, description=?, unit=?, price=?, hsn_code=?, is_active=? WHERE id=?'
  ).run(name || existing.name, category ?? existing.category, description ?? existing.description,
    unit || existing.unit, price ?? existing.price, hsn_code ?? existing.hsn_code,
    is_active ?? existing.is_active, req.params.id);

  res.json(db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id));
});

// Delete product (admin only)
router.delete('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.prepare('DELETE FROM product WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted' });
});

export default router;
