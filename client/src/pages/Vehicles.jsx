import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiPower, FiTruck } from 'react-icons/fi';

const emptyForm = { vehicle_number: '', driver_name: '' };

export default function Vehicles() {
  const { user } = useAuth();
  if (user?.role !== 'admin' && !user?.is_dispatch_manager) return <Navigate to="/" />;

  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = async () => {
    const { data } = await api.get('/vehicles', { params: showAll ? { all: 1 } : {} });
    setVehicles(data);
  };

  useEffect(() => { load(); }, [showAll]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/vehicles/${editId}`, form);
        toast.success('Vehicle updated');
      } else {
        await api.post('/vehicles', form);
        toast.success('Vehicle added');
      }
      setShowModal(false); setForm(emptyForm); setEditId(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const toggleActive = async (v) => {
    await api.put(`/vehicles/${v.id}`, { is_active: v.is_active ? 0 : 1 });
    toast.success(v.is_active ? 'Vehicle deactivated' : 'Vehicle activated');
    load();
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vehicles</h1>
          <p className="text-gray-500 text-sm mt-0.5">{vehicles.filter(v => v.is_active).length} active</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} className="accent-indigo-600" />
            Show inactive
          </label>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={15} /> Add Vehicle
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {vehicles.map(v => (
          <div key={v.id} className={`bg-white rounded-xl shadow-sm border p-4 flex items-center gap-3 ${!v.is_active ? 'opacity-50' : 'border-gray-100'}`}>
            <div className="p-2.5 bg-indigo-50 rounded-lg">
              <FiTruck size={20} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800">{v.vehicle_number}</p>
              <p className="text-xs text-gray-500">{v.driver_name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setForm({ vehicle_number: v.vehicle_number, driver_name: v.driver_name }); setEditId(v.id); setShowModal(true); }}
                className="p-1.5 text-indigo-500"><FiEdit2 size={17} /></button>
              <button onClick={() => toggleActive(v)}
                className={`p-1.5 ${v.is_active ? 'text-red-400' : 'text-green-500'}`}><FiPower size={17} /></button>
            </div>
          </div>
        ))}
        {vehicles.length === 0 && <p className="text-center text-gray-400 text-sm py-12">No vehicles yet</p>}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Vehicle Number', 'Driver', 'Status', 'Added', 'Actions'].map(h =>
                <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehicles.map(v => (
              <tr key={v.id} className={`hover:bg-gray-50 ${!v.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-semibold text-gray-800 flex items-center gap-2">
                  <FiTruck size={15} className="text-indigo-400" /> {v.vehicle_number}
                </td>
                <td className="px-4 py-3 text-gray-600">{v.driver_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{v.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => { setForm({ vehicle_number: v.vehicle_number, driver_name: v.driver_name }); setEditId(v.id); setShowModal(true); }}
                    className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={15} /></button>
                  <button onClick={() => toggleActive(v)}
                    className={`cursor-pointer ${v.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}>
                    <FiPower size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No vehicles yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Vehicle' : 'Add Vehicle'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))}
              placeholder="Vehicle Number *" className={inp} required />
            <input value={form.driver_name} onChange={e => setForm(f => ({ ...f, driver_name: e.target.value }))}
              placeholder="Driver Name *" className={inp} required />
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
