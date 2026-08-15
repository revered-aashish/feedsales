import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  FiPlus, FiEdit2, FiTrash2, FiDownload, FiClock, FiCheckCircle, FiAward,
} from 'react-icons/fi';

const emptyForm = {
  customer_id: '', client_name: '',
  casting_weight: '', casting_thickness: '', metal_type: '', pouring_temperature: '', pouring_time: '', pouring_mode: '',
  application: '', baume_as_is: '', dilution_ratio: '', viscosity_diluted: '', baume_diluted: '', wft_diluted: '', mixing_process: '', coating_layers: '',
  binder_system: '', sand_afs: '', drying_method: '',
  current_coating_used: '', current_coating_issues: '', approximate_consumption: '',
  remarks: '',
};

// Field groups: [label, key]
const SECTIONS = [
  ['Casting Details', [
    ['Weight of Casting (Kg)', 'casting_weight'],
    ['Casting Thickness (mm)', 'casting_thickness'],
    ['Metal Type', 'metal_type'],
    ['Pouring Temperature (°C)', 'pouring_temperature'],
    ['Pouring Time', 'pouring_time'],
    ['Pouring Mode', 'pouring_mode'],
  ]],
  ['Coating Section', [
    ['Application', 'application'],
    ['Baume (As It Is)', 'baume_as_is'],
    ['Dilution Ratio', 'dilution_ratio'],
    ['Viscosity (Diluted)', 'viscosity_diluted'],
    ['Baume (Diluted)', 'baume_diluted'],
    ['WFT (Diluted / Micron)', 'wft_diluted'],
    ['Mixing Process', 'mixing_process'],
    ['No. of Coating Layers', 'coating_layers'],
  ]],
  ['Mould Section', [
    ['Binder System', 'binder_system'],
    ['Sand AFS', 'sand_afs'],
    ['Drying Method', 'drying_method'],
  ]],
  ['Current Coating', [
    ['Current Coating Used', 'current_coating_used'],
    ['Issues in Current Coating', 'current_coating_issues'],
    ['Approximate Consumption', 'approximate_consumption'],
  ]],
];

