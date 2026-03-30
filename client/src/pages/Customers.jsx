import { useEffect, useState } from 'react';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';

const emptyForm = { name: '', company: '', phone: '', email: '', address: '', city: '', state: '', salesman_id: '', is_lost: 0, lost_reason: '' };

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = () => api.get('/customers', { params: { search } }).then(r => setCustomers(r.data));

  useEffect(() => { load(); }, [search]);
  useEffect(() => { api.get('/salesman').then(r => setSalesmen(r.data)); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/customers/${editId}`, form);
        toast.success('Customer updated');
      } else {
        await api.post('/customers', form);
        toast.success('Customer created');
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (c) => {
    setForm({ name: c.name, company: c.company || '', phone: c.phone || '', email: c.email || '',
      address: c.address || '', city: c.city || '', state: c.state || '',
      salesman_id: c.salesman_id || '', is_lost: c.is_lost || 0, lost_reason: c.lost_reason || '' });
    setEditId(c.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this customer and all related data?')) return;
    await api.delete(`/customers/${id}`);
    toast.success('Customer deleted');
    load();
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
          <FiPlus size={16} /> Add Customer
        </button>
      </div>

      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Company', 'City', 'Phone', 'Salesman', 'Status', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.company}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{c.salesman_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_lost ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {c.is_lost ? 'Lost' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => handleEdit(c)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={16} /></button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 cursor-pointer"><FiTrash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No customers found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Customer' : 'Add Customer'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Customer Name *" className={inp} required />
            <input value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Company" className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone" className={inp} />
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className={inp} />
            </div>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Address" className={inp} />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="City" className={inp} />
              <input value={form.state} onChange={e => setForm({...form, state: e.target.value})} placeholder="State" className={inp} />
            </div>
            <select value={form.salesman_id} onChange={e => setForm({...form, salesman_id: e.target.value})} className={inp}>
              <option value="">Assign Salesman</option>
              {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {editId && (
              <>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.is_lost === 1} onChange={e => setForm({...form, is_lost: e.target.checked ? 1 : 0})} />
                  Mark as Lost Customer
                </label>
                {form.is_lost === 1 && (
                  <input value={form.lost_reason} onChange={e => setForm({...form, lost_reason: e.target.value})} placeholder="Lost Reason" className={inp} />
                )}
              </>
            )}
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Customer' : 'Create Customer'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
