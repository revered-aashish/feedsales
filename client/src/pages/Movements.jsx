import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiX } from 'react-icons/fi';

const today = new Date().toISOString().split('T')[0];
const emptyForm = { customer_id: '', visit_date: today, purpose: '', location: '', notes: '', status: 'planned' };

export default function Movements() {
  const { user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');

  const load = () => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (filterCustomer) params.customer_id = filterCustomer;
    if (filterSalesman) params.salesman_id = filterSalesman;
    api.get('/movements', { params }).then(r => setMovements(r.data));
  };

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    if (user?.role === 'admin') {
      api.get('/salesman').then(r => setSalesmen(r.data));
    }
  }, []);

  useEffect(() => { load(); }, [dateFrom, dateTo, filterCustomer, filterSalesman]);

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setFilterCustomer('');
    setFilterSalesman('');
  };

  const activeFilterCount = [dateFrom, dateTo, filterCustomer, filterSalesman].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) { await api.put(`/movements/${editId}`, form); toast.success('Movement updated'); }
      else { await api.post('/movements', form); toast.success('Movement created'); }
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (m) => {
    setForm({ customer_id: m.customer_id, visit_date: m.visit_date, purpose: m.purpose,
      location: m.location || '', notes: m.notes || '', status: m.status });
    setEditId(m.id); setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this movement?')) return;
    await api.delete(`/movements/${id}`); toast.success('Movement deleted'); load();
  };

  const statusColor = { planned: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700' };
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Daily Movements Achieved</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border cursor-pointer transition-colors ${
              activeFilterCount > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            <FiFilter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> Add Movement
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filter Movements</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
                <FiX size={14} /> Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className={inp} />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className={inp} />
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Customer</label>
              <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className={inp}>
                <option value="">All Customers</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
              </select>
            </div>

            {/* Salesman Name (admin only) */}
            {user?.role === 'admin' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Salesman</label>
                <select value={filterSalesman} onChange={e => setFilterSalesman(e.target.value)} className={inp}>
                  <option value="">All Salesmen</option>
                  {salesmen.filter(s => s.role === 'salesman').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Active filters summary */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
              {dateFrom && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  From: {dateFrom}
                  <button onClick={() => setDateFrom('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  To: {dateTo}
                  <button onClick={() => setDateTo('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterCustomer && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Customer: {customers.find(c => c.id == filterCustomer)?.name}
                  <button onClick={() => setFilterCustomer('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterSalesman && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Salesman: {salesmen.find(s => s.id == filterSalesman)?.name}
                  <button onClick={() => setFilterSalesman('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center">{movements.length} results</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'Customer', 'Purpose', 'Location', 'Status', 'Salesman', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map(m => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{m.visit_date}</td>
                  <td className="px-4 py-3 text-gray-600">{m.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.purpose}</td>
                  <td className="px-4 py-3 text-gray-600">{m.location}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[m.status] || ''}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.salesman_name}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => handleEdit(m)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={16} /></button>
                    <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:text-red-700 cursor-pointer"><FiTrash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No movements found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Movement' : 'Add Movement'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className={inp} required>
              <option value="">Select Customer *</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
            </select>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Visit Date *</label>
              <input type="date" value={form.visit_date} onChange={e => setForm({...form, visit_date: e.target.value})} className={inp} required />
            </div>
            <select value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})} className={inp} required>
              <option value="">Select Purpose *</option>
              <option value="Sales Visit">Sales Visit</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Product Demo">Product Demo</option>
              <option value="Complaint Resolution">Complaint Resolution</option>
              <option value="Payment Collection">Payment Collection</option>
              <option value="New Introduction">New Introduction</option>
              <option value="Other">Other</option>
            </select>
            <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Location" className={inp} />
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes" className={inp} rows={3} />
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Movement' : 'Add Movement'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
