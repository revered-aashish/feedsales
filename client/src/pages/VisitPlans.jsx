import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import Modal from '../components/Modal';
import CustomerSearchSelect from '../components/CustomerSearchSelect';
import toast from 'react-hot-toast';
import { FiPlus, FiSave, FiTrash2, FiFilter, FiX, FiCalendar, FiEye } from 'react-icons/fi';
import DateInput from '../components/DateInput';

const today = new Date().toISOString().split('T')[0];

export default function VisitPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewData, setViewData] = useState({ date: '', salesman: '', plans: [] });

  // Filters — salesmen default to their own data; admin sees all by default
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterSalesman, setFilterSalesman] = useState(() =>
    user?.role !== 'admin' ? String(user?.id || '') : ''
  );

  // Planning form
  const [planDate, setPlanDate] = useState(today);
  const emptySlot = { customer_id: '', purpose: '', remark: '' };
  const [slots, setSlots] = useState([{ ...emptySlot }]);

  const load = () => {
    const params = {};
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (filterCustomer) params.customer_id = filterCustomer;
    if (filterSalesman) params.salesman_id = filterSalesman;
    api.get('/visit-plans', { params }).then(r => setPlans(r.data));
  };

  useEffect(() => {
    api.get('/customers').then(r => setCustomers(r.data));
    api.get('/salesman').then(r => setSalesmen(r.data));
  }, []);

  useEffect(() => { load(); }, [dateFrom, dateTo, filterCustomer, filterSalesman]);

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setFilterCustomer(''); setFilterSalesman('');
  };

  const activeFilterCount = [dateFrom, dateTo, filterCustomer, filterSalesman].filter(Boolean).length;

  // Group plans by date + salesman for table display
  const grouped = {};
  plans.forEach(p => {
    const key = `${p.visit_date}__${p.salesman_id}`;
    if (!grouped[key]) {
      grouped[key] = { visit_date: p.visit_date, salesman_name: p.salesman_name, salesman_id: p.salesman_id, items: [] };
    }
    grouped[key].items.push(p);
  });
  const groupedList = Object.values(grouped).sort((a, b) => b.visit_date.localeCompare(a.visit_date));

  // Open plan modal — load existing plans for the date if any
  const openPlanModal = async () => {
    setPlanDate(today);
    setSlots([{ ...emptySlot }]);

    // Try to load existing plans for this salesman + today
    try {
      const { data } = await api.get('/visit-plans', { params: { visit_date: today } });
      const myPlans = data.filter(p => p.salesman_id === user.id);
      if (myPlans.length > 0) {
        setSlots(myPlans.map(p => ({ customer_id: String(p.customer_id), purpose: p.purpose || '', remark: p.remark || '' })));
      }
    } catch {}

    setShowPlanModal(true);
  };

  // Load plans when date changes in modal
  const handleDateChange = async (date) => {
    setPlanDate(date);
    setSlots([{ ...emptySlot }]);
    try {
      const { data } = await api.get('/visit-plans', { params: { visit_date: date } });
      const myPlans = data.filter(p => p.salesman_id === user.id);
      if (myPlans.length > 0) {
        setSlots(myPlans.map(p => ({ customer_id: String(p.customer_id), purpose: p.purpose || '', remark: p.remark || '' })));
      }
    } catch {}
  };

  const updateSlot = (index, field, value) => {
    const updated = [...slots];
    updated[index] = { ...updated[index], [field]: value };
    setSlots(updated);
  };

  const addSlot = () => {
    if (slots.length >= 8) return toast.error('Maximum 8 visits per day');
    setSlots([...slots, { ...emptySlot }]);
  };

  const removeSlot = (index) => {
    if (slots.length === 1) return;
    setSlots(slots.filter((_, i) => i !== index));
  };

  const savePlan = async () => {
    const validSlots = slots.filter(s => s.customer_id);
    if (validSlots.length === 0) return toast.error('Select at least one customer');

    try {
      await api.post('/visit-plans/save', { visit_date: planDate, plans: validSlots });
      toast.success('Visit plan saved!');
      setShowPlanModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const viewGroupedPlan = (group) => {
    setViewData({ date: group.visit_date, salesman: group.salesman_name, plans: group.items });
    setShowViewModal(true);
  };

  const purposeOptions = ['Sales Visit', 'Follow-up', 'Product Demo', 'Complaint Resolution', 'Payment Collection', 'New Introduction', 'Other'];
  const inp = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daily Visit Planning</h1>
          <p className="text-gray-500 text-sm mt-1">Plan your daily customer visits (up to 8 per day)</p>
        </div>
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
          <button onClick={openPlanModal}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 cursor-pointer">
            <FiCalendar size={16} /> Plan My Day
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Filter Visit Plans</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 cursor-pointer">
                <FiX size={14} /> Clear all filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          </div>
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
              {dateFrom && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  From: {dateFrom} <button onClick={() => setDateFrom('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full">
                  To: {dateTo} <button onClick={() => setDateTo('')} className="hover:text-indigo-900 cursor-pointer"><FiX size={12} /></button>
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
              <span className="text-xs text-gray-400 flex items-center">{groupedList.length} plans</span>
            </div>
          )}
        </div>
      )}

      {/* Plans List — grouped by date + salesman */}

      {/* ── Mobile cards ── */}
      <div className="sm:hidden bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {groupedList.map((g, idx) => (
          <div key={idx} className="p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-gray-800 text-sm">{g.visit_date}</span>
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                {g.items.length} visit{g.items.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-2">{g.salesman_name}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {g.items.slice(0, 4).map((item, i) => (
                <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{item.customer_company || item.customer_name}</span>
              ))}
              {g.items.length > 4 && (
                <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">+{g.items.length - 4} more</span>
              )}
            </div>
            <button onClick={() => viewGroupedPlan(g)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium py-1">
              <FiEye size={13} /> View Details
            </button>
          </div>
        ))}
        {groupedList.length === 0 && <p className="px-4 py-10 text-center text-gray-400 text-sm">No visit plans found</p>}
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'Salesman', 'Planned Visits', 'Customers', 'Actions'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groupedList.map((g, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{g.visit_date}</td>
                  <td className="px-4 py-3 text-gray-600">{g.salesman_name}</td>
                  <td className="px-4 py-3">
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs font-medium">
                      {g.items.length} visit{g.items.length > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div className="flex flex-wrap gap-1">
                      {g.items.slice(0, 3).map((item, i) => (
                        <span key={i} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">{item.customer_company || item.customer_name}</span>
                      ))}
                      {g.items.length > 3 && (
                        <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">+{g.items.length - 3} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => viewGroupedPlan(g)} className="text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1 text-xs">
                      <FiEye size={14} /> View Details
                    </button>
                  </td>
                </tr>
              ))}
              {groupedList.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No visit plans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plan My Day Modal */}
      {showPlanModal && (
        <Modal title="Plan My Day" onClose={() => setShowPlanModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5 font-medium">Select Date *</label>
              <input type="date" value={planDate} onChange={e => handleDateChange(e.target.value)} className={inp} />
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Customer Visits ({slots.length}/8)</h3>
                {slots.length < 8 && (
                  <button onClick={addSlot} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">
                    <FiPlus size={14} /> Add Visit
                  </button>
                )}
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {slots.map((slot, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500">Visit #{index + 1}</span>
                      {slots.length > 1 && (
                        <button onClick={() => removeSlot(index)} className="text-red-400 hover:text-red-600 cursor-pointer">
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                    <CustomerSearchSelect
                      customers={customers}
                      value={slot.customer_id}
                      onChange={v => updateSlot(index, 'customer_id', v)}
                      disabledIds={slots.filter((_, i) => i !== index).map(s => s.customer_id).filter(Boolean)}
                      className="mb-2"
                    />
                    <select value={slot.purpose} onChange={e => updateSlot(index, 'purpose', e.target.value)}
                      className={`${inp} mb-2`}>
                      <option value="">Purpose (optional)</option>
                      {purposeOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input value={slot.remark} onChange={e => updateSlot(index, 'remark', e.target.value)}
                      placeholder="Remark (optional)" className={inp} />
                  </div>
                ))}
              </div>
            </div>

            <button onClick={savePlan}
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 cursor-pointer flex items-center justify-center gap-2">
              <FiSave size={16} /> Save Visit Plan
            </button>
          </div>
        </Modal>
      )}

      {/* View Details Modal */}
      {showViewModal && (
        <Modal title={`Visit Plan — ${viewData.date}`} onClose={() => setShowViewModal(false)}>
          <div className="mb-3">
            <span className="text-sm text-gray-500">Salesman: </span>
            <span className="text-sm font-medium text-gray-800">{viewData.salesman}</span>
          </div>
          <div className="space-y-2">
            {viewData.plans.map((p, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-gray-400 mr-2">#{p.slot_number}</span>
                    <span className="font-medium text-gray-800 text-sm">{p.customer_company || p.customer_name}</span>
                    {p.customer_company && <span className="text-gray-400 text-xs ml-1">({p.customer_company})</span>}
                  </div>
                </div>
                {p.purpose && <p className="text-xs text-indigo-600 mt-1">Purpose: {p.purpose}</p>}
                {p.remark && <p className="text-xs text-gray-500 mt-0.5">Remark: {p.remark}</p>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
