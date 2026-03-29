import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import trialRoutes from './routes/trials.js';
import complaintRoutes from './routes/complaints.js';
import movementRoutes from './routes/movements.js';
import salesmanRoutes from './routes/salesman.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/trials', trialRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/salesman', salesmanRoutes);

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
});
