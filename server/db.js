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

// Migration: add partial loss columns to customer
try {
  db.prepare('SELECT partial_loss_product FROM customer LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE customer ADD COLUMN partial_loss_product TEXT');
    db.exec('ALTER TABLE customer ADD COLUMN partial_loss_reason TEXT');
    console.log('Migrated customer table: added partial_loss_product, partial_loss_reason columns');
  } catch (e2) { /* columns may already exist */ }
}

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

// Migration: add mom_path to complaint
try {
  db.prepare('SELECT mom_path FROM complaint LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE complaint ADD COLUMN mom_path TEXT');
    console.log('Migrated complaint table: added mom_path column');
  } catch (e2) { /* already exists */ }
}

// Migration: add mom_path to trial
try {
  db.prepare('SELECT mom_path FROM trial LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE trial ADD COLUMN mom_path TEXT');
    console.log('Migrated trial table: added mom_path column');
  } catch (e2) { /* already exists */ }
}

// Migration: add mom_path to daily_movement
try {
  db.prepare('SELECT mom_path FROM daily_movement LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE daily_movement ADD COLUMN mom_path TEXT');
    console.log('Migrated daily_movement table: added mom_path column');
  } catch (e2) { /* already exists */ }
}

// Migration: add is_dispatch_manager to salesman
try {
  db.prepare('SELECT is_dispatch_manager FROM salesman LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE salesman ADD COLUMN is_dispatch_manager INTEGER DEFAULT 0');
    console.log('Migrated salesman: added is_dispatch_manager column');
  } catch (e2) { /* already exists */ }
}

// Migration: add region to salesman
try {
  db.prepare('SELECT region FROM salesman LIMIT 1').get();
} catch (e) {
  try {
    db.exec("ALTER TABLE salesman ADD COLUMN region TEXT");
    console.log('Migrated salesman: added region column');
  } catch (e2) { /* already exists */ }
}

// ── Coating Sample Data Sheet + audit log ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS coating_sample (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    client_name TEXT,
    salesman_id INTEGER NOT NULL,

    -- Casting details
    casting_weight TEXT,
    casting_thickness TEXT,
    metal_type TEXT,
    pouring_temperature TEXT,
    pouring_time TEXT,
    pouring_mode TEXT,

    -- Coating section
    application TEXT,
    baume_as_is TEXT,
    dilution_ratio TEXT,
    viscosity_diluted TEXT,
    baume_diluted TEXT,
    wft_diluted TEXT,
    mixing_process TEXT,
    coating_layers TEXT,

    -- Mould section
    binder_system TEXT,
    sand_afs TEXT,
    drying_method TEXT,

    -- Current coating
    current_coating_used TEXT,
    current_coating_issues TEXT,
    approximate_consumption TEXT,

    remarks TEXT,

    -- Admin recommendation
    recommended_product TEXT,
    recommendation_remarks TEXT,
    recommended_by INTEGER,
    recommended_at TEXT,

    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id),
    FOREIGN KEY (recommended_by) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS coating_sample_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (sample_id) REFERENCES coating_sample(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES salesman(id)
  );

  CREATE INDEX IF NOT EXISTS idx_coating_sample_salesman ON coating_sample(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_coating_sample_customer ON coating_sample(customer_id);
  CREATE INDEX IF NOT EXISTS idx_coating_audit_sample ON coating_sample_audit(sample_id);
`);

// Region master table + default region + backfill of legacy data
const DEFAULT_REGION = 'Rajkot Region';
db.exec(`
  CREATE TABLE IF NOT EXISTS region (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
// Ensure the default region exists
db.prepare('INSERT OR IGNORE INTO region (name) VALUES (?)').run(DEFAULT_REGION);
// Backfill any salesman without a region to the default (older data)
const backfilled = db.prepare("UPDATE salesman SET region = ? WHERE region IS NULL OR region = ''").run(DEFAULT_REGION);
if (backfilled.changes > 0) {
  console.log(`Backfilled ${backfilled.changes} salesman record(s) to "${DEFAULT_REGION}"`);
}

// ── Ordering & Dispatch tables ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    salesman_id INTEGER NOT NULL,
    delivery_type TEXT NOT NULL DEFAULT 'dispatch',
    schedule_type TEXT NOT NULL DEFAULT 'asap',
    scheduled_at TEXT,
    billing_type TEXT NOT NULL DEFAULT 'bill',
    order_type TEXT NOT NULL DEFAULT 'new',
    allow_partial_dispatch INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    hold_remark TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customer(id),
    FOREIGN KEY (salesman_id) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS order_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    packing_size TEXT,
    packing_type TEXT,
    quantity REAL NOT NULL,
    unit TEXT DEFAULT 'kg',
    remaining_quantity REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES product(id)
  );

  CREATE TABLE IF NOT EXISTS vehicle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number TEXT NOT NULL,
    driver_name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS dispatch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    dispatch_date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (vehicle_id) REFERENCES vehicle(id),
    FOREIGN KEY (created_by) REFERENCES salesman(id)
  );

  CREATE TABLE IF NOT EXISTS dispatch_item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id INTEGER NOT NULL,
    order_id INTEGER NOT NULL,
    order_item_id INTEGER NOT NULL,
    dispatched_quantity REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (dispatch_id) REFERENCES dispatch(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (order_item_id) REFERENCES order_item(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_salesman ON orders(salesman_id);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);
  CREATE INDEX IF NOT EXISTS idx_dispatch_vehicle ON dispatch(vehicle_id);
  CREATE INDEX IF NOT EXISTS idx_dispatch_date ON dispatch(dispatch_date);
  CREATE INDEX IF NOT EXISTS idx_dispatch_item_dispatch ON dispatch_item(dispatch_id);
  CREATE INDEX IF NOT EXISTS idx_dispatch_item_order_item ON dispatch_item(order_item_id);
`);

// Migration: replace product_id FK on order_item with free-text product_name
try {
  db.prepare('SELECT product_name FROM order_item LIMIT 1').get();
} catch (e) {
  try {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE order_item_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        packing_size TEXT,
        packing_type TEXT,
        quantity REAL NOT NULL,
        unit TEXT DEFAULT 'kg',
        remaining_quantity REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO order_item_v2
        SELECT oi.id, oi.order_id,
          COALESCE((SELECT name FROM product WHERE id = oi.product_id), 'Unknown'),
          oi.packing_size, oi.packing_type, oi.quantity, oi.unit, oi.remaining_quantity, oi.created_at
        FROM order_item oi;
      DROP TABLE order_item;
      ALTER TABLE order_item_v2 RENAME TO order_item;
      CREATE INDEX IF NOT EXISTS idx_order_item_order ON order_item(order_id);
    `);
    db.pragma('foreign_keys = ON');
    console.log('Migrated order_item: replaced product_id FK with product_name text field');
  } catch (e2) {
    db.pragma('foreign_keys = ON');
    console.error('order_item migration error:', e2.message);
  }
}

export default db;
