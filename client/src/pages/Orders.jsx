import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import CustomerSearchSelect from '../components/CustomerSearchSelect';
import toast from 'react-hot-toast';
import {
  FiPlus, FiEdit2, FiTrash2, FiPause, FiPlay, FiCheck,
  FiChevronDown, FiChevronUp, FiFilter, FiX, FiPackage,
} from 'react-icons/fi';

const STATUS_META = {
  pending:              { label: 'Pending',              bg: 'bg-gray-100',   fg: 'text-gray-700' },
  ready:                { label: 'Ready',                bg: 'bg-green-100',  fg: 'text-green-700' },
  hold:                 { label: 'On Hold',              bg: 'bg-yellow-100', fg: 'text-yellow-700' },
  partially_dispatched: { label: 'Partial Dispatch',     bg: 'bg-blue-100',   fg: 'text-blue-700' },
  dispatched:           { label: 'Dispatched',           bg: 'bg-indigo-100', fg: 'text-indigo-700' },
};

const emptyItem = () => ({ product_name: '', packing_size: '', packing_type: '', quantity: '', unit: 'kg' });
const emptyForm = () => ({
  customer_id: '', delivery_type: 'dispatch', schedule_type: 'asap',
  scheduled_at: '', billing_type: 'bill', order_type: 'new',
  allow_partial_dispatch: false, notes: '', items: [emptyItem()],
});

