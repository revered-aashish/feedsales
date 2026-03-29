import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2 } from 'react-icons/fi';

const emptyForm = { customer_id: '', subject: '', description: '', status: 'open', resolution: '' };

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = () => api.get('/complaints').then(r => setComplaints(r.data));

  useEffect(() => { load(); api.get('/customers').then(r => setCustomers(r.data)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) { await api.put(`/complaints/${editId}`, form); toast.success('Complaint updated'); }
      else { await api.post('/complaints', form); toast.success('Complaint created'); }
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (c) => {
    setForm({ customer_id: c.customer_id, subject: c.subject, description: c.description || '',
      status: c.status, resolution: c.resolution || '' });
    setEditId(c.id); setShowModal(true);
  };

  const statusColor = { open: 'bg-red-100 text-red-700', in_progress: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700' };
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Complaints</h1>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
          <FiPlus size={16} /> New Complaint
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer', 'Subject', 'Status', 'Salesman', 'Created', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {complaints.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[c.status] || ''}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.salesman_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.created_at?.split('T')[0]}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleEdit(c)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No complaints found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Complaint' : 'New Complaint'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <select value={form.customer_id} onChange={e => setForm({...form, customer_id: e.target.value})} className={inp} required>
              <option value="">Select Customer *</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
            </select>
            <input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Subject *" className={inp} required />
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Description" className={inp} rows={3} />
            {editId && (
              <>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
                <textarea value={form.resolution} onChange={e => setForm({...form, resolution: e.target.value})} placeholder="Resolution" className={inp} rows={2} />
              </>
            )}
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Complaint' : 'Submit Complaint'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
