import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiEyeOff, FiDownload, FiMapPin, FiX } from 'react-icons/fi';
import { useRegion } from '../context/RegionContext';

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'salesman', is_dispatch_manager: false, region: '' };

export default function Salesmen() {
  const { user } = useAuth();
  const { regions, refreshRegions } = useRegion();
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [stats, setStats] = useState({});
  const [showRegionModal, setShowRegionModal] = useState(false);

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
    if (form.role === 'salesman' && !form.region) {
      return toast.error('Please assign a region to the salesman');
    }
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
    setForm({ name: s.name, email: s.email, password: '', phone: s.phone || '', role: s.role, is_dispatch_manager: !!s.is_dispatch_manager, region: s.region || '' });
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

  const downloadBackup = async () => {
    try {
      toast.loading('Preparing backup…', { id: 'backup' });
      const res = await api.get('/backup/db', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      // Pull filename from Content-Disposition header if available
      const cd = res.headers['content-disposition'] || '';
      const match = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : 'feedsales-backup.db';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded', { id: 'backup' });
    } catch (err) {
      toast.error('Backup failed', { id: 'backup' });
    }
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
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRegionModal(true)}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
            <FiMapPin size={16} /> Manage Regions
          </button>
          <button onClick={downloadBackup}
            className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
            <FiDownload size={16} /> Backup DB
          </button>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowPassword(false); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> Add Salesman
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Email', 'Phone', 'Role', 'Region', 'Customers', 'Status', 'Joined', 'Actions'].map(h =>
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
                  <td className="px-4 py-3">
                    {s.region
                      ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">{s.region}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
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
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No salesmen found</td></tr>
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Region {form.role === 'salesman' && <span className="text-red-500">*</span>}
              </label>
              <select value={form.region} onChange={e => setForm({...form, region: e.target.value})}
                className={inp} required={form.role === 'salesman'}>
                <option value="">{form.role === 'admin' ? '— All regions (admin) —' : '— Select region —'}</option>
                {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              {regions.length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">No regions yet — add one via "Manage Regions".</p>
              )}
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
              <input type="checkbox" checked={form.is_dispatch_manager}
                onChange={e => setForm({ ...form, is_dispatch_manager: e.target.checked })}
                className="w-4 h-4 accent-indigo-600" />
              <span className="text-sm text-gray-700">Dispatch Manager privileges</span>
            </label>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Salesman' : 'Add Salesman'}
            </button>
          </form>
        </Modal>
      )}

      {showRegionModal && (
        <RegionManagerModal
          regions={regions}
          onClose={() => setShowRegionModal(false)}
          onChanged={() => { refreshRegions(); load(); }}
        />
      )}
    </div>
  );
}

function RegionManagerModal({ regions, onClose, onChanged }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  const add = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/regions', { name: newName.trim() });
      toast.success('Region added');
      setNewName('');
      onChanged();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add region'); }
  };

  const saveRename = async (id) => {
    if (!editName.trim()) return;
    try {
      await api.put(`/regions/${id}`, { name: editName.trim() });
      toast.success('Region renamed');
      setEditingId(null);
      onChanged();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to rename'); }
  };

  const remove = async (r) => {
    if (!confirm(`Delete region "${r.name}"?`)) return;
    try {
      await api.delete(`/regions/${r.id}`);
      toast.success('Region deleted');
      onChanged();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <Modal title="Manage Regions" onClose={onClose}>
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="New region name e.g. Ahmedabad Region" className={inp} />
        <button type="submit" className="shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
          Add
        </button>
      </form>

      <div className="space-y-2">
        {regions.map(r => (
          <div key={r.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2">
            {editingId === r.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className={inp} autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRename(r.id); } }} />
                <button onClick={() => saveRename(r.id)}
                  className="shrink-0 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700">Save</button>
                <button onClick={() => setEditingId(null)}
                  className="shrink-0 text-gray-400 hover:text-gray-600 cursor-pointer"><FiX size={16} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-800 font-medium">{r.name}</span>
                <span className="text-xs text-gray-400">{r.salesman_count || 0} salesmen</span>
                <button onClick={() => { setEditingId(r.id); setEditName(r.name); }}
                  className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Rename"><FiEdit2 size={15} /></button>
                <button onClick={() => remove(r)}
                  className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete"><FiTrash2 size={15} /></button>
              </>
            )}
          </div>
        ))}
        {regions.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">No regions yet. Add your first region above.</p>
        )}
      </div>
    </Modal>
  );
}