export default function Orders() {
  const { user } = useAuth();
  const isPrivileged = user?.role === 'admin' || user?.is_dispatch_manager;

  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [form, setForm] = useState(emptyForm());

  // Hold modal
  const [holdOrder, setHoldOrder] = useState(null);
  const [holdRemark, setHoldRemark] = useState('');

  // Expand rows
  const [expanded, setExpanded] = useState({});

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    const params = {};
    if (filterStatus)   params.status = filterStatus;
    if (filterSalesman) params.salesman_id = filterSalesman;
    const { data } = await api.get('/orders', { params });
    setOrders(data);
  };

  useEffect(() => { load(); }, [filterStatus, filterSalesman]);
  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    if (isPrivileged) api.get('/salesman').then(r => setSalesmen(r.data));
  }, []);

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const setItem = (idx, field, val) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: val };
    setForm(f => ({ ...f, items }));
  };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const openCreate = () => { setEditOrder(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit = (o) => {
    setEditOrder(o);
    setForm({
      customer_id: String(o.customer_id),
      delivery_type: o.delivery_type,
      schedule_type: o.schedule_type,
      scheduled_at: o.scheduled_at || '',
      billing_type: o.billing_type,
      order_type: o.order_type,
      allow_partial_dispatch: !!o.allow_partial_dispatch,
      notes: o.notes || '',
      items: o.items.map(i => ({
        product_name: i.product_name || '',
        packing_size: i.packing_size || '',
        packing_type: i.packing_type || '',
        quantity: String(i.quantity),
        unit: i.unit || 'kg',
      })),
    });
    setShowModal(true);
  };

  // ── Submit order ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) return toast.error('Please select a customer');
    const validItems = form.items.filter(i => i.product_name?.trim() && i.quantity);
    if (!validItems.length) return toast.error('Add at least one product with quantity');

    try {
      const payload = { ...form, items: validItems };
      if (editOrder) {
        await api.put(`/orders/${editOrder.id}`, payload);
        toast.success('Order updated');
      } else {
        await api.post('/orders', payload);
        toast.success('Order created');
      }
      setShowModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // ── Status actions ────────────────────────────────────────────────────────────
  const toggleReady = async (o) => {
    try {
      await api.put(`/orders/${o.id}/ready`);
      toast.success(o.status === 'ready' ? 'Marked as pending' : 'Marked as ready');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const submitHold = async () => {
    if (holdOrder.status === 'hold') {
      // Unhold
      try {
        await api.put(`/orders/${holdOrder.id}/hold`);
        toast.success('Order released from hold');
        setHoldOrder(null);
        load();
      } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
      return;
    }
    if (!holdRemark.trim()) return toast.error('Please enter a hold remark');
    try {
      await api.put(`/orders/${holdOrder.id}/hold`, { remark: holdRemark });
      toast.success('Order placed on hold');
      setHoldOrder(null); setHoldRemark('');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (o) => {
    if (!confirm(`Delete Order #${o.id}? This cannot be undone.`)) return;
    try {
      await api.delete(`/orders/${o.id}`);
      toast.success('Order deleted');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const canEdit = (o) => !['dispatched', 'partially_dispatched'].includes(o.status)
    && (user?.role === 'admin' || o.salesman_id === user?.id);

  const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || STATUS_META.pending;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.fg}`}>{m.label}</span>;
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";
  const activeFilters = [filterStatus, filterSalesman].filter(Boolean).length;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border cursor-pointer transition-colors ${
              activeFilters > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            <FiFilter size={15} /> Filters
            {activeFilters > 0 && <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilters}</span>}
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={15} /> New Order
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inp}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            {isPrivileged && (
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Salesman</label>
                <select value={filterSalesman} onChange={e => setFilterSalesman(e.target.value)} className={inp}>
                  <option value="">All Salesmen</option>
                  {salesmen.filter(s => s.role === 'salesman').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setFilterStatus(''); setFilterSalesman(''); }}
              className="mt-3 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
              <FiX size={13} /> Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Mobile cards ── */}
      <div className="sm:hidden space-y-3">
        {orders.map(o => (
          <div key={o.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <p className="font-semibold text-gray-800 text-sm">{o.customer_name}</p>
                <p className="text-xs text-gray-500">{o.salesman_name} · #{o.id}</p>
              </div>
              <StatusBadge status={o.status} />
            </div>

            {/* Items summary */}
            <div className="mb-2">
              {o.items.map(i => (
                <div key={i.id} className="flex items-center gap-1.5 text-xs text-gray-600 py-0.5">
                  <FiPackage size={11} className="text-indigo-400 shrink-0" />
                  <span className="font-medium">{i.product_name}</span>
                  {i.packing_size && <span>· {i.packing_size}</span>}
                  {i.packing_type && <span>{i.packing_type}</span>}
                  <span className="ml-auto font-medium text-gray-800">{i.remaining_quantity}/{i.quantity} {i.unit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs text-gray-500 mb-3">
              <span className="bg-gray-100 px-2 py-0.5 rounded">{o.delivery_type === 'pickup' ? 'Customer Pickup' : 'Dispatch'}</span>
              <span className="bg-gray-100 px-2 py-0.5 rounded">{o.billing_type === 'bill' ? 'On Bill' : 'Challan'}</span>
              <span className="bg-gray-100 px-2 py-0.5 rounded capitalize">{o.order_type}</span>
              {o.schedule_type === 'scheduled' && o.scheduled_at && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{o.scheduled_at.replace('T', ' ')}</span>
              )}
              {o.schedule_type === 'asap' && <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded">ASAP</span>}
            </div>
            {o.hold_remark && <p className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mb-2">Hold: {o.hold_remark}</p>}

            {canEdit(o) && (
              <div className="flex gap-2">
                {!['hold', 'dispatched', 'partially_dispatched'].includes(o.status) && (
                  <button onClick={() => toggleReady(o)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer ${
                      o.status === 'ready' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'}`}>
                    <FiCheck size={12} /> {o.status === 'ready' ? 'Unready' : 'Ready'}
                  </button>
                )}
                {!['dispatched', 'partially_dispatched'].includes(o.status) && (
                  <button onClick={() => { setHoldOrder(o); setHoldRemark(''); }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg cursor-pointer ${
                      o.status === 'hold' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {o.status === 'hold' ? <><FiPlay size={12} /> Resume</> : <><FiPause size={12} /> Hold</>}
                  </button>
                )}
                {o.status !== 'dispatched' && (
                  <button onClick={() => openEdit(o)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 cursor-pointer">
                    <FiEdit2 size={12} /> Edit
                  </button>
                )}
                {(user?.role === 'admin') && (
                  <button onClick={() => handleDelete(o)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 cursor-pointer">
                    <FiTrash2 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {orders.length === 0 && <p className="text-center text-gray-400 text-sm py-12">No orders found</p>}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['#', 'Customer', 'Salesman', 'Products', 'Details', 'Status', 'Actions'].map(h =>
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600 text-xs">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(o => (
              <>
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs">#{o.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{o.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{o.salesman_name}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setExpanded(x => ({ ...x, [o.id]: !x[o.id] }))}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">
                      {o.items.length} product{o.items.length !== 1 ? 's' : ''}
                      {expanded[o.id] ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{o.delivery_type === 'pickup' ? 'Pickup' : 'Dispatch'}</span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{o.billing_type === 'bill' ? 'Bill' : 'Challan'}</span>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded capitalize">{o.order_type}</span>
                      {o.schedule_type === 'asap'
                        ? <span className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">ASAP</span>
                        : <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{o.scheduled_at?.slice(0, 10)}</span>}
                    </div>
                    {o.hold_remark && <p className="text-xs text-yellow-700 mt-1">Hold: {o.hold_remark}</p>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {canEdit(o) && !['hold', 'dispatched', 'partially_dispatched'].includes(o.status) && (
                        <button onClick={() => toggleReady(o)} title={o.status === 'ready' ? 'Mark pending' : 'Mark ready'}
                          className={`p-1.5 rounded cursor-pointer ${o.status === 'ready' ? 'text-gray-500 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'}`}>
                          <FiCheck size={15} />
                        </button>
                      )}
                      {canEdit(o) && !['dispatched', 'partially_dispatched'].includes(o.status) && (
                        <button onClick={() => { setHoldOrder(o); setHoldRemark(''); }} title={o.status === 'hold' ? 'Release hold' : 'Hold'}
                          className={`p-1.5 rounded cursor-pointer ${o.status === 'hold' ? 'text-green-600 hover:bg-green-50' : 'text-yellow-600 hover:bg-yellow-50'}`}>
                          {o.status === 'hold' ? <FiPlay size={15} /> : <FiPause size={15} />}
                        </button>
                      )}
                      {canEdit(o) && o.status !== 'dispatched' && (
                        <button onClick={() => openEdit(o)} className="p-1.5 rounded text-indigo-600 hover:bg-indigo-50 cursor-pointer">
                          <FiEdit2 size={15} />
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(o)} className="p-1.5 rounded text-red-500 hover:bg-red-50 cursor-pointer">
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Expanded items row */}
                {expanded[o.id] && (
                  <tr key={`exp-${o.id}`} className="bg-indigo-50/40">
                    <td colSpan={7} className="px-8 py-3">
                      <div className="grid grid-cols-1 gap-1">
                        {o.items.map(i => (
                          <div key={i.id} className="flex items-center gap-3 text-xs">
                            <FiPackage size={11} className="text-indigo-400 shrink-0" />
                            <span className="font-medium text-gray-800 w-40 truncate">{i.product_name}</span>
                            {i.packing_size && <span className="text-gray-500">{i.packing_size}</span>}
                            {i.packing_type && <span className="text-gray-500">{i.packing_type}</span>}
                            <span className="ml-auto text-gray-700">
                              Remaining: <strong>{i.remaining_quantity}</strong> / {i.quantity} {i.unit}
                            </span>
                            {i.remaining_quantity < i.quantity && (
                              <span className="text-blue-600 font-medium">
                                ({i.quantity - i.remaining_quantity} {i.unit} dispatched)
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No orders found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* ── Create / Edit Order Modal ── */}
      {showModal && (
        <Modal title={editOrder ? `Edit Order #${editOrder.id}` : 'New Order'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Customer */}
            {!editOrder && (
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Customer *</label>
                <CustomerSearchSelect
                  customers={customers}
                  value={form.customer_id}
                  onChange={id => setForm(f => ({ ...f, customer_id: id }))}
                />
              </div>
            )}
            {editOrder && (
              <p className="text-sm font-medium text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                Customer: {editOrder.customer_name}
              </p>
            )}

            {/* Products */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Products *</label>
              <div className="space-y-3">
                {form.items.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)}
                        className="absolute top-2 right-2 text-red-400 hover:text-red-600 cursor-pointer">
                        <FiX size={14} />
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <input value={item.product_name} onChange={e => setItem(idx, 'product_name', e.target.value)}
                          placeholder="Product Name *" className={inp} required autoComplete="off" />
                      </div>
                      <input value={item.packing_size} onChange={e => setItem(idx, 'packing_size', e.target.value)}
                        placeholder="Packing Size (e.g. 50kg)" className={inp} />
                      <input value={item.packing_type} onChange={e => setItem(idx, 'packing_type', e.target.value)}
                        placeholder="Type (e.g. Bag, Drum)" className={inp} />
                      <input value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}
                        placeholder="Quantity *" type="number" min="0.01" step="any" className={inp} required />
                      <select value={item.unit} onChange={e => setItem(idx, 'unit', e.target.value)} className={inp}>
                        {['kg', 'litre', 'MT', 'nos', 'bag', 'drum'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer">
                  <FiPlus size={14} /> Add another product
                </button>
              </div>
            </div>

            {/* Options grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Delivery</label>
                <select value={form.delivery_type} onChange={e => setForm(f => ({ ...f, delivery_type: e.target.value }))} className={inp}>
                  <option value="dispatch">Dispatch</option>
                  <option value="pickup">Customer Pickup</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Billing</label>
                <select value={form.billing_type} onChange={e => setForm(f => ({ ...f, billing_type: e.target.value }))} className={inp}>
                  <option value="bill">On Bill</option>
                  <option value="challan">Challan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Order Type</label>
                <select value={form.order_type} onChange={e => setForm(f => ({ ...f, order_type: e.target.value }))} className={inp}>
                  <option value="new">New</option>
                  <option value="replacement">Replacement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Schedule</label>
                <select value={form.schedule_type} onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value }))} className={inp}>
                  <option value="asap">ASAP</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </div>
            </div>

            {form.schedule_type === 'scheduled' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Scheduled Date & Time *</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className={inp} required />
              </div>
            )}

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={form.allow_partial_dispatch}
                onChange={e => setForm(f => ({ ...f, allow_partial_dispatch: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-gray-700">Allow partial dispatch (split shipments)</span>
            </label>

            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)" rows={2} className={inp + ' resize-none'} />

            <button type="submit"
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editOrder ? 'Update Order' : 'Create Order'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Hold modal ── */}
      {holdOrder && (
        <Modal title={holdOrder.status === 'hold' ? 'Release Hold' : 'Hold Order'} onClose={() => setHoldOrder(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Order <strong>#{holdOrder.id}</strong> — {holdOrder.customer_name}
            </p>
            {holdOrder.status === 'hold' ? (
              <>
                <p className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded">
                  Current hold reason: {holdOrder.hold_remark}
                </p>
                <p className="text-sm text-gray-500">Release this order back to pending?</p>
                <button onClick={submitHold}
                  className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 cursor-pointer">
                  Release Hold
                </button>
              </>
            ) : (
              <>
                <textarea value={holdRemark} onChange={e => setHoldRemark(e.target.value)}
                  placeholder="Reason for hold *" rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-400 outline-none resize-none" />
                <button onClick={submitHold}
                  className="w-full py-2.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 cursor-pointer">
                  Place on Hold
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
