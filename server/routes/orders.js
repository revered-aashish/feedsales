import { Router } from 'express';
import db from '../db.js';
import { authenticate, regionClause } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── List orders ───────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, salesman_id, customer_id, region } = req.query;
  const isPrivileged = req.user.role === 'admin' || req.user.is_dispatch_manager;

  let sql = `
    SELECT o.*,
      c.company   AS customer_name,
      s.name      AS salesman_name
    FROM orders o
    JOIN customer  c ON c.id = o.customer_id
    JOIN salesman  s ON s.id = o.salesman_id
    WHERE 1=1
  `;
  const params = [];

  if (isPrivileged) {
    // Privileged: apply region filter if admin selected one, or explicit salesman filter
    const rc = regionClause(req.user, region);
    sql += rc.sql; params.push(...rc.params);
    if (salesman_id) { sql += ' AND o.salesman_id = ?'; params.push(salesman_id); }
  } else {
    // Regular salesman: scope to their region (own orders fallback if no region)
    const rc = regionClause(req.user, null);
    sql += rc.sql; params.push(...rc.params);
  }

  if (status)      { sql += ' AND o.status = ?';      params.push(status); }
  if (customer_id) { sql += ' AND o.customer_id = ?'; params.push(customer_id); }

  sql += ' ORDER BY o.created_at DESC';

  const orders = db.prepare(sql).all(...params);

  // Attach items to each order
  const itemStmt = db.prepare(`
    SELECT * FROM order_item WHERE order_id = ? ORDER BY id
  `);

  const result = orders.map(o => ({ ...o, items: itemStmt.all(o.id) }));
  res.json(result);
});

// ── Get single order ──────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const order = db.prepare(`
    SELECT o.*, c.company AS customer_name, s.name AS salesman_name
    FROM orders o
    JOIN customer c ON c.id = o.customer_id
    JOIN salesman s ON s.id = o.salesman_id
    WHERE o.id = ?
  `).get(req.params.id);

  if (!order) return res.status(404).json({ error: 'Order not found' });

  const isPrivileged = req.user.role === 'admin' || req.user.is_dispatch_manager;
  if (!isPrivileged && order.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  order.items = db.prepare('SELECT * FROM order_item WHERE order_id = ? ORDER BY id').all(order.id);

  res.json(order);
});

// ── Create order ──────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    customer_id, delivery_type = 'dispatch', schedule_type = 'asap',
    scheduled_at, billing_type = 'bill', order_type = 'new',
    allow_partial_dispatch = 0, notes, items = [],
  } = req.body;

  if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
  if (!items.length) return res.status(400).json({ error: 'At least one product item is required' });

  const createOrder = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO orders
        (customer_id, salesman_id, delivery_type, schedule_type, scheduled_at,
         billing_type, order_type, allow_partial_dispatch, notes, status)
      VALUES (?,?,?,?,?,?,?,?,?,'pending')
    `).run(
      customer_id, req.user.id, delivery_type, schedule_type,
      scheduled_at || null, billing_type, order_type,
      allow_partial_dispatch ? 1 : 0, notes || null
    );

    const orderId = result.lastInsertRowid;

    const itemStmt = db.prepare(`
      INSERT INTO order_item (order_id, product_name, packing_size, packing_type, quantity, unit, remaining_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      if (!item.product_name?.trim() || !item.quantity) continue;
      itemStmt.run(
        orderId, item.product_name.trim(), item.packing_size || null, item.packing_type || null,
        Number(item.quantity), item.unit || 'kg', Number(item.quantity)
      );
    }

    return orderId;
  });

  try {
    const orderId = createOrder();
    const order = db.prepare(`
      SELECT o.*, c.company AS customer_name, s.name AS salesman_name
      FROM orders o JOIN customer c ON c.id=o.customer_id JOIN salesman s ON s.id=o.salesman_id
      WHERE o.id=?
    `).get(orderId);
    order.items = db.prepare('SELECT * FROM order_item WHERE order_id=? ORDER BY id').all(orderId);
    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order', details: err.message });
  }
});

// ── Mark ready / unready ──────────────────────────────────────────────────────
router.put('/:id/ready', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role !== 'admin' && order.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (['dispatched', 'partially_dispatched'].includes(order.status)) {
    return res.status(400).json({ error: 'Cannot change status of a dispatched order' });
  }
  const newStatus = order.status === 'ready' ? 'pending' : 'ready';
  db.prepare("UPDATE orders SET status=?, hold_remark=NULL, updated_at=datetime('now') WHERE id=?")
    .run(newStatus, order.id);
  res.json({ id: order.id, status: newStatus });
});

// ── Hold / unhold ─────────────────────────────────────────────────────────────
router.put('/:id/hold', (req, res) => {
  const { remark } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role !== 'admin' && order.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (order.status === 'hold') {
    // Unhold — restore to pending
    db.prepare("UPDATE orders SET status='pending', hold_remark=NULL, updated_at=datetime('now') WHERE id=?")
      .run(order.id);
    return res.json({ id: order.id, status: 'pending' });
  }
  if (!remark?.trim()) return res.status(400).json({ error: 'Hold remark is required' });
  db.prepare("UPDATE orders SET status='hold', hold_remark=?, updated_at=datetime('now') WHERE id=?")
    .run(remark.trim(), order.id);
  res.json({ id: order.id, status: 'hold', hold_remark: remark.trim() });
});

// ── Update order (notes / basic fields, only when pending/ready/hold) ─────────
router.put('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role !== 'admin' && order.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (['dispatched', 'partially_dispatched'].includes(order.status)) {
    return res.status(400).json({ error: 'Cannot edit a dispatched order' });
  }

  const {
    delivery_type, schedule_type, scheduled_at, billing_type,
    order_type, allow_partial_dispatch, notes,
  } = req.body;

  db.prepare(`
    UPDATE orders SET
      delivery_type=?, schedule_type=?, scheduled_at=?,
      billing_type=?, order_type=?, allow_partial_dispatch=?,
      notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    delivery_type ?? order.delivery_type,
    schedule_type ?? order.schedule_type,
    scheduled_at ?? order.scheduled_at,
    billing_type ?? order.billing_type,
    order_type ?? order.order_type,
    allow_partial_dispatch != null ? (allow_partial_dispatch ? 1 : 0) : order.allow_partial_dispatch,
    notes ?? order.notes,
    order.id
  );

  const updated = db.prepare(`
    SELECT o.*, c.company AS customer_name, s.name AS salesman_name
    FROM orders o JOIN customer c ON c.id=o.customer_id JOIN salesman s ON s.id=o.salesman_id
    WHERE o.id=?
  `).get(order.id);
  updated.items = db.prepare('SELECT * FROM order_item WHERE order_id=? ORDER BY id').all(order.id);
  res.json(updated);
});

// ── Delete order (admin or owner, only if not dispatched) ─────────────────────
router.delete('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.user.role !== 'admin' && order.salesman_id !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (['dispatched', 'partially_dispatched'].includes(order.status)) {
    return res.status(400).json({ error: 'Cannot delete a dispatched order' });
  }
  db.prepare('DELETE FROM orders WHERE id=?').run(order.id);
  res.json({ success: true });
});

export default router;
