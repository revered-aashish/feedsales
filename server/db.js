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
  CREATE INDEX IF NOT EXISTS idx_movement_salesman ON daily_movement(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_movement_date ON daily_movement(visit_date);
`);

export default db;
