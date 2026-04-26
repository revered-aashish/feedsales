import dotenv from 'dotenv';
dotenv.config();

// Set fallback for JWT_SECRET if not configured
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'feedsales_default_secret_change_me_2024';
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './db.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import trialRoutes from './routes/trials.js';
import complaintRoutes from './routes/complaints.js';
import movementRoutes from './routes/movements.js';
import salesmanRoutes from './routes/salesman.js';
import visitPlanRoutes from './routes/visitPlans.js';
import productRoutes from './routes/products.js';
import appraisalRoutes from './routes/appraisal.js';
import backupRoutes from './routes/backup.js';

// Auto-seed if database is empty (no admin user exists)
function autoSeed() {
  try {
    const adminExists = db.prepare('SELECT id FROM salesman WHERE role = ?').get('admin');
    if (adminExists) return;

    console.log('No admin found — auto-seeding database...');

    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`INSERT OR IGNORE INTO salesman (name, email, password, phone, role)
      VALUES (?, ?, ?, ?, ?)`).run('Aashish (Admin)', 'admin@feedsales.com', adminHash, '9999999999', 'admin');

    const salesmanNames = [
      'Rajesh Kumar', 'Amit Sharma', 'Priya Patel', 'Suresh Reddy', 'Neha Gupta',
      'Vikram Singh', 'Anita Joshi', 'Manoj Verma', 'Deepika Nair', 'Ravi Tiwari',
      'Kavita Mehta', 'Arjun Rao', 'Sunita Desai', 'Ramesh Iyer', 'Pooja Saxena'
    ];
    const salesmanHash = bcrypt.hashSync('sales123', 10);

    for (let i = 0; i < salesmanNames.length; i++) {
      const email = salesmanNames[i].toLowerCase().replace(' ', '.') + '@feedsales.com';
      db.prepare(`INSERT OR IGNORE INTO salesman (name, email, password, phone, role)
        VALUES (?, ?, ?, ?, ?)`).run(salesmanNames[i], email, salesmanHash, `98${String(i).padStart(8, '0')}`, 'salesman');
    }

    console.log('Auto-seed complete! Admin: admin@feedsales.com / admin123');
  } catch (err) {
    console.error('Auto-seed error:', err.message);
  }
}

autoSeed();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/trials', trialRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/salesman', salesmanRoutes);
app.use('/api/visit-plans', visitPlanRoutes);
app.use('/api/products', productRoutes);
app.use('/api/appraisals', appraisalRoutes);
app.use('/api/backup', backupRoutes);

// Global error handler — catches all unhandled errors and returns JSON
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Serve frontend in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDist, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`FeedSales server running on http://localhost:${PORT}`);
  console.log(`JWT_SECRET is ${process.env.JWT_SECRET ? 'SET' : 'MISSING'}`);
});
