import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FiUsers, FiClipboard, FiAlertCircle, FiLogOut, FiHome, FiUserX, FiUserPlus,
  FiCalendar, FiCheckCircle, FiMenu, FiX, FiPackage, FiTarget,
} from 'react-icons/fi';

const navItems = [
  { path: '/',               label: 'Dashboard',          icon: FiHome },
  { path: '/customers',      label: 'Customers',           icon: FiUsers },
  { path: '/trials',         label: 'Trials',              icon: FiClipboard },
  { path: '/complaints',     label: 'Complaints',          icon: FiAlertCircle },
  { path: '/visit-plans',    label: 'Daily Visit Planning', icon: FiCalendar },
  { path: '/movements',      label: 'Movements Achieved',  icon: FiCheckCircle },
  { path: '/products',       label: 'Products',            icon: FiPackage },
  { path: '/self-appraisal', label: 'Self Appraisal',      icon: FiTarget },
  { path: '/lost-customers', label: 'Lost Customers',      icon: FiUserX },
  { path: '/salesmen',       label: 'Manage Salesmen',     icon: FiUserPlus, adminOnly: true },
];

// 4 items that get their own tab in the bottom nav
const bottomNavItems = [
  { path: '/',            label: 'Home',      icon: FiHome },
  { path: '/customers',   label: 'Customers', icon: FiUsers },
  { path: '/movements',   label: 'Movements', icon: FiCheckCircle },
  { path: '/visit-plans', label: 'Planning',  icon: FiCalendar },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-indigo-900 text-white flex items-center justify-between px-4 py-3 z-40 h-14">
        <button onClick={() => setSidebarOpen(true)} className="cursor-pointer p-1 -ml-1">
          <FiMenu size={22} />
        </button>
        <h1 className="text-base font-bold tracking-tight">FeedSales</h1>
        <div className="w-8" />
      </div>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        w-64 bg-indigo-900 text-white flex flex-col fixed h-full z-50 transition-transform duration-300
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-5 border-b border-indigo-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">FeedSales</h1>
            <p className="text-indigo-300 text-xs mt-0.5">Feedchem Sales Directory</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-indigo-300 hover:text-white cursor-pointer p-1">
            <FiX size={20} />
          </button>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.filter(item => !item.adminOnly || user?.role === 'admin').map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <Link key={path} to={path}
                className={`flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
                  active ? 'bg-indigo-800 text-white' : 'text-indigo-200 hover:bg-indigo-800/60 hover:text-white'
                }`}>
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-indigo-800">
          <div className="text-sm text-indigo-200 mb-2 flex items-center gap-2">
            <span className="font-medium truncate">{user?.name}</span>
            <span className="text-[11px] bg-indigo-700 px-2 py-0.5 rounded shrink-0">{user?.role}</span>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-2 text-indigo-300 hover:text-white text-sm cursor-pointer">
            <FiLogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 lg:ml-64 p-4 pt-[4.5rem] pb-20 lg:p-8 lg:pt-8 lg:pb-8">
        {children}
      </main>

      {/* ── Mobile bottom nav bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex safe-area-bottom">
        {bottomNavItems.map(({ path, label, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link key={path} to={path}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors
                ${active ? 'text-indigo-600' : 'text-gray-400 active:text-gray-600'}`}>
              <Icon size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
              {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 mx-auto" style={{ width: '40%', marginLeft: 'auto', marginRight: 'auto' }} />}
            </Link>
          );
        })}
        {/* "More" opens sidebar */}
        <button onClick={() => setSidebarOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium text-gray-400 active:text-gray-600">
          <FiMenu size={20} strokeWidth={1.8} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
