import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiDownload, FiUpload, FiFile } from 'react-icons/fi';

const emptyForm = { name: '' };

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pdsFile, setPdsFile] = useState(null);
  const [msdsFile, setMsdsFile] = useState(null);
  const [editId, setEditId] = useState(null);

  const isAdmin = user?.role === 'admin';

  const load = () => api.get('/products', { params: { search } }).then(r => setProducts(r.data));

  useEffect(() => { load(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      if (pdsFile) formData.append('pds', pdsFile);
      if (msdsFile) formData.append('msds', msdsFile);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (editId) {
        await api.put(`/products/${editId}`, formData, config);
        toast.success('Product updated');
      } else {
        await api.post('/products', formData, config);
        toast.success('Product added');
      }
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    }
  };

  const handleEdit = (p) => {
    setForm({ name: p.name });
    setPdsFile(null);
    setMsdsFile(null);
    setEditId(p.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product and its uploaded files?')) return;
    await api.delete(`/products/${id}`);
    toast.success('Product deleted');
    load();
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
    setPdsFile(null);
    setMsdsFile(null);
    setEditId(null);
  };

  const downloadFile = async (productId, type, productName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/products/${productId}/download/${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${productName}_${type.toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type.toUpperCase()} downloaded`);
    } catch (err) {
      toast.error(err.message || 'Download failed');
    }
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Products</h1>
        {isAdmin && (
          <button onClick={() => { setForm(emptyForm); setPdsFile(null); setMsdsFile(null); setEditId(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiPlus size={16} /> Add Product
          </button>
        )}
      </div>

      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Product Name</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">PDS</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">MSDS</th>
                {isAdmin && <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800">{p.name}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.pds_path ? (
                      <button onClick={() => downloadFile(p.id, 'pds', p.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 cursor-pointer transition-colors">
                        <FiDownload size={13} /> Download PDS
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">Not uploaded</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.msds_path ? (
                      <button onClick={() => downloadFile(p.id, 'msds', p.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-medium hover:bg-orange-100 cursor-pointer transition-colors">
                        <FiDownload size={13} /> Download MSDS
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">Not uploaded</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => handleEdit(p)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title="Edit">
                          <FiEdit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 cursor-pointer" title="Delete">
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 4 : 3} className="px-4 py-12 text-center text-gray-400">
                    <FiFile size={32} className="mx-auto mb-2 text-gray-300" />
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Product' : 'Add Product'} onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Product Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Sodium Hydroxide" className={inp} required />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                PDS (Product Data Sheet) — PDF only
              </label>
              <div className="relative">
                <input type="file" accept="application/pdf" onChange={e => setPdsFile(e.target.files[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer cursor-pointer" />
              </div>
              {editId && !pdsFile && (
                <p className="text-xs text-gray-400 mt-1">
                  {products.find(p => p.id === editId)?.pds_path
                    ? '✓ Existing PDS file will be kept. Upload a new one to replace it.'
                    : 'No PDS currently uploaded.'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                MSDS (Material Safety Data Sheet) — PDF only
              </label>
              <div className="relative">
                <input type="file" accept="application/pdf" onChange={e => setMsdsFile(e.target.files[0] || null)}
                  className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 file:cursor-pointer cursor-pointer" />
              </div>
              {editId && !msdsFile && (
                <p className="text-xs text-gray-400 mt-1">
                  {products.find(p => p.id === editId)?.msds_path
                    ? '✓ Existing MSDS file will be kept. Upload a new one to replace it.'
                    : 'No MSDS currently uploaded.'}
                </p>
              )}
            </div>

            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              <span className="flex items-center justify-center gap-2">
                <FiUpload size={14} />
                {editId ? 'Update Product' : 'Add Product'}
              </span>
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
