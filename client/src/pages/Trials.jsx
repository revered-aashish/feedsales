import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

const emptyForm = { customer_id: '', product: '', quantity: '', status: 'pending', start_date: '', end_date: '', notes: '' };

export default function Trials() {
  const [trials, setTrials] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = () => api.get('/trials').then(r => setTrials(r.data));

  useEffect(() => { load(); api.get('/customers').then(r => setCustomers(r.data)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) { await api.put(`/trials/${editId}`, form); toast.success('Trial updated'); }
      else { await api.post('/trials', form); toast.success('Trial created'); }
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (t) => {
    setForm({ customer_id: t.customer_id, product: t.product, quantity: t.quantity || '',
      status: t.status, start_date: t.start_date || '', end_date: t.end_date || '', notes: t.notes || '' });
    setEditId(t.id); setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this trial?')) return;
    await api.delete(`/trials/${id}`); toast.success('Trial deleted'); load();
  };

  const statusColor = { pending: 'bg-yellow-100 text-yellow-700', in_progress: 'bg-blue-100 text-blue-700',
    successful: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Trials</h1>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
          <FiPlus size={16} /> Add Trial
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer', 'Product', 'Quantity', 'Status', 'Start Date', 'Salesman', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trials.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{t.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{t.product}</td>
                  <td className="px-4 py-3 text-gray-600">{t.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[t.status] || ''}`}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.start_date}</td>
                  <td className="px-4 py-3 text-gray-600">{t.salesman_name}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => handleEdit(t)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={16} /></button>
                    <button onClick={() => handleDelete(t.id)} className="text-red-500 hover:text-red-700 cursor-pointer"><FiTrash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {trials.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No trials found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Trial' : 'Add Trial'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className={inp} required>
              <option value="">Select Customer *</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
            </select>
            <input value={form.product} onChange={e => setForm({...form, product: e.target.value})} placeholder="Product *" className={inp} required />
            <input value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} placeholder="Quantity" className={inp} />
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="successful">Successful</option>
              <option value="failed">Failed</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className={inp} />
              </div>
            </div>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes" className={inp} rows={3} />
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Trial' : 'Create Trial'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
