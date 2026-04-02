import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff } from 'react-icons/fi';

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'salesman' };

export default function Salesmen() {
  const { user } = useAuth();
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState({});

  // Block non-admin users
  if (user?.role !== 'admin') return <Navigate to="/" />;

  const load = async () => {
    const { data } = await api.get('/salesman');
    setSalesmen(data);

    // Fetch customer count per salesman
    try {
      const custRes = await api.get('/customers');
      const counts = {};
      custRes.data.forEach(c => {
        counts[c.salesman_id] = (counts[c.salesman_id] || 0) + 1;
      });
      setStats(counts);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        const payload = { ...form };
        if (!payload.password) delete payload.password; // Don't update password if empty
        await api.put(`/salesman/${editId}`, payload);
        toast.success('Salesman updated');
      } else {
        if (!form.password) return toast.error('Password is required for new salesman');
        await api.post('/salesman', form);
        toast.success('Salesman added');
      }
      setShowModal(false);
      setForm(emptyForm);
      setEditId(null);
      setShowPassword(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (s) => {
    setForm({ name: s.name, email: s.email, password: '', phone: s.phone || '', role: s.role });
    setEditId(s.id);
    setShowPassword(false);
    setShowModal(true);
  };

  const handleDelete = async (s) => {
    if (s.id === user.id) return toast.error("You cannot delete your own account");
    if (!confirm(`Delete "${s.name}"? All linked customers, trials, complaints, movements, and visit plans will be reassigned to an admin.`)) return;
    try {
      await api.delete(`/salesman/${s.id}`);
      toast.success('Salesman deleted and records reassigned');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const toggleActive = async (s) => {
    const newStatus = s.is_active ? 0 : 1;
    await api.put(`/salesman/${s.id}`, { is_active: newStatus });
    toast.success(newStatus ? 'Salesman activated' : 'Salesman deactivated');
    load();
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  const activeSalesmen = salesmen.filter(s => s.role === 'salesman' && s.is_active);
  const totalCustomers = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manage Salesmen</h1>
          <p className="text-gray-500 mt-1">
            {activeSalesmen.length} active salesmen managing {totalCustomers} customers
          </p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditId(null); setShowPassword(false); setShowModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
          <FiPlus size={16} /> Add Salesman
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Customers', 'Status', 'Joined', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {salesmen.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-gray-600">{s.email}</td>
                  <td className="px-4 py-3 text-gray-600">{s.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      s.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {s.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{stats[s.id] || 0}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(s)} className="cursor-pointer">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.created_at?.split(' ')[0]}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(s)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Edit">
                        <FiEdit2 size={16} />
                      </button>
                      {s.id !== user.id && (
                        <button onClick={() => handleDelete(s)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete">
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {salesmen.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No salesmen found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Salesman' : 'Add New Salesman'} onClose={() => { setShowModal(false); setShowPassword(false); }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="e.g. Rajesh Kumar" className={inp} required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                placeholder="e.g. rajesh.kumar@feedsales.com" className={inp} required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {editId ? 'New Password (leave blank to keep current)' : 'Password *'}
              </label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  placeholder={editId ? 'Leave blank to keep current' : 'Enter password'}
                  className={inp} required={!editId} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer">
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="e.g. 9876543210" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className={inp}>
                <option value="salesman">Salesman</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Salesman' : 'Add Salesman'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
