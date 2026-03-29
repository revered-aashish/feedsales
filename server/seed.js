import bcrypt from 'bcryptjs';
import db from './db.js';

console.log('Seeding database...');

// Create admin user (you - Sales Director)
const adminHash = bcrypt.hashSync('admin123', 10);
db.prepare(`INSERT OR IGNORE INTO salesman (name, email, password, phone, role)
  VALUES (?, ?, ?, ?, ?)`).run('Aashish (Admin)', 'admin@feedsales.com', adminHash, '9999999999', 'admin');

// Create 15 salesmen
const salesmanNames = [
  'Rajesh Kumar', 'Amit Sharma', 'Priya Patel', 'Suresh Reddy', 'Neha Gupta',
  'Vikram Singh', 'Anita Joshi', 'Manoj Verma', 'Deepika Nair', 'Ravi Tiwari',
  'Kavita Mehta', 'Arjun Rao', 'Sunita Desai', 'Ramesh Iyer', 'Pooja Saxena'
];

const salesmanHash = bcrypt.hashSync('sales123', 10);
const salesmanIds = [];

for (let i = 0; i < salesmanNames.length; i++) {
  const email = salesmanNames[i].toLowerCase().replace(' ', '.') + '@feedsales.com';
  const result = db.prepare(`INSERT OR IGNORE INTO salesman (name, email, password, phone, role)
    VALUES (?, ?, ?, ?, ?)`).run(salesmanNames[i], email, salesmanHash, `98${String(i).padStart(8, '0')}`, 'salesman');
  if (result.lastInsertRowid) salesmanIds.push(result.lastInsertRowid);
}

if (salesmanIds.length === 0) {
  const existing = db.prepare('SELECT id FROM salesman WHERE role = ?').all('salesman');
  existing.forEach(s => salesmanIds.push(s.id));
}

// Create sample customers
const cities = ['Mumbai', 'Delhi', 'Pune', 'Ahmedabad', 'Chennai', 'Bangalore', 'Hyderabad', 'Kolkata', 'Jaipur', 'Lucknow'];
const products = ['Polyethylene Glycol', 'Sodium Hydroxide', 'Sulfuric Acid', 'Hydrochloric Acid', 'Calcium Carbonate',
  'Titanium Dioxide', 'Zinc Oxide', 'Ferric Chloride', 'Ammonium Sulfate', 'Potassium Permanganate'];

for (let i = 1; i <= 50; i++) {
  const salesmanId = salesmanIds[i % salesmanIds.length];
  const city = cities[i % cities.length];
  const isLost = i > 45 ? 1 : 0;

  db.prepare(`INSERT OR IGNORE INTO customer (name, company, phone, email, address, city, state, is_lost, lost_reason, lost_date, salesman_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`Customer ${i}`, `Company ${i} Chemicals`, `91${String(1000000000 + i)}`,
      `customer${i}@example.com`, `${i} Industrial Area`, city, 'Maharashtra',
      isLost, isLost ? 'Switched to competitor' : null, isLost ? '2024-01-15' : null, salesmanId);
}

// Create sample trials
for (let i = 1; i <= 20; i++) {
  const statuses = ['pending', 'in_progress', 'successful', 'failed'];
  db.prepare(`INSERT OR IGNORE INTO trial (customer_id, salesman_id, product, quantity, status, start_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(i, salesmanIds[i % salesmanIds.length], products[i % products.length],
      `${(i * 100)}kg`, statuses[i % 4], '2024-01-01', `Trial sample for Customer ${i}`);
}

// Create sample complaints
for (let i = 1; i <= 10; i++) {
  const statuses = ['open', 'in_progress', 'resolved'];
  db.prepare(`INSERT OR IGNORE INTO complaint (customer_id, salesman_id, subject, description, status)
    VALUES (?, ?, ?, ?, ?)`)
    .run(i, salesmanIds[i % salesmanIds.length], `Quality issue batch #${i}`,
      `Customer reported quality issue with recent delivery`, statuses[i % 3]);
}

// Create sample movements
const purposes = ['Sales Visit', 'Follow-up', 'Product Demo', 'Complaint Resolution', 'Payment Collection'];
for (let i = 1; i <= 30; i++) {
  db.prepare(`INSERT OR IGNORE INTO daily_movement (customer_id, salesman_id, visit_date, purpose, location, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run((i % 50) + 1, salesmanIds[i % salesmanIds.length], '2024-12-01',
      purposes[i % 5], cities[i % cities.length], `Visit notes for movement ${i}`, 'completed');
}

console.log('Database seeded successfully!');
console.log('Admin login: admin@feedsales.com / admin123');
console.log('Salesman login: rajesh.kumar@feedsales.com / sales123');