export default function CoatingSamples() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [samples, setSamples] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [recModal, setRecModal] = useState(null); // sample being recommended
  const [recForm, setRecForm] = useState({ recommended_product: '', recommendation_remarks: '' });

  const [auditModal, setAuditModal] = useState(null); // sample id
  const [audit, setAudit] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get('/coating-samples');
      setSamples(data);
    } catch { toast.error('Failed to load coating samples'); }
    try {
      const { data } = await api.get('/customers');
      setCustomers(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditId(null); setShowModal(true); };

  const openEdit = (s) => {
    const f = { ...emptyForm };
    Object.keys(emptyForm).forEach(k => { f[k] = s[k] ?? ''; });
    f.customer_id = s.customer_id ? String(s.customer_id) : '';
    setForm(f);
    setEditId(s.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, customer_id: form.customer_id || null };
      if (editId) {
        await api.put(`/coating-samples/${editId}`, payload);
        toast.success('Coating sample updated');
      } else {
        await api.post('/coating-samples', payload);
        toast.success('Coating sample created');
      }
      setShowModal(false); setEditId(null); setForm(emptyForm);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error saving'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (s) => {
    if (!confirm('Delete this coating sample and its audit history?')) return;
    try { await api.delete(`/coating-samples/${s.id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to delete'); }
  };

  const openRecommend = (s) => {
    setRecForm({ recommended_product: s.recommended_product || '', recommendation_remarks: s.recommendation_remarks || '' });
    setRecModal(s);
  };

  const submitRecommend = async (e) => {
    e.preventDefault();
    if (!recForm.recommended_product.trim()) return toast.error('Enter a recommended product');
    try {
      await api.put(`/coating-samples/${recModal.id}/recommend`, recForm);
      toast.success('Recommendation saved');
      setRecModal(null);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const openAudit = async (s) => {
    setAuditModal(s.id);
    setAudit([]);
    try { const { data } = await api.get(`/coating-samples/${s.id}/audit`); setAudit(data); }
    catch { toast.error('Failed to load audit log'); }
  };

  const downloadPDF = async (s) => {
    try {
      const res = await api.get(`/coating-samples/${s.id}/download/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      const disp = res.headers['content-disposition'];
      a.download = disp ? disp.split('filename="')[1]?.replace('"', '') : `Coating_Sample_${s.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('Failed to download PDF'); }
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";
  const clientOf = (s) => s.client_name || s.customer_company || s.customer_name || '—';
  const canEdit = (s) => isAdmin || s.salesman_id === user?.id;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Coating Samples</h1>
          <p className="text-gray-500 mt-1">{samples.length} sample data sheet{samples.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
          <FiPlus size={16} /> New Sample Sheet
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Client', 'Metal / Application', 'Salesman', 'Recommendation', 'Status', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {samples.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{clientOf(s)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="block">{s.metal_type || '—'}</span>
                    <span className="text-xs text-gray-400">{s.application || ''}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.salesman_name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.recommended_product
                      ? <span className="font-medium text-green-700">{s.recommended_product}</span>
                      : <span className="text-gray-400 text-xs">Awaiting</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'recommended'
                      ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><FiCheckCircle size={11} /> Recommended</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><FiClock size={11} /> Pending</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => downloadPDF(s)} className="text-gray-500 hover:text-green-600 cursor-pointer" title="Download PDF"><FiDownload size={16} /></button>
                      <button onClick={() => openAudit(s)} className="text-gray-500 hover:text-indigo-600 cursor-pointer" title="Audit Log"><FiClock size={16} /></button>
                      {isAdmin && (
                        <button onClick={() => openRecommend(s)} className="text-green-600 hover:text-green-800 cursor-pointer" title="Recommend Product"><FiAward size={16} /></button>
                      )}
                      {canEdit(s) && (
                        <button onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Edit"><FiEdit2 size={16} /></button>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(s)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete"><FiTrash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {samples.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No coating samples yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <Modal title={editId ? 'Edit Coating Sample' : 'New Coating Sample'} onClose={() => { setShowModal(false); setEditId(null); }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Customer</label>
                <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className={inp}>
                  <option value="">— Select customer —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client Name (if not in list)</label>
                <input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} className={inp} placeholder="Optional" />
              </div>
            </div>

            {SECTIONS.map(([title, fields]) => (
              <div key={title}>
                <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide border-b border-gray-100 pb-1 mb-2">{title}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fields.map(([label, key]) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className={inp} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Remarks</label>
              <textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} className={inp} rows={2} />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer disabled:opacity-50">
              {submitting ? 'Saving…' : editId ? 'Update Sample' : 'Create Sample'}
            </button>
          </form>
        </Modal>
      )}

      {/* Recommend modal (admin) */}
      {recModal && (
        <Modal title="Recommend Product" onClose={() => setRecModal(null)}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
            <div><span className="text-gray-400">Client:</span> <span className="font-medium text-gray-800">{clientOf(recModal)}</span></div>
            <div><span className="text-gray-400">Metal:</span> {recModal.metal_type || '—'} · <span className="text-gray-400">Application:</span> {recModal.application || '—'}</div>
          </div>
          <form onSubmit={submitRecommend} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recommended Product *</label>
              <input value={recForm.recommended_product} onChange={e => setRecForm({ ...recForm, recommended_product: e.target.value })}
                className={inp} placeholder="e.g. Feedcoat ZR-200" required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Recommendation Remarks</label>
              <textarea value={recForm.recommendation_remarks} onChange={e => setRecForm({ ...recForm, recommendation_remarks: e.target.value })}
                className={inp} rows={3} placeholder="Dilution, application notes, etc." />
            </div>
            <button type="submit" className="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 cursor-pointer">
              Save Recommendation
            </button>
          </form>
        </Modal>
      )}

      {/* Audit log modal */}
      {auditModal && (
        <Modal title="Audit Log" onClose={() => setAuditModal(null)}>
          {audit.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No activity recorded yet</p>
          ) : (
            <div className="space-y-3">
              {audit.map(a => (
                <div key={a.id} className="flex gap-3 border-l-2 border-indigo-200 pl-3">
                  <div className="flex-1">
                    <div className="text-sm text-gray-800">
                      <span className="font-medium capitalize">{a.action.replace(/_/g, ' ')}</span>
                      {a.details && <span className="text-gray-500"> — {a.details}</span>}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {a.user_name}{a.user_role === 'admin' ? ' (Admin)' : ''} · {a.created_at}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
