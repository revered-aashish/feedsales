import { Router } from 'express';
import db from '../db.js';
import { authenticate, dispatchOrAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── List dispatches ────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, from_date, to_date } = req.query;
  let sql = `
    SELECT d.*, v.vehicle_number, v.driver_name, s.name AS created_by_name
    FROM dispatch d
    JOIN vehicle  v ON v.id = d.vehicle_id
    JOIN salesman s ON s.id = d.created_by
    WHERE 1=1
  `;
  const params = [];
  if (status)    { sql += ' AND d.status = ?';        params.push(status); }
  if (from_date) { sql += ' AND d.dispatch_date >= ?'; params.push(from_date); }
  if (to_date)   { sql += ' AND d.dispatch_date <= ?'; params.push(to_date); }
  sql += ' ORDER BY d.dispatch_date DESC, d.created_at DESC';

  const dispatches = db.prepare(sql).all(...params);

  // Attach items for each dispatch
  const itemsStmt = db.prepare(`
    SELECT
      di.*,
      o.id          AS order_id,
      c.company     AS customer_name,
      sal.name      AS salesman_name,
      oi.product_name,
      oi.packing_size, oi.packing_type, oi.unit,
      oi.quantity   AS original_quantity,
      oi.remaining_quantity
    FROM dispatch_item di
    JOIN order_item oi ON oi.id = di.order_item_id
    JOIN orders     o  ON o.id  = di.order_id
    JOIN customer   c  ON c.id  = o.customer_id
    JOIN salesman   sal ON sal.id = o.salesman_id
    WHERE di.dispatch_id = ?
    ORDER BY di.id
  `);

  res.json(dispatches.map(d => ({ ...d, items: itemsStmt.all(d.id) })));
});

// ── Get single dispatch ────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const d = db.prepare(`
    SELECT d.*, v.vehicle_number, v.driver_name, s.name AS created_by_name
    FROM dispatch d JOIN vehicle v ON v.id=d.vehicle_id JOIN salesman s ON s.id=d.created_by
    WHERE d.id=?
  `).get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Dispatch not found' });

  d.items = db.prepare(`
    SELECT di.*, oi.product_name, c.company AS customer_name,
      oi.packing_size, oi.packing_type, oi.unit, oi.quantity AS original_quantity, oi.remaining_quantity,
      o.id AS order_id
    FROM dispatch_item di
    JOIN order_item oi ON oi.id=di.order_item_id
    JOIN orders o ON o.id=di.order_id
    JOIN customer c ON c.id=o.customer_id
    WHERE di.dispatch_id=? ORDER BY di.id
  `).all(d.id);
  res.json(d);
});

// ── Create dispatch ────────────────────────────────────────────────────────────
// body: { vehicle_id, dispatch_date, notes, items: [{order_item_id, dispatched_quantity}] }
router.post('/', dispatchOrAdmin, (req, res) => {
  const { vehicle_id, dispatch_date, notes, items = [] } = req.body;
  if (!vehicle_id)    return res.status(400).json({ error: 'vehicle_id is required' });
  if (!dispatch_date) return res.status(400).json({ error: 'dispatch_date is required' });
  if (!items.length)  return res.status(400).json({ error: 'At least one item is required' });

  const createDispatch = db.transaction(() => {
    // Create dispatch record
    const dResult = db.prepare(`
      INSERT INTO dispatch (vehicle_id, created_by, dispatch_date, notes, status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(vehicle_id, req.user.id, dispatch_date, notes || null);

    const dispatchId = dResult.lastInsertRowid;

    const insertItem = db.prepare(`
      INSERT INTO dispatch_item (dispatch_id, order_id, order_item_id, dispatched_quantity)
      VALUES (?, ?, ?, ?)
    `);

    // Collect affected order IDs for status recalculation
    const affectedOrderIds = new Set();

    for (const item of items) {
      const { order_item_id, dispatched_quantity } = item;
      const qty = Number(dispatched_quantity);
      if (!order_item_id || !qty || qty <= 0) continue;

      const oi = db.prepare('SELECT * FROM order_item WHERE id=?').get(order_item_id);
      if (!oi) continue;

      // Clamp to remaining
      const actualQty = Math.min(qty, oi.remaining_quantity);
      if (actualQty <= 0) continue;

      insertItem.run(dispatchId, oi.order_id, order_item_id, actualQty);
      affectedOrderIds.add(oi.order_id);

      // Update remaining_quantity on the order_item
      db.prepare('UPDATE order_item SET remaining_quantity = remaining_quantity - ? WHERE id=?')
        .run(actualQty, order_item_id);
    }

    // Recalculate status for each affected order
    for (const orderId of affectedOrderIds) {
      const allItems = db.prepare('SELECT remaining_quantity, quantity FROM order_item WHERE order_id=?').all(orderId);
      const totalRemaining = allItems.reduce((s, i) => s + i.remaining_quantity, 0);
      const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);

      let newStatus;
      if (totalRemaining <= 0) {
        newStatus = 'dispatched';
      } else if (totalRemaining < totalQty) {
        newStatus = 'partially_dispatched';
      } else {
        // Nothing was actually dispatched (edge case — clamp made everything 0)
        continue;
      }
      db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?")
        .run(newStatus, orderId);
    }

    return dispatchId;
  });

  try {
    const dispatchId = createDispatch();
    const dispatch = db.prepare(`
      SELECT d.*, v.vehicle_number, v.driver_name, s.name AS created_by_name
      FROM dispatch d JOIN vehicle v ON v.id=d.vehicle_id JOIN salesman s ON s.id=d.created_by
      WHERE d.id=?
    `).get(dispatchId);
    dispatch.items = db.prepare(`
      SELECT di.*, oi.product_name, c.company AS customer_name,
        oi.packing_size, oi.packing_type, oi.unit, oi.quantity AS original_quantity
      FROM dispatch_item di
      JOIN order_item oi ON oi.id=di.order_item_id JOIN orders o ON o.id=di.order_id
      JOIN customer c ON c.id=o.customer_id
      WHERE di.dispatch_id=? ORDER BY di.id
    `).all(dispatchId);
    res.status(201).json(dispatch);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create dispatch', details: err.message });
  }
});

