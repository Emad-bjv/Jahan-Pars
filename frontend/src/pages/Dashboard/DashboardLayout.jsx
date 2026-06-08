import React, { useContext, useState, useCallback, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

/* ─── SVG Icons ────────────────────────────────────────────────── */
const Icons = {
  chart: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  box: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  check: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  ),
  audit: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  ),
  warehouse: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14h0M8 17h0M12 14h0M12 17h0M16 14h0M16 17h0" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
    </svg>
  ),
  menu: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

const roleLabels = {
  TECHNICAL: 'دفتر فنی',
  WAREHOUSE: 'انباردار',
  ADMIN: 'مدیر سیستم',
};

const DashboardLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (when user taps a nav link on mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setSidebarOpen(false);
    logout();
    navigate('/login');
  };

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const getInitials = (name) => {
    if (!name) return '؟';
    return name.charAt(0).toUpperCase();
  };

  const getRoleClass = (user) => {
    if (!user) return '';
    if (user.is_superuser) return 'role-admin';
    if (user.role === 'TECHNICAL') return 'role-technical';
    if (user.role === 'WAREHOUSE') return 'role-warehouse';
    return '';
  };

  const navItems = [
    { to: '/dashboard', label: 'نمای کلی', icon: Icons.chart, end: true },
    { to: '/dashboard/contractors', label: 'پیمانکاران', icon: Icons.users },
    { to: '/dashboard/materials', label: 'رسته‌ها', icon: Icons.box },
    { to: '/dashboard/inventory', label: 'موجودی انبار', icon: Icons.box },
    { to: '/dashboard/approvals', label: 'تاییدیه‌ها', icon: Icons.check },
  ];

  // Audit Log فقط برای سوپریوزر
  if (user?.is_superuser) {
    navItems.push({ to: '/dashboard/audit-log', label: 'تاریخچه تغییرات', icon: Icons.audit });
  }

  return (
    <div className="dashboard-wrapper" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile Hamburger Button */}
      <button
        className="sidebar-hamburger"
        onClick={toggleSidebar}
        aria-label="منوی ناوبری"
      >
        {sidebarOpen ? Icons.close : Icons.menu}
      </button>

      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <h2>جهان‌پارس</h2>
          <p>سیستم موازنه متریال</p>
        </div>

        {/* Navigation */}
        <nav style={{ flexGrow: 1 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-link-icon">{item.icon}</span>
              <span className="nav-link-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Notification Bell moved to top of site */}

          {/* User Info */}
          <div className={`sidebar-user ${getRoleClass(user)}`}>
            <div className="sidebar-user-avatar">
              {getInitials(user?.username)}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.username}</div>
              <div className="sidebar-user-role">
                {user?.is_superuser ? 'سوپر ادمین' : roleLabels[user?.role] || user?.role}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {user?.role !== 'WAREHOUSE' && (
            <button
              className="btn btn-secondary"
              onClick={() => { setSidebarOpen(false); navigate('/warehouse'); }}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            >
              <span className="nav-link-icon">{Icons.warehouse}</span>
              پرتال انبار
            </button>
          )}
          <button
            className="btn btn-danger"
            onClick={handleLogout}
            style={{ width: '100%' }}
          >
            {Icons.logout}
            خروج از حساب
          </button>
        </div>
      </aside>

      <main style={{
        flexGrow: 1,
        padding: '1rem 1.25rem',
        overflowY: 'auto',
        maxHeight: '100vh',
      }}>
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
