import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import CustomerSearchSelect from '../components/CustomerSearchSelect';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiFilter, FiX, FiMessageSquare, FiDownload, FiSend, FiUpload, FiPaperclip } from 'react-icons/fi';
import DateInput from '../components/DateInput';

const emptyForm = { customer_id: '', subject: '', description: '', status: 'open', resolution: '' };

export default function Complaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Comments
  const [commentModal, setCommentModal] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  const momInputRef = useRef(null);
  const [momUploadId, setMomUploadId] = useState(null);

  const triggerMoMUpload = (id) => {
    setMomUploadId(id);
    momInputRef.current.value = '';
    momInputRef.current.click();
  };

  const handleMoMFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !momUploadId) return;
    const formData = new FormData();
    formData.append('mom', file);
    try {
      await api.post(`/complaints/${momUploadId}/upload-mom`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('MoM uploaded');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
  };

  const downloadUploadedMoM = async (id, customerName) => {
    try {
      const response = await api.get(`/complaints/${id}/mom`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `MoM_${customerName || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('MoM downloaded');
    } catch { toast.error('Failed to download MoM'); }
  };

  const load = () => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (filterCustomer) params.customer_id = filterCustomer;
    if (filterSalesman) params.salesman_id = filterSalesman;
    if (filterStatus) params.status = filterStatus;
    api.get('/complaints', { params }).then(r => setComplaints(r.data));
  };

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    api.get('/salesman').then(r => setSalesmen(r.data));
  }, []);

  useEffect(() => { load(); }, [dateFrom, dateTo, filterCustomer, filterSalesman, filterStatus]);

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterCustomer(''); setFilterSalesman(''); setFilterStatus('');
  };

  const activeFilterCount = [dateFrom, dateTo, filterCustomer, filterSalesman, filterStatus].filter(Boolean).length;

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

  const handleDelete = async (id) => {
    if (!confirm('Delete this complaint and all its comments?')) return;
    try { await api.delete(`/complaints/${id}`); toast.success('Complaint deleted'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  // Comments
  const openComments = async (complaint) => {
    setCommentModal(complaint);
    setNewComment('');
    setLoadingComments(true);
    try {
      const { data } = await api.get(`/complaints/${complaint.id}/comments`);
      setComments(data);
    } catch { setComments([]); }
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const { data } = await api.post(`/complaints/${commentModal.id}/comments`, { comment: newComment });
      setComments([...comments, data]);
      setNewComment('');
      toast.success('Comment added');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add comment'); }
  };

  const handleCommentKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
  };

  // Report PDF Download
  const downloadReport = async () => {
    try {
      const params = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (filterCustomer) params.customer_id = filterCustomer;
      if (filterSalesman) params.salesman_id = filterSalesman;
      if (filterStatus) params.status = filterStatus;
      const response = await api.get('/complaints/export/pdf', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const filename = disposition ? disposition.split('filename="')[1]?.replace('"', '') : 'Complaints.pdf';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch { toast.error('Failed to download report'); }
  };

  // PDF Download
  const downloadPDF = async (id) => {
    try {
      const response = await api.get(`/complaints/${id}/download/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const filename = disposition ? disposition.split('filename="')[1]?.replace('"', '') : `Complaint_${id}.pdf`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('Failed to download PDF'); }
  };

  const statusColor = { open: 'bg-red-100 text-red-700', in_progress: 'bg-yellow-100 text-yellow-700', resolved: 'bg-green-100 text-green-700' };
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Complaints</h1>
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
          <button onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
            <FiDownload size={16} /> Report PDF
          </button>
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> New Complaint
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filter Complaints</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
                <FiX size={14} /> Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">From Date</label>
              <DateInput value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">To Date</label>
              <DateInput value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} />
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
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inp}>
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
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
              {filterStatus && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Status: {filterStatus.replace('_', ' ')}
                  <button onClick={() => setFilterStatus('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center">{complaints.length} results</span>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile cards ── */}
      <div className="sm:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {complaints.map(c => (
          <div key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-semibold text-gray-800 text-sm leading-snug">{c.customer_company || c.customer_name}</p>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[c.status] || ''}`}>{c.status}</span>
            </div>
            <p className="text-xs text-gray-700">{c.subject}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.created_at?.split('T')[0]} · {c.salesman_name}</p>
            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
              {c.comment_count > 0 && (
                <span className="flex items-center gap-1 text-gray-400 text-xs"><FiMessageSquare size={11} />{c.comment_count}</span>
              )}
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => downloadPDF(c.id)} className="p-1.5 text-gray-400"><FiDownload size={18} /></button>
                {c.mom_path && (
                  <button onClick={() => downloadUploadedMoM(c.id, c.customer_company || c.customer_name)}
                    className="p-1.5 text-green-600" title="Download Uploaded MoM">
                    <FiPaperclip size={18} />
                  </button>
                )}
                {(user?.role === 'admin' || c.salesman_id === user?.id) && (
                  <button onClick={() => triggerMoMUpload(c.id)}
                    className="p-1.5 text-indigo-500" title="Upload MoM PDF">
                    <FiUpload size={18} />
                  </button>
                )}
                <button onClick={() => openComments(c)} className="p-1.5 text-gray-400"><FiMessageSquare size={18} /></button>
                {(user?.role === 'admin' || c.salesman_id === user?.id) && (
                  <button onClick={() => handleEdit(c)} className="p-1.5 text-indigo-500"><FiEdit2 size={18} /></button>
                )}
                {user?.role === 'admin' && (
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-400"><FiTrash2 size={18} /></button>
                )}
              </div>
            </div>
          </div>
        ))}
        {complaints.length === 0 && <p className="px-4 py-10 text-center text-gray-400 text-sm">No complaints found</p>}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Customer', 'Subject', 'Status', 'Salesman', 'Created', '', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {complaints.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.customer_company || c.customer_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.subject}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[c.status] || ''}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.salesman_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.created_at?.split('T')[0]}</td>
                  <td className="px-4 py-3">
                    {c.comment_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-gray-500 text-xs">
                        <FiMessageSquare size={12} /> {c.comment_count}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {c.mom_path && (
                        <button onClick={() => downloadUploadedMoM(c.id, c.customer_company || c.customer_name)}
                          className="text-green-600 hover:text-green-800 cursor-pointer" title="Download Uploaded MoM">
                          <FiPaperclip size={16} />
                        </button>
                      )}
                      {(user?.role === 'admin' || c.salesman_id === user?.id) && (
                        <button onClick={() => triggerMoMUpload(c.id)}
                          className="text-indigo-500 hover:text-indigo-700 cursor-pointer" title="Upload MoM PDF">
                          <FiUpload size={16} />
                        </button>
                      )}
                      <button onClick={() => downloadPDF(c.id)} className="text-gray-500 hover:text-green-600 cursor-pointer"><FiDownload size={16} /></button>
                      <button onClick={() => openComments(c)} className="text-gray-500 hover:text-indigo-600 cursor-pointer"><FiMessageSquare size={16} /></button>
                      {(user?.role === 'admin' || c.salesman_id === user?.id) && (
                        <button onClick={() => handleEdit(c)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={16} /></button>
                      )}
                      {user?.role === 'admin' && (
                        <button onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700 cursor-pointer"><FiTrash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No complaints found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Complaint Modal */}
      {showModal && (
        <Modal title={editId ? 'Edit Complaint' : 'New Complaint'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <CustomerSearchSelect
              customers={customers}
              value={form.customer_id}
              onChange={v => setForm({...form, customer_id: v})}
            />
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

      <input
        ref={momInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleMoMFileChange}
      />

      {/* Comments Modal */}
      {commentModal && (
        <Modal title="Comments" onClose={() => setCommentModal(null)}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">{commentModal.created_at?.split('T')[0]}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[commentModal.status] || ''}`}>{commentModal.status}</span>
            </div>
            <p className="text-sm font-medium text-gray-800">{commentModal.customer_company || commentModal.customer_name}</p>
            <p className="text-xs text-gray-500">{commentModal.subject} &middot; {commentModal.salesman_name}</p>
          </div>

          {/* Comments list */}
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

          {/* Add comment input */}
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