// ── Mark dispatch complete ─────────────────────────────────────────────────────
router.put('/:id/complete', dispatchOrAdmin, (req, res) => {
  const d = db.prepare('SELECT * FROM dispatch WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Dispatch not found' });
  db.prepare("UPDATE dispatch SET status='completed' WHERE id=?").run(d.id);
  res.json({ id: d.id, status: 'completed' });
});

// ── Delete dispatch (reverses quantity changes) ────────────────────────────────
router.delete('/:id', dispatchOrAdmin, (req, res) => {
  const d = db.prepare('SELECT * FROM dispatch WHERE id=?').get(req.params.id);
  if (!d) return res.status(404).json({ error: 'Dispatch not found' });
  if (d.status === 'completed') {
    return res.status(400).json({ error: 'Cannot delete a completed dispatch' });
  }

  const deleteDispatch = db.transaction(() => {
    const items = db.prepare('SELECT * FROM dispatch_item WHERE dispatch_id=?').all(d.id);
    const affectedOrderIds = new Set();

    for (const di of items) {
      // Restore remaining_quantity
      db.prepare('UPDATE order_item SET remaining_quantity = remaining_quantity + ? WHERE id=?')
        .run(di.dispatched_quantity, di.order_item_id);

      const oi = db.prepare('SELECT order_id FROM order_item WHERE id=?').get(di.order_item_id);
      if (oi) affectedOrderIds.add(oi.order_id);
    }

    db.prepare('DELETE FROM dispatch WHERE id=?').run(d.id);

    // Recalculate order statuses
    for (const orderId of affectedOrderIds) {
      const allItems = db.prepare('SELECT remaining_quantity, quantity FROM order_item WHERE order_id=?').all(orderId);
      const totalRemaining = allItems.reduce((s, i) => s + i.remaining_quantity, 0);
      const totalQty = allItems.reduce((s, i) => s + i.quantity, 0);

      let newStatus = 'pending';
      if (totalRemaining <= 0) newStatus = 'dispatched';
      else if (totalRemaining < totalQty) newStatus = 'partially_dispatched';

      // Don't overwrite hold status
      const order = db.prepare('SELECT status FROM orders WHERE id=?').get(orderId);
      if (order && order.status !== 'hold') {
        db.prepare("UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?")
          .run(newStatus, orderId);
      }
    }
  });

  try {
    deleteDispatch();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dispatch', details: err.message });
  }
});

export default router;
