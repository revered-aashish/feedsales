import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/feedsales.db');

// Ensure the data directory exists before opening the database
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS salesman (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'salesman' CHECK(role IN ('salesman', 'admin')),
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    is_lost INTEGER DEFAULT 0,
    lost_reason TEXT,
    lost_date TEXT,
    salesman_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS trial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    salesman_id INTEGER NOT NULL,
    product TEXT NOT NULL,
    quantity TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'successful', 'failed')),
    start_date TEXT,
    end_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS complaint (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    salesman_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'open' CHECK(status IN ('open', 'in_progress', 'resolved')),
    resolution TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS daily_movement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    salesman_id INTEGER NOT NULL,
    visit_date TEXT NOT NULL,
    purpose TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'completed', 'cancelled')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id)
  );

  CREATE INDEX IF NOT EXISTS idx_customer_salesman ON customer(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_customer_lost ON customer(is_lost);
  CREATE INDEX IF NOT EXISTS idx_trial_customer ON trial(customer_id);
  CREATE INDEX IF NOT EXISTS idx_trial_salesman ON trial(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_complaint_customer ON complaint(customer_id);
  CREATE INDEX IF NOT EXISTS idx_complaint_salesman ON complaint(salesman_id);
  CREATE TABLE IF NOT EXISTS product (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pds_path TEXT,
    msds_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS daily_visit_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salesman_id INTEGER NOT NULL,
    visit_date TEXT NOT NULL,
    customer_id INTEGER NOT NULL,
    purpose TEXT,
    remark TEXT,
    slot_number INTEGER NOT NULL CHECK(slot_number BETWEEN 1 AND 8),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id),
    FOREIGN KEY (customer_id) REFERENCES customer(id)
  );

  CREATE TABLE IF NOT EXISTS movement_comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movement_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (movement_id) REFERENCES daily_movement(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS self_appraisal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    salesman_id INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    coating_target REAL DEFAULT 0,
    coating_sales REAL DEFAULT 0,
    resin_target REAL DEFAULT 0,
    resin_sales REAL DEFAULT 0,
    coalseam_target REAL DEFAULT 0,
    coalseam_sales REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id),
    UNIQUE(salesman_id, month, year)
  );

  CREATE TABLE IF NOT EXISTS complaint_comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (complaint_id) REFERENCES complaint(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES salesman(id)
  );

  CREATE INDEX IF NOT EXISTS idx_complaint_comment ON complaint_comment(complaint_id);
  CREATE INDEX IF NOT EXISTS idx_appraisal_salesman ON self_appraisal(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_appraisal_period ON self_appraisal(year, month);
  CREATE INDEX IF NOT EXISTS idx_movement_comment_movement ON movement_comment(movement_id);
  CREATE INDEX IF NOT EXISTS idx_movement_salesman ON daily_movement(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_movement_date ON daily_movement(visit_date);
  CREATE INDEX IF NOT EXISTS idx_visit_plan_salesman ON daily_visit_plan(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_visit_plan_date ON daily_visit_plan(visit_date);
  CREATE INDEX IF NOT EXISTS idx_visit_plan_unique ON daily_visit_plan(salesman_id, visit_date, slot_number);
`);

// Migration: add new_customers, issues_faced to self_appraisal
try {
  db.prepare('SELECT new_customers FROM self_appraisal LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE self_appraisal ADD COLUMN new_customers TEXT');
    db.exec('ALTER TABLE self_appraisal ADD COLUMN issues_faced TEXT');
    console.log('Migrated self_appraisal: added new_customers, issues_faced columns');
  } catch (e2) { /* columns may already exist */ }
}

// Migration: add is_issue column to daily_movement
try {
  db.prepare('SELECT is_issue FROM daily_movement LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE daily_movement ADD COLUMN is_issue INTEGER DEFAULT 0');
    console.log('Migrated daily_movement table: added is_issue column');
  } catch (e2) { /* column may already exist */ }
}

// Migration: add pds_path, msds_path columns if upgrading from old product schema
try {
  db.prepare('SELECT pds_path FROM product LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE product ADD COLUMN pds_path TEXT');
    db.exec('ALTER TABLE product ADD COLUMN msds_path TEXT');
    console.log('Migrated product table: added pds_path, msds_path columns');
  } catch (e2) { /* columns may already exist */ }
}

// Ensure uploads directory exists
const uploadsDir = path.join(dbDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export default db;
