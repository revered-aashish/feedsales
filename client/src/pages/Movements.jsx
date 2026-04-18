import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import CustomerSearchSelect from '../components/CustomerSearchSelect';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiX, FiMessageSquare, FiAlertTriangle, FiSend, FiDownload } from 'react-icons/fi';

const today = new Date().toISOString().split('T')[0];
const emptyForm = { customer_id: '', visit_date: today, purpose: '', notes: '', status: 'planned', is_issue: false };
const emptyEntry = { customer_id: '', purpose: '', notes: '', status: 'planned', is_issue: false };

export default function Movements() {
  const { user } = useAuth();
  const [movements, setMovements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Single edit form
  const [form, setForm] = useState(emptyForm);

  // Multi-entry add form
  const [addDate, setAddDate] = useState(today);
  const [entries, setEntries] = useState([{ ...emptyEntry }]);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterIssue, setFilterIssue] = useState('');

  // Comments
  const [commentModal, setCommentModal] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const load = () => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (filterCustomer) params.customer_id = filterCustomer;
    if (filterSalesman) params.salesman_id = filterSalesman;
    if (filterIssue !== '') params.is_issue = filterIssue;
    api.get('/movements', { params }).then(r => setMovements(r.data));
  };

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    api.get('/salesman').then(r => setSalesmen(r.data));
  }, []);

  useEffect(() => { load(); }, [dateFrom, dateTo, filterCustomer, filterSalesman, filterIssue]);

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterCustomer(''); setFilterSalesman(''); setFilterIssue('');
  };

  const activeFilterCount = [dateFrom, dateTo, filterCustomer, filterSalesman, filterIssue].filter(v => v !== '').length;

  // Multi-entry helpers
  const updateEntry = (index, field, value) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const addEntry = () => {
    setEntries([...entries, { ...emptyEntry }]);
  };

  const removeEntry = (index) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const selectedCustomerIds = entries.map(e => e.customer_id).filter(Boolean);

  const handleMultiSubmit = async (e) => {
    e.preventDefault();
    const valid = entries.filter(en => en.customer_id && en.purpose);
    if (valid.length === 0) return toast.error('Add at least one customer with purpose');

    setSubmitting(true);
    try {
      let success = 0;
      for (const en of valid) {
        await api.post('/movements', {
          customer_id: en.customer_id,
          visit_date: addDate,
          purpose: en.purpose,
          notes: en.notes || '',
          status: en.status,
          is_issue: en.is_issue,
        });
        success++;
      }
      toast.success(`${success} movement${success > 1 ? 's' : ''} created`);
      setShowModal(false);
      setEntries([{ ...emptyEntry }]);
      setAddDate(today);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error creating movements'); }
    setSubmitting(false);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/movements/${editId}`, form);
      toast.success('Movement updated');
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (m) => {
    setForm({ customer_id: m.customer_id, visit_date: m.visit_date, purpose: m.purpose,
      notes: m.notes || '', status: m.status, is_issue: m.is_issue === 1 });
    setEditId(m.id); setShowModal(true);
  };

  const openAddModal = () => {
    setEditId(null);
    setAddDate(today);
    setEntries([{ ...emptyEntry }]);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this movement and all its comments?')) return;
    await api.delete(`/movements/${id}`); toast.success('Movement deleted'); load();
  };

  // Comments
  const openComments = async (movement) => {
    setCommentModal(movement);
    setNewComment('');
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/movements/${movement.id}/comments`);
      setComments(data);
    } catch { setComments([]); }
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const { data } = await api.post(`/movements/${commentModal.id}/comments`, { comment: newComment });
      setComments([...comments, data]);
      setNewComment('');
      toast.success('Comment added');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add comment'); }
  };

  const handleCommentKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
  };

  const downloadMOM = async (id) => {
    try {
      const response = await api.get(`/movements/${id}/download/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const filename = disposition ? disposition.split('filename="')[1]?.replace('"', '') : `MOM_${id}.pdf`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('Failed to download PDF'); }
  };

  const statusColor = { planned: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700' };
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Daily Movements Achieved</h1>
        <div className="flex gap-3">
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border cursor-pointer transition-colors ${
              activeFilterCount > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}>
            <FiFilter size={16} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <button onClick={openAddModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> Add Movement
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filter Movements</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
                <FiX size={14} /> Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Customer</label>
              <CustomerSearchSelect
                customers={customers}
                value={filterCustomer}
                onChange={setFilterCustomer}
                placeholder="All Customers"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Salesman</label>
              <select value={filterSalesman} onChange={e => setFilterSalesman(e.target.value)} className={inp}>
                <option value="">All Salesmen</option>
                {salesmen.filter(s => s.role === 'salesman').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Maybe an Issue</label>
              <select value={filterIssue} onChange={e => setFilterIssue(e.target.value)} className={inp}>
                <option value="">All</option>
                <option value="1">Issues Only</option>
                <option value="0">No Issues</option>
              </select>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
              {dateFrom && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  From: {dateFrom}
                  <button onClick={() => setDateFrom('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  To: {dateTo}
                  <button onClick={() => setDateTo('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterCustomer && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Customer: {customers.find(c => c.id == filterCustomer)?.company || customers.find(c => c.id == filterCustomer)?.name}
                  <button onClick={() => setFilterCustomer('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterSalesman && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Salesman: {salesmen.find(s => s.id == filterSalesman)?.name}
                  <button onClick={() => setFilterSalesman('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterIssue !== '' && (
                <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-700 text-xs px-2.5 py-1 rounded-full">
                  {filterIssue === '1' ? 'Issues Only' : 'No Issues'}
                  <button onClick={() => setFilterIssue('')} className="hover:text-orange-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center">{movements.length} results</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'Customer', 'Purpose', 'Status', 'Salesman', '', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map(m => (
                <tr key={m.id} className={`hover:bg-gray-50 ${m.is_issue ? 'bg-orange-50/40' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{m.visit_date}</td>
                  <td className="px-4 py-3 text-gray-600">{m.customer_company || m.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.purpose}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[m.status] || ''}`}>{m.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.salesman_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {m.is_issue === 1 && (
                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium" title="Maybe an issue">
                          <FiAlertTriangle size={11} /> Issue
                        </span>
                      )}
                      {m.comment_count > 0 && (
                        <span className="inline-flex items-center gap-1 text-gray-500 text-xs" title={`${m.comment_count} comment(s)`}>
                          <FiMessageSquare size={12} /> {m.comment_count}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => downloadMOM(m.id)} className="text-gray-500 hover:text-green-600 cursor-pointer" title="Download MOM PDF">
                        <FiDownload size={16} />
                      </button>
                      <button onClick={() => openComments(m)} className="text-gray-500 hover:text-indigo-600 cursor-pointer" title="Comments">
                        <FiMessageSquare size={16} />
                      </button>
                      {(user?.role === 'admin' || m.salesman_id === user?.id) && (
                        <button onClick={() => handleEdit(m)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Edit">
                          <FiEdit2 size={16} />
                        </button>
                      )}
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(m.id)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete">
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {movements.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No movements found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Movement Modal (Multi-entry) */}
      {showModal && !editId && (
        <Modal title="Add Movements" onClose={() => setShowModal(false)}>
          <form onSubmit={handleMultiSubmit}>
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1 font-medium">Visit Date *</label>
              <input type="date" value={addDate} onChange={e => setAddDate(e.target.value)} className={inp} required />
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {entries.map((entry, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500">Customer #{index + 1}</span>
                    {entries.length > 1 && (
                      <button type="button" onClick={() => removeEntry(index)} className="text-red-400 hover:text-red-600 cursor-pointer">
                        <FiTrash2 size={14} />
                      </button>
                    )}
                  </div>
                  <CustomerSearchSelect
                    customers={customers}
                    value={entry.customer_id}
                    onChange={v => updateEntry(index, 'customer_id', v)}
                    disabledIds={selectedCustomerIds.filter(id => id !== entry.customer_id)}
                    className="mb-2"
                  />
                  <select value={entry.purpose} onChange={e => updateEntry(index, 'purpose', e.target.value)}
                    className={`${inp} mb-2`} required>
                    <option value="">Select Purpose *</option>
                    <option value="Sales Visit">Sales Visit</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Product Demo">Product Demo</option>
                    <option value="Complaint Resolution">Complaint Resolution</option>
                    <option value="Payment Collection">Payment Collection</option>
                    <option value="New Introduction">New Introduction</option>
                    <option value="Other">Other</option>
                  </select>
                  <select value={entry.status} onChange={e => updateEntry(index, 'status', e.target.value)}
                    className={`${inp} mb-2`}>
                    <option value="planned">Planned</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <textarea value={entry.notes} onChange={e => updateEntry(index, 'notes', e.target.value)}
                    placeholder="Notes" className={`${inp} mb-2`} rows={2} />
                  <label className="flex items-center gap-2 p-2 rounded border border-orange-200 bg-orange-50/50 cursor-pointer select-none">
                    <input type="checkbox" checked={entry.is_issue}
                      onChange={e => updateEntry(index, 'is_issue', e.target.checked)}
                      className="w-3.5 h-3.5 text-orange-600 rounded border-gray-300 focus:ring-orange-500" />
                    <span className="text-xs font-medium text-orange-800 flex items-center gap-1">
                      <FiAlertTriangle size={11} /> Maybe an Issue
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <button type="button" onClick={addEntry}
              className="w-full mt-3 py-2 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 cursor-pointer flex items-center justify-center gap-1.5">
              <FiPlus size={15} /> Add Another Customer
            </button>

            <button type="submit" disabled={submitting}
              className="w-full mt-3 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer disabled:opacity-50">
              {submitting ? 'Saving...' : `Save ${entries.filter(e => e.customer_id && e.purpose).length} Movement${entries.filter(e => e.customer_id && e.purpose).length !== 1 ? 's' : ''}`}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Movement Modal (Single) */}
      {showModal && editId && (
        <Modal title="Edit Movement" onClose={() => { setShowModal(false); setEditId(null); }}>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <CustomerSearchSelect
              customers={customers}
              value={form.customer_id}
              onChange={v => setForm({...form, customer_id: v})}
            />
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
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inp}>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Notes" className={inp} rows={3} />

            <label className="flex items-center gap-2.5 p-3 rounded-lg border border-orange-200 bg-orange-50/50 cursor-pointer select-none">
              <input type="checkbox" checked={form.is_issue}
                onChange={e => setForm({...form, is_issue: e.target.checked})}
                className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500" />
              <div>
                <span className="text-sm font-medium text-orange-800 flex items-center gap-1">
                  <FiAlertTriangle size={13} /> Maybe an Issue
                </span>
                <span className="text-xs text-orange-600 block">Flag this movement for attention</span>
              </div>
            </label>

            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              Update Movement
            </button>
          </form>
        </Modal>
      )}

      {/* Comments Modal */}
      {commentModal && (
        <Modal title="Comments" onClose={() => setCommentModal(null)}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">{commentModal.visit_date}</span>
              {commentModal.is_issue === 1 && (
                <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  <FiAlertTriangle size={10} /> Issue
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-gray-800">{commentModal.customer_company || commentModal.customer_name}</p>
            <p className="text-xs text-gray-500">{commentModal.purpose} &middot; {commentModal.salesman_name}</p>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
            {loadingComments ? (
              <p className="text-center text-gray-400 text-sm py-4">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-4">No comments yet. Be the first to comment.</p>
            ) : (
              comments.map(c => (
                <div key={c.id} className={`p-3 rounded-lg ${c.user_id === user.id ? 'bg-indigo-50 border border-indigo-100 ml-4' : 'bg-gray-50 border border-gray-100 mr-4'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {c.user_name}
                      {c.user_role === 'admin' && (
                        <span className="ml-1.5 bg-indigo-200 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded">Admin</span>
                      )}
                    </span>
                    <span className="text-[10px] text-gray-400">{c.created_at?.replace('T', ' ').substring(0, 16)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={handleCommentKey}
              placeholder="Write a comment... (Enter to send)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
              rows={2}
            />
            <button onClick={submitComment} disabled={!newComment.trim()}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer self-end">
              <FiSend size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
