import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUsers, FiClipboard, FiAlertCircle, FiLogOut, FiHome, FiUserX, FiUserPlus, FiCalendar, FiCheckCircle, FiMenu, FiX } from 'react-icons/fi';

const navItems = [
  { path: '/', label: 'Dashboard', icon: FiHome },
  { path: '/customers', label: 'Customers', icon: FiUsers },
  { path: '/trials', label: 'Trials', icon: FiClipboard },
  { path: '/complaints', label: 'Complaints', icon: FiAlertCircle },
  { path: '/visit-plans', label: 'Daily Visit Planning', icon: FiCalendar },
  { path: '/movements', label: 'Movements Achieved', icon: FiCheckCircle },
  { path: '/lost-customers', label: 'Lost Customers', icon: FiUserX },
  { path: '/salesmen', label: 'Manage Salesmen', icon: FiUserPlus, adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-indigo-900 text-white flex items-center justify-between px-4 py-3 z-40">
        <button onClick={() => setSidebarOpen(true)} className="cursor-pointer p-1">
          <FiMenu size={24} />
        </button>
        <h1 className="text-lg font-bold tracking-tight">FeedSales</h1>
        <div className="w-8" /> {/* spacer for centering */}
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 bg-indigo-900 text-white flex flex-col fixed h-full z-50 transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-indigo-800 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">FeedSales</h1>
            <p className="text-indigo-300 text-sm mt-1">Sales Tracking System</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-indigo-300 hover:text-white cursor-pointer">
            <FiX size={22} />
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.filter(item => !item.adminOnly || user?.role === 'admin').map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  active ? 'bg-indigo-800 text-white border-r-3 border-white' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-indigo-800">
          <div className="text-sm text-indigo-300 mb-2">
            {user?.name}
            <span className="ml-2 text-xs bg-indigo-700 px-2 py-0.5 rounded">{user?.role}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-indigo-300 hover:text-white text-sm cursor-pointer">
            <FiLogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 p-4 pt-16 lg:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
