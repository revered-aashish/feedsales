import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { FiUsers, FiClipboard, FiAlertCircle, FiMapPin, FiUserX, FiCalendar } from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ customers: 0, trials: 0, complaints: 0, movements: 0, lostCustomers: 0, visitPlans: 0 });

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/trials'),
      api.get('/complaints'),
      api.get('/movements'),
      api.get('/customers/lost'),
      api.get('/visit-plans'),
    ]).then(([c, t, co, m, l, vp]) => {
      setStats({
        customers: c.data.length,
        trials: t.data.length,
        complaints: co.data.length,
        movements: m.data.length,
        lostCustomers: l.data.length,
        visitPlans: vp.data.length,
      });
    });
  }, []);

  const cards = [
    { label: 'Total Customers', value: stats.customers, icon: FiUsers, color: 'bg-blue-500' },
    { label: 'Active Trials', value: stats.trials, icon: FiClipboard, color: 'bg-green-500' },
    { label: 'Complaints', value: stats.complaints, icon: FiAlertCircle, color: 'bg-orange-500' },
    { label: 'Visit Plans', value: stats.visitPlans, icon: FiCalendar, color: 'bg-indigo-500' },
    { label: 'Movements Achieved', value: stats.movements, icon: FiMapPin, color: 'bg-purple-500' },
    { label: 'Lost Customers', value: stats.lostCustomers, icon: FiUserX, color: 'bg-red-500' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1">Here's your sales overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-5">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`${color} text-white p-2 rounded-lg`}><Icon size={18} /></div>
            </div>
            <p className="text-3xl font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
