import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

const today = new Date().toISOString().split('T')[0];
const emptyForm = { customer_id: '', visit_date: today, purpose: '', location: '', notes: '', status: 'planned' };

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = () => {
    const params = {};
    if (filterDate) params.visit_date = filterDate;
    api.get('/movements', { params }).then(r => setMovements(r.data));
  };

  useEffect(() => { load(); api.get('/customers').then(r => setCustomers(r.data)); }, []);
  useEffect(() => { load(); }, [filterDate]);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Daily Movements</h1>
        <div className="flex gap-3">
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> Add Movement
          </button>
        </div>
      </div>

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
