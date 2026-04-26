import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { authenticate, adminOnly } from '../middleware/auth.js';
import db from '../db.js';

const router = Router();

/**
 * GET /api/backup/db
 * Admin-only. Uses better-sqlite3's hot backup API to create a
 * consistent snapshot of the live database (WAL-safe), then streams
 * it as a downloadable .db file. The temp file is deleted after send.
 */
router.get('/db', authenticate, adminOnly, async (req, res) => {
  const now = new Date();
  // Format: feedsales-backup-2026-04-26T14-30.db
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const filename = `feedsales-backup-${stamp}.db`;

  // Write backup to a temp file so we can stream it cleanly
  const tmpPath = path.join(os.tmpdir(), filename);

  try {
    // db.backup() is better-sqlite3's built-in hot-backup — safe under concurrent writes
    await db.backup(tmpPath);

    const stat = fs.statSync(tmpPath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', stat.size);

    const stream = fs.createReadStream(tmpPath);
    stream.pipe(res);

    // Clean up temp file once the response has been sent
    stream.on('end', () => {
      fs.unlink(tmpPath, () => {});
    });
    stream.on('error', () => {
      fs.unlink(tmpPath, () => {});
    });
  } catch (err) {
    // Clean up temp if backup failed mid-way
    fs.unlink(tmpPath, () => {});
    console.error('Backup error:', err.message);
    res.status(500).json({ error: 'Backup failed', details: err.message });
  }
});

export default router;
