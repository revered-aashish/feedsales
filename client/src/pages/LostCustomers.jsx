import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { FiFilter, FiX, FiSearch } from 'react-icons/fi';

export default function LostCustomers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSalesman, setFilterSalesman] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const load = () => {
    const params = {};
    if (search) params.search = search;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (filterSalesman) params.salesman_id = filterSalesman;
    if (filterCity) params.city = filterCity;
    api.get('/customers/lost', { params }).then(r => setCustomers(r.data));
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/salesman').then(r => setSalesmen(r.data));
    }
  }, []);

  useEffect(() => { load(); }, [search, dateFrom, dateTo, filterSalesman, filterCity]);

  const allCities = [...new Set(customers.map(c => c.city).filter(Boolean))].sort();

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterSalesman(''); setFilterCity('');
  };

  const activeFilterCount = [dateFrom, dateTo, filterSalesman, filterCity].filter(Boolean).length;

  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lost Customers</h1>
          <p className="text-gray-500 text-sm mt-1">Customers marked as lost</p>
        </div>
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
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filter Lost Customers</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
                <FiX size={14} /> Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Lost From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Lost To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inp} />
            </div>
            {user?.role === 'admin' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Salesman</label>
                <select value={filterSalesman} onChange={e => setFilterSalesman(e.target.value)} className={inp}>
                  <option value="">All Salesmen</option>
                  {salesmen.filter(s => s.role === 'salesman').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">City</label>
              <select value={filterCity} onChange={e => setFilterCity(e.target.value)} className={inp}>
                <option value="">All Cities</option>
                {allCities.map(c => <option key={c} value={c}>{c}</option>)}
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
              {filterSalesman && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  Salesman: {salesmen.find(s => s.id == filterSalesman)?.name}
                  <button onClick={() => setFilterSalesman('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {filterCity && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  City: {filterCity}
                  <button onClick={() => setFilterCity('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center">{customers.length} results</span>
            </div>
          )}
        </div>
      )}

      <div className="relative mb-4">
        <FiSearch className="absolute left-3 top-3 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or company..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Company', 'City', 'Salesman', 'Lost Date', 'Reason'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.company || c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3 text-gray-600">{c.salesman_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.lost_date}</td>
                  <td className="px-4 py-3 text-red-600">{c.lost_reason}</td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No lost customers</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
