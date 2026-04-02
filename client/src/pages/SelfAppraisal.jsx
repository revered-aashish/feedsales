import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiX, FiTarget, FiUsers, FiAlertTriangle } from 'react-icons/fi';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const emptyForm = {
  month: currentMonth, year: currentYear,
  coating_target: '', coating_sales: '',
  resin_target: '', resin_sales: '',
  coalseam_target: '', coalseam_sales: '',
  new_customers: '', issues_faced: ''
};

export default function SelfAppraisal() {
  const { user } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = () => {
    const params = {};
    if (filterYear) params.year = filterYear;
    if (filterMonth) params.month = filterMonth;
    if (filterSalesman) params.salesman_id = filterSalesman;
    api.get('/appraisals', { params }).then(r => setAppraisals(r.data));
  };

  useEffect(() => { if (isAdmin) api.get('/salesman').then(r => setSalesmen(r.data)); }, []);
  useEffect(() => { load(); }, [filterYear, filterMonth, filterSalesman]);

  const clearFilters = () => { setFilterYear(''); setFilterMonth(''); setFilterSalesman(''); };
  const activeFilterCount = [filterYear, filterMonth, filterSalesman].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        month: parseInt(form.month), year: parseInt(form.year),
        coating_target: parseFloat(form.coating_target) || 0,
        coating_sales: parseFloat(form.coating_sales) || 0,
        resin_target: parseFloat(form.resin_target) || 0,
        resin_sales: parseFloat(form.resin_sales) || 0,
        coalseam_target: parseFloat(form.coalseam_target) || 0,
        coalseam_sales: parseFloat(form.coalseam_sales) || 0,
        new_customers: form.new_customers || '',
        issues_faced: form.issues_faced || '',
      };
      if (editId) {
        await api.put(`/appraisals/${editId}`, payload);
        toast.success('Appraisal updated');
      } else {
        await api.post('/appraisals', payload);
        toast.success('Appraisal saved');
      }
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (a) => {
    setForm({
      month: a.month, year: a.year,
      coating_target: a.coating_target || '', coating_sales: a.coating_sales || '',
      resin_target: a.resin_target || '', resin_sales: a.resin_sales || '',
      coalseam_target: a.coalseam_target || '', coalseam_sales: a.coalseam_sales || '',
      new_customers: a.new_customers || '', issues_faced: a.issues_faced || ''
    });
    setEditId(a.id); setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this appraisal entry?')) return;
    try { await api.delete(`/appraisals/${id}`); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) yearOptions.push(y);

  const pct = (sales, target) => {
    if (!target || target === 0) return null;
    return ((sales / target) * 100).toFixed(1);
  };
  const pctBadge = (p) => {
    if (p === null) return <span className="text-gray-400">—</span>;
    const c = p >= 100 ? 'text-green-700 bg-green-100' : p >= 75 ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100';
    return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c}`}>{p}%</span>;
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Self Appraisal</h1>
          <p className="text-gray-500 text-sm mt-1">Monthly target vs sales performance (in MT)</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border cursor-pointer transition-colors ${
              activeFilterCount > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            <FiFilter size={16} /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> New Appraisal
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filter Appraisals</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
                <FiX size={14} /> Clear all
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Year</label>
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className={inp}>
                <option value="">All Years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Month</label>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={inp}>
                <option value="">All Months</option>
                {monthNamesFull.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Salesman</label>
                <select value={filterSalesman} onChange={e => setFilterSalesman(e.target.value)} className={inp}>
                  <option value="">All Salesmen</option>
                  {salesmen.filter(s => s.role === 'salesman').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
              {filterYear && <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">{filterYear} <button onClick={() => setFilterYear('')} className="cursor-pointer"><FiX size={12} /></button></span>}
              {filterMonth && <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">{monthNamesFull[filterMonth - 1]} <button onClick={() => setFilterMonth('')} className="cursor-pointer"><FiX size={12} /></button></span>}
              {filterSalesman && <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">{salesmen.find(s => s.id == filterSalesman)?.name} <button onClick={() => setFilterSalesman('')} className="cursor-pointer"><FiX size={12} /></button></span>}
              <span className="text-xs text-gray-400 flex items-center">{appraisals.length} results</span>
            </div>
          )}
        </div>
      )}

      {/* Compact Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">Period</th>
                {isAdmin && <th className="px-4 py-2.5 text-left font-medium text-gray-600">Salesman</th>}
                <th className="px-3 py-2.5 text-center font-medium text-gray-500 text-xs" colSpan={2}>Coating (MT)</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-500 text-xs" colSpan={2}>Resin (MT)</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-500 text-xs" colSpan={2}>Coal Seam (MT)</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-500 text-xs">Overall</th>
                <th className="px-3 py-2.5 text-center font-medium text-gray-600 w-20">Actions</th>
              </tr>
              <tr className="border-b bg-gray-50/50">
                <th className="px-4 py-1"></th>
                {isAdmin && <th className="px-4 py-1"></th>}
                <th className="px-3 py-1 text-center text-[10px] text-gray-400 font-medium">Tgt</th>
                <th className="px-3 py-1 text-center text-[10px] text-gray-400 font-medium">Sales</th>
                <th className="px-3 py-1 text-center text-[10px] text-gray-400 font-medium">Tgt</th>
                <th className="px-3 py-1 text-center text-[10px] text-gray-400 font-medium">Sales</th>
                <th className="px-3 py-1 text-center text-[10px] text-gray-400 font-medium">Tgt</th>
                <th className="px-3 py-1 text-center text-[10px] text-gray-400 font-medium">Sales</th>
                <th className="px-3 py-1"></th>
                <th className="px-3 py-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appraisals.map(a => {
                const totalT = (a.coating_target || 0) + (a.resin_target || 0) + (a.coalseam_target || 0);
                const totalS = (a.coating_sales || 0) + (a.resin_sales || 0) + (a.coalseam_sales || 0);
                const canEdit = isAdmin || a.salesman_id === user?.id;
                const hasExtras = a.new_customers || a.issues_faced;
                const isExpanded = expandedId === a.id;

                return (
                  <tr key={a.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                    <td className="px-4 py-2.5">
                      <span className="font-semibold text-gray-800">{monthNames[a.month - 1]} {a.year}</span>
                      {hasExtras && <span className="ml-1.5 text-indigo-400 text-xs align-middle">+info</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-2.5">
                        <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{a.salesman_name}</span>
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center text-gray-500 font-mono text-xs">{a.coating_target || 0}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-gray-800">{a.coating_sales || 0}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500 font-mono text-xs">{a.resin_target || 0}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-gray-800">{a.resin_sales || 0}</td>
                    <td className="px-3 py-2.5 text-center text-gray-500 font-mono text-xs">{a.coalseam_target || 0}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs font-semibold text-gray-800">{a.coalseam_sales || 0}</td>
                    <td className="px-3 py-2.5 text-center">{pctBadge(pct(totalS, totalT))}</td>
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-center gap-2">
                        {canEdit && (
                          <button onClick={() => handleEdit(a)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={14} /></button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 cursor-pointer"><FiTrash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {appraisals.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-4 py-10 text-center">
                    <FiTarget size={28} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-400 text-sm">No appraisals found. Click "New Appraisal" to create one.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded detail panel */}
        {expandedId && (() => {
          const a = appraisals.find(x => x.id === expandedId);
          if (!a) return null;
          return (
            <div className="border-t border-gray-200 bg-gray-50/70 px-5 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
                {[
                  { label: 'Coating', t: a.coating_target, s: a.coating_sales },
                  { label: 'Resin', t: a.resin_target, s: a.resin_sales },
                  { label: 'Coal Seam', t: a.coalseam_target, s: a.coalseam_sales },
                ].map(row => (
                  <div key={row.label} className="bg-white rounded-lg border border-gray-200 px-4 py-2.5">
                    <div className="text-xs text-gray-500 font-medium mb-1">{row.label}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Tgt: <b>{row.t || 0}</b> &rarr; Sales: <b>{row.s || 0}</b></span>
                      {pctBadge(pct(row.s, row.t))}
                    </div>
                  </div>
                ))}
              </div>

              {(a.new_customers || a.issues_faced) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {a.new_customers && (
                    <div className="bg-white rounded-lg border border-green-200 px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1">
                        <FiUsers size={12} /> New Customers Developed
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.new_customers}</p>
                    </div>
                  )}
                  {a.issues_faced && (
                    <div className="bg-white rounded-lg border border-orange-200 px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700 mb-1">
                        <FiAlertTriangle size={12} /> Issues Faced
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.issues_faced}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editId ? 'Edit Appraisal' : 'New Self Appraisal'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Month *</label>
                <select value={form.month} onChange={e => setForm({...form, month: e.target.value})} className={inp} required disabled={!!editId}>
                  {monthNamesFull.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Year *</label>
                <select value={form.year} onChange={e => setForm({...form, year: e.target.value})} className={inp} required disabled={!!editId}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Compact target/sales grid */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Category</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Target (MT)</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-600">Sales (MT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: 'Coating', tKey: 'coating_target', sKey: 'coating_sales' },
                    { label: 'Resin', tKey: 'resin_target', sKey: 'resin_sales' },
                    { label: 'Coal Seam', tKey: 'coalseam_target', sKey: 'coalseam_sales' },
                  ].map(row => (
                    <tr key={row.label}>
                      <td className="px-3 py-2 font-medium text-gray-700 text-sm">{row.label}</td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" min="0" value={form[row.tKey]}
                          onChange={e => setForm({...form, [row.tKey]: e.target.value})}
                          placeholder="0.00" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" step="0.01" min="0" value={form[row.sKey]}
                          onChange={e => setForm({...form, [row.sKey]: e.target.value})}
                          placeholder="0.00" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">New Customers Developed (names)</label>
              <textarea value={form.new_customers} onChange={e => setForm({...form, new_customers: e.target.value})}
                placeholder="e.g. ABC Chemicals, XYZ Industries..." className={inp} rows={2} />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1 font-medium">Issues Faced at Customer's End / Market</label>
              <textarea value={form.issues_faced} onChange={e => setForm({...form, issues_faced: e.target.value})}
                placeholder="Describe any issues faced..." className={inp} rows={2} />
            </div>

            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Appraisal' : 'Save Appraisal'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
