import { useEffect, useState } from 'react';
import api from '../api';

export default function LostCustomers() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => { api.get('/customers/lost').then(r => setCustomers(r.data)); }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Lost Customers</h1>
        <p className="text-gray-500 mt-1">Customers marked as lost</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Name', 'Company', 'City', 'Salesman', 'Lost Date', 'Reason'].map(h =>
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-600">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.company}</td>
                  <td className="px-4 py-3 text-gray-600">{c.city}</td>
                  <td className="px-4 py-3 text-gray-600">{c.salesman_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.lost_date}</td>
                  <td className="px-4 py-3 text-red-600">{c.lost_reason}</td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No lost customers</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
