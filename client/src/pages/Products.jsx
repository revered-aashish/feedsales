import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiDownload } from 'react-icons/fi';

const emptyForm = { name: '', category: '', description: '', unit: 'kg', price: '', hsn_code: '' };

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [downloading, setDownloading] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = () => api.get('/products', { params: { search } }).then(r => setProducts(r.data));

  useEffect(() => { load(); }, [search]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, price: form.price ? parseFloat(form.price) : null };
      if (editId) {
        await api.put(`/products/${editId}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product added');
      }
      setShowModal(false); setForm(emptyForm); setEditId(null); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  };

  const handleEdit = (p) => {
    setForm({
      name: p.name, category: p.category || '', description: p.description || '',
      unit: p.unit || 'kg', price: p.price || '', hsn_code: p.hsn_code || ''
    });
    setEditId(p.id); setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`); toast.success('Product deleted'); load();
  };

  const toggleActive = async (p) => {
    await api.put(`/products/${p.id}`, { is_active: p.is_active ? 0 : 1 });
    toast.success(p.is_active ? 'Product deactivated' : 'Product activated');
    load();
  };

  const downloadFile = async (type) => {
    setDownloading(type);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/products/download/${type}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'excel' ? 'FeedSales_Products.xlsx' : 'FeedSales_Products.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} downloaded!`);
    } catch (err) {
      toast.error('Download failed');
    } finally {
      setDownloading('');
    }
  };

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Products</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadFile('excel')} disabled={downloading === 'excel'}
            className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-700 bg-green-50 rounded-lg text-sm hover:bg-green-100 cursor-pointer disabled:opacity-50">
            <FiDownload size={14} /> {downloading === 'excel' ? 'Downloading...' : 'Excel'}
          </button>
          <button onClick={() => downloadFile('pdf')} disabled={downloading === 'pdf'}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 bg-red-50 rounded-lg text-sm hover:bg-red-100 cursor-pointer disabled:opacity-50">
            <FiDownload size={14} /> {downloading === 'pdf' ? 'Downloading...' : 'PDF'}
          </button>
          {isAdmin && (
            <button onClick={() => { setForm(emptyForm); setEditId(null); setShowModal(true); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
              <FiPlus size={16} /> Add Product
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products by name, category, or HSN code..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Product Name', 'Category', 'Unit', 'Price', 'HSN Code', 'Status', ...(isAdmin ? ['Actions'] : [])].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr key={p.id} className={`hover:bg-gray-50 ${!p.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.category && <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">{p.category}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{p.price ? `Rs. ${p.price}` : '-'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{p.hsn_code || '-'}</td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <button onClick={() => toggleActive(p)} className="cursor-pointer">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => handleEdit(p)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer"><FiEdit2 size={16} /></button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700 cursor-pointer"><FiTrash2 size={16} /></button>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-gray-400">No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title={editId ? 'Edit Product' : 'Add Product'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Product Name *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="e.g. Sodium Hydroxide" className={inp} required />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                placeholder="e.g. Acids, Solvents, Polymers" className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Product description" className={inp} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Unit</label>
                <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className={inp}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="litre">litre</option>
                  <option value="ml">ml</option>
                  <option value="ton">ton</option>
                  <option value="bag">bag</option>
                  <option value="drum">drum</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Price (Rs.)</label>
                <input type="number" step="0.01" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                  placeholder="0.00" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">HSN Code</label>
                <input value={form.hsn_code} onChange={e => setForm({...form, hsn_code: e.target.value})}
                  placeholder="e.g. 2815" className={inp} />
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer">
              {editId ? 'Update Product' : 'Add Product'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
