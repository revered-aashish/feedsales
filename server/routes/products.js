import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db.js';
import { authenticate, adminOnly } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
router.use(authenticate);

// Configure multer for PDF uploads
const dbPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', process.env.DB_PATH || './data/feedsales.db');
const uploadsDir = path.join(path.dirname(dbPath), 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max
});

const uploadFields = upload.fields([
  { name: 'pds', maxCount: 1 },
  { name: 'msds', maxCount: 1 }
]);

// List all products
router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM product WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name ASC';
  res.json(db.prepare(query).all(...params));
});

// Download a file (PDS or MSDS)
router.get('/:id/download/:type', (req, res) => {
  const { id, type } = req.params;
  if (!['pds', 'msds'].includes(type)) return res.status(400).json({ error: 'Invalid file type' });

  const product = db.prepare('SELECT * FROM product WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const filePath = type === 'pds' ? product.pds_path : product.msds_path;
  if (!filePath) return res.status(404).json({ error: `No ${type.toUpperCase()} file uploaded for this product` });

  const fullPath = path.join(uploadsDir, filePath);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found on server' });

  const label = type.toUpperCase();
  const safeName = product.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_${label}.pdf"`);
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(fullPath).pipe(res);
});

// Create product (admin only) — with file uploads
router.post('/', adminOnly, (req, res) => {
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });

    const pdsFile = req.files?.pds?.[0]?.filename || null;
    const msdsFile = req.files?.msds?.[0]?.filename || null;

    const result = db.prepare(
      'INSERT INTO product (name, pds_path, msds_path) VALUES (?, ?, ?)'
    ).run(name, pdsFile, msdsFile);

    res.status(201).json(db.prepare('SELECT * FROM product WHERE id = ?').get(result.lastInsertRowid));
  });
});

// Update product (admin only) — with file uploads
router.put('/:id', adminOnly, (req, res) => {
  uploadFields(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const existing = db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const { name } = req.body;
    let pdsPath = existing.pds_path;
    let msdsPath = existing.msds_path;

    // If new PDS uploaded, delete old one
    if (req.files?.pds?.[0]) {
      if (pdsPath) {
        const oldFile = path.join(uploadsDir, pdsPath);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
      pdsPath = req.files.pds[0].filename;
    }

    // If new MSDS uploaded, delete old one
    if (req.files?.msds?.[0]) {
      if (msdsPath) {
        const oldFile = path.join(uploadsDir, msdsPath);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
      msdsPath = req.files.msds[0].filename;
    }

    db.prepare(
      'UPDATE product SET name=?, pds_path=?, msds_path=? WHERE id=?'
    ).run(name || existing.name, pdsPath, msdsPath, req.params.id);

    res.json(db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id));
  });
});

// Delete product (admin only)
router.delete('/:id', adminOnly, (req, res) => {
  const existing = db.prepare('SELECT * FROM product WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  // Delete associated files
  if (existing.pds_path) {
    const f = path.join(uploadsDir, existing.pds_path);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  if (existing.msds_path) {
    const f = path.join(uploadsDir, existing.msds_path);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  db.prepare('DELETE FROM product WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted' });
});

export default router;
