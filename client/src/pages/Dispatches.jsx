import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  FiPlus, FiTruck, FiChevronDown, FiChevronUp, FiCheck,
  FiTrash2, FiPackage, FiFilter, FiX,
} from 'react-icons/fi';

const STATUS_META = {
  pending:   { label: 'Pending',   bg: 'bg-yellow-100', fg: 'text-yellow-700' },
  completed: { label: 'Completed', bg: 'bg-green-100',  fg: 'text-green-700' },
};

export default function Dispatches() {
  const { user } = useAuth();
  if (user?.role !== 'admin' && !user?.is_dispatch_manager) return <Navigate to="/" />;

  const [dispatches, setDispatches] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [readyOrders, setReadyOrders] = useState([]);  // orders eligible for dispatch
  const [expanded, setExpanded] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Create dispatch state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ vehicle_id: '', dispatch_date: '', notes: '' });
  // selectedItems: { [order_item_id]: qty_string }
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});

  const load = async () => {
    const params = {};
    if (filterStatus) params.status = filterStatus;
    const { data } = await api.get('/dispatches', { params });
    setDispatches(data);
  };

  const loadPrereqs = async () => {
    const [vRes, oRes] = await Promise.all([
      api.get('/vehicles'),
      // Fetch pending, ready, partially_dispatched orders for clubbing
      api.get('/orders', { params: { status: 'ready' } }),
    ]);
    setVehicles(vRes.data);
    // Also fetch partially dispatched separately and merge
    const partRes = await api.get('/orders', { params: { status: 'partially_dispatched' } });
    setReadyOrders([...oRes.data, ...partRes.data]);
  };

  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => { loadPrereqs(); }, []);

  // ── Create dispatch ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setCreateForm({ vehicle_id: '', dispatch_date: new Date().toISOString().slice(0, 10), notes: '' });
    setSelectedItems({});
    setExpandedOrders({});
    setShowCreate(true);
  };

  const toggleItemSelect = (orderItemId, defaultQty) => {
    setSelectedItems(prev => {
      if (prev[orderItemId] !== undefined) {
        const n = { ...prev };
        delete n[orderItemId];
        return n;
      }
      return { ...prev, [orderItemId]: String(defaultQty) };
    });
  };

  const setItemQty = (orderItemId, val) => {
    setSelectedItems(prev => ({ ...prev, [orderItemId]: val }));
  };

  const handleCreateDispatch = async (e) => {
    e.preventDefault();
    if (!createForm.vehicle_id) return toast.error('Select a vehicle');
    if (!createForm.dispatch_date) return toast.error('Select dispatch date');

    const items = Object.entries(selectedItems)
      .filter(([, qty]) => qty && Number(qty) > 0)
      .map(([order_item_id, qty]) => ({ order_item_id: Number(order_item_id), dispatched_quantity: Number(qty) }));

    if (!items.length) return toast.error('Select at least one product to dispatch');

    try {
      await api.post('/dispatches', { ...createForm, items });
      toast.success('Dispatch created');
      setShowCreate(false);
      load();
      loadPrereqs();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const markComplete = async (d) => {
    try {
      await api.put(`/dispatches/${d.id}/complete`);
      toast.success('Marked as completed');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleDelete = async (d) => {
    if (!confirm(`Delete Dispatch #${d.id}? Quantities will be restored.`)) return;
    try {
      await api.delete(`/dispatches/${d.id}`);
      toast.success('Dispatch deleted, quantities restored');
      load(); loadPrereqs();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const StatusBadge = ({ status }) => {
    const m = STATUS_META[status] || STATUS_META.pending;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.bg} ${m.fg}`}>{m.label}</span>;
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";
  const selectedCount = Object.keys(selectedItems).length;

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dispatch Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{dispatches.length} dispatch{dispatches.length !== 1 ? 'es' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border cursor-pointer ${filterStatus ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            <FiFilter size={15} /> Filter
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={15} /> New Dispatch
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1 font-medium">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inp}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            {filterStatus && (
              <button onClick={() => setFilterStatus('')}
                className="mt-5 flex items-center gap-1 text-xs text-red-500 cursor-pointer"><FiX size={13} /> Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── Dispatches list ── */}
      <div className="space-y-4">
        {dispatches.map(d => (
          <div key={d.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
              <FiTruck size={16} className="text-indigo-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{d.vehicle_number}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-sm text-gray-600">{d.driver_name}</span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {d.dispatch_date} · {d.items.length} item{d.items.length !== 1 ? 's' : ''} · by {d.created_by_name}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {d.status === 'pending' && (
                  <button onClick={() => markComplete(d)}
                    className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-100 cursor-pointer">
                    <FiCheck size={12} /> Done
                  </button>
                )}
                {d.status === 'pending' && (
                  <button onClick={() => handleDelete(d)}
                    className="p-1.5 text-red-400 hover:text-red-600 cursor-pointer"><FiTrash2 size={14} /></button>
                )}
                <button onClick={() => setExpanded(x => ({ ...x, [d.id]: !x[d.id] }))}
                  className="p-1.5 text-gray-500 hover:text-gray-700 cursor-pointer">
                  {expanded[d.id] ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                </button>
              </div>
            </div>

            {/* Items */}
            {expanded[d.id] && (
              <div className="divide-y divide-gray-50">
                {d.items.map(i => (
                  <div key={i.id} className="px-4 py-2.5 flex items-center gap-3">
                    <FiPackage size={13} className="text-indigo-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{i.product_name}</p>
                      <p className="text-xs text-gray-500">{i.customer_name} · {i.salesman_name}</p>
                      {i.packing_size && <p className="text-xs text-gray-400">{i.packing_size} {i.packing_type}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-800">{i.dispatched_quantity} {i.unit}</p>
                      <p className="text-xs text-gray-400">of {i.original_quantity} {i.unit}</p>
                    </div>
                  </div>
                ))}
                {d.notes && (
                  <div className="px-4 py-2 bg-gray-50">
                    <p className="text-xs text-gray-500">Notes: {d.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {dispatches.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-12 text-center">
            <FiTruck size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">No dispatches yet</p>
          </div>
        )}
      </div>

      {/* ── Create Dispatch Modal ── */}
      {showCreate && (
        <Modal title="New Dispatch" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreateDispatch} className="space-y-4">

            {/* Vehicle + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Vehicle *</label>
                <select value={createForm.vehicle_id} onChange={e => setCreateForm(f => ({ ...f, vehicle_id: e.target.value }))} className={inp} required>
                  <option value="">Select vehicle</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} – {v.driver_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Dispatch Date *</label>
                <input type="date" value={createForm.dispatch_date}
                  onChange={e => setCreateForm(f => ({ ...f, dispatch_date: e.target.value }))}
                  className={inp} required />
              </div>
            </div>

            {/* Order selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500 font-medium">Select Products to Dispatch</label>
                {selectedCount > 0 && (
                  <span className="text-xs text-indigo-600 font-medium">{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</span>
                )}
              </div>

              {readyOrders.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <p className="text-sm text-gray-400">No ready orders available</p>
                  <p className="text-xs text-gray-400 mt-1">Mark orders as "Ready" first</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {readyOrders.map(order => (
                    <div key={order.id} className="bg-white">
                      {/* Order header */}
                      <button type="button"
                        onClick={() => setExpandedOrders(x => ({ ...x, [order.id]: !x[order.id] }))}
                        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 cursor-pointer text-left">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{order.customer_name}</p>
                          <p className="text-xs text-gray-500">{order.salesman_name} · #{order.id}
                            {order.allow_partial_dispatch ? ' · partial ok' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${order.status === 'partially_dispatched' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {order.status === 'partially_dispatched' ? 'Partial' : 'Ready'}
                          </span>
                          {expandedOrders[order.id] ? <FiChevronUp size={13} /> : <FiChevronDown size={13} />}
                        </div>
                      </button>

                      {/* Order items */}
                      {expandedOrders[order.id] && order.items
                        .filter(i => i.remaining_quantity > 0)
                        .map(item => {
                          const isSelected = selectedItems[item.id] !== undefined;
                          return (
                            <div key={item.id}
                              className={`flex items-center gap-2 px-3 py-2 border-t border-gray-50 ${isSelected ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}>
                              <input type="checkbox" checked={isSelected}
                                onChange={() => toggleItemSelect(item.id, item.remaining_quantity)}
                                className="accent-indigo-600 shrink-0 w-4 h-4" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-800 truncate">{item.product_name}</p>
                                {item.packing_size && <p className="text-xs text-gray-400">{item.packing_size} {item.packing_type}</p>}
                                <p className="text-xs text-gray-500">Remaining: {item.remaining_quantity} {item.unit}</p>
                              </div>
                              {isSelected && (
                                <div className="shrink-0 w-24">
                                  <input
                                    type="number" min="0.01" step="any"
                                    max={item.remaining_quantity}
                                    value={selectedItems[item.id]}
                                    onChange={e => setItemQty(item.id, e.target.value)}
                                    className="w-full px-2 py-1 border border-indigo-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder={`qty (${item.unit})`}
                                    onClick={e => e.stopPropagation()}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)" rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none" />

            <button type="submit"
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              Create Dispatch{selectedCount > 0 ? ` (${selectedCount} item${selectedCount !== 1 ? 's' : ''})` : ''}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
