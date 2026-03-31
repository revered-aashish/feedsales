import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiX, FiTarget } from 'react-icons/fi';

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

const emptyForm = {
  month: currentMonth, year: currentYear,
  coating_target: '', coating_sales: '',
  resin_target: '', resin_sales: '',
  coalseam_target: '', coalseam_sales: ''
};

export default function SelfAppraisal() {
  const { user } = useAuth();
  const [appraisals, setAppraisals] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
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

  useEffect(() => {
    if (isAdmin) api.get('/salesman').then(r => setSalesmen(r.data));
  }, []);

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
      coalseam_target: a.coalseam_target || '', coalseam_sales: a.coalseam_sales || ''
    });
    setEditId(a.id); setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this appraisal entry?')) return;
    try {
      await api.delete(`/appraisals/${id}`); toast.success('Appraisal deleted'); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // Generate year options (current year +/- 2)
  const yearOptions = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) yearOptions.push(y);

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  const pct = (sales, target) => {
    if (!target || target === 0) return null;
    return ((sales / target) * 100).toFixed(1);
  };

  const pctColor = (p) => {
    if (p === null) return '';
    if (p >= 100) return 'text-green-700 bg-green-50';
    if (p >= 75) return 'text-yellow-700 bg-yellow-50';
    return 'text-red-700 bg-red-50';
  };

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
                <FiX size={14} /> Clear all filters
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
                {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
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
              {filterYear && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Year: {filterYear} <button onClick={() => setFilterYear('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterMonth && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Month: {monthNames[filterMonth - 1]} <button onClick={() => setFilterMonth('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterSalesman && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Salesman: {salesmen.find(s => s.id == filterSalesman)?.name}
                  <button onClick={() => setFilterSalesman('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center">{appraisals.length} results</span>
            </div>
          )}
        </div>
      )}

      {/* Appraisals List */}
      <div className="space-y-4">
        {appraisals.map(a => {
          const coatingPct = pct(a.coating_sales, a.coating_target);
          const resinPct = pct(a.resin_sales, a.resin_target);
          const coalseamPct = pct(a.coalseam_sales, a.coalseam_target);
          const canEdit = isAdmin || a.salesman_id === user?.id;

          return (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-800">
                    {monthNames[a.month - 1]} {a.year}
                  </span>
                  {isAdmin && (
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      {a.salesman_name}
                    </span>
                  )}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(a)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Edit">
                      <FiEdit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete">
                      <FiTrash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left font-medium text-gray-500 w-1/4">Category</th>
                      <th className="px-5 py-2.5 text-right font-medium text-gray-500">Target (MT)</th>
                      <th className="px-5 py-2.5 text-right font-medium text-gray-500">Sales (MT)</th>
                      <th className="px-5 py-2.5 text-right font-medium text-gray-500">Achievement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Coating', target: a.coating_target, sales: a.coating_sales, p: coatingPct },
                      { label: 'Resin', target: a.resin_target, sales: a.resin_sales, p: resinPct },
                      { label: 'Coal Seam', target: a.coalseam_target, sales: a.coalseam_sales, p: coalseamPct },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-medium text-gray-800">{row.label}</td>
                        <td className="px-5 py-3 text-right text-gray-600 font-mono">{row.target || 0}</td>
                        <td className="px-5 py-3 text-right text-gray-800 font-mono font-semibold">{row.sales || 0}</td>
                        <td className="px-5 py-3 text-right">
                          {row.p !== null ? (
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${pctColor(row.p)}`}>
                              {row.p}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-gray-50/70">
                      <td className="px-5 py-3 font-bold text-gray-800">Total</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-gray-700">
                        {((a.coating_target || 0) + (a.resin_target || 0) + (a.coalseam_target || 0)).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-gray-900">
                        {((a.coating_sales || 0) + (a.resin_sales || 0) + (a.coalseam_sales || 0)).toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(() => {
                          const totalTarget = (a.coating_target || 0) + (a.resin_target || 0) + (a.coalseam_target || 0);
                          const totalSales = (a.coating_sales || 0) + (a.resin_sales || 0) + (a.coalseam_sales || 0);
                          const totalPct = pct(totalSales, totalTarget);
                          return totalPct !== null ? (
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${pctColor(totalPct)}`}>
                              {totalPct}%
                            </span>
                          ) : <span className="text-gray-400 text-xs">—</span>;
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {appraisals.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <FiTarget size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400">No appraisals found</p>
            <p className="text-gray-400 text-sm mt-1">Click "New Appraisal" to create your monthly entry</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal title={editId ? 'Edit Appraisal' : 'New Self Appraisal'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Month/Year selection */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Month *</label>
                <select value={form.month} onChange={e => setForm({...form, month: e.target.value})}
                  className={inp} required disabled={!!editId}>
                  {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Year *</label>
                <select value={form.year} onChange={e => setForm({...form, year: e.target.value})}
                  className={inp} required disabled={!!editId}>
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Coating */}
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Coating</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target (MT)</label>
                  <input type="number" step="0.01" min="0" value={form.coating_target}
                    onChange={e => setForm({...form, coating_target: e.target.value})}
                    placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sales (MT)</label>
                  <input type="number" step="0.01" min="0" value={form.coating_sales}
                    onChange={e => setForm({...form, coating_sales: e.target.value})}
                    placeholder="0.00" className={inp} />
                </div>
              </div>
            </div>

            {/* Resin */}
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Resin</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target (MT)</label>
                  <input type="number" step="0.01" min="0" value={form.resin_target}
                    onChange={e => setForm({...form, resin_target: e.target.value})}
                    placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sales (MT)</label>
                  <input type="number" step="0.01" min="0" value={form.resin_sales}
                    onChange={e => setForm({...form, resin_sales: e.target.value})}
                    placeholder="0.00" className={inp} />
                </div>
              </div>
            </div>

            {/* Coal Seam */}
            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Coal Seam</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Target (MT)</label>
                  <input type="number" step="0.01" min="0" value={form.coalseam_target}
                    onChange={e => setForm({...form, coalseam_target: e.target.value})}
                    placeholder="0.00" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sales (MT)</label>
                  <input type="number" step="0.01" min="0" value={form.coalseam_sales}
                    onChange={e => setForm({...form, coalseam_sales: e.target.value})}
                    placeholder="0.00" className={inp} />
                </div>
              </div>
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
