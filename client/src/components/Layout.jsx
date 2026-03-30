import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUsers, FiClipboard, FiAlertCircle, FiMapPin, FiLogOut, FiHome, FiUserX, FiUserPlus } from 'react-icons/fi';

const navItems = [
  { path: '/', label: 'Dashboard', icon: FiHome },
  { path: '/customers', label: 'Customers', icon: FiUsers },
  { path: '/trials', label: 'Trials', icon: FiClipboard },
  { path: '/complaints', label: 'Complaints', icon: FiAlertCircle },
  { path: '/movements', label: 'Daily Movements', icon: FiMapPin },
  { path: '/lost-customers', label: 'Lost Customers', icon: FiUserX },
  { path: '/salesmen', label: 'Manage Salesmen', icon: FiUserPlus, adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col fixed h-full">
        <div className="p-6 border-b border-indigo-800">
          <h1 className="text-2xl font-bold tracking-tight">FeedSales</h1>
          <p className="text-indigo-300 text-sm mt-1">Sales Tracking System</p>
        </div>

        <nav className="flex-1 py-4">
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
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
