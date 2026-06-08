import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login/Login';
import DashboardLayout from './pages/Dashboard/DashboardLayout';
import DashboardOverview from './pages/Dashboard/DashboardOverview';
import ContractorsManager from './pages/Dashboard/ContractorsManager';
import MaterialsManager from './pages/Dashboard/MaterialsManager';
import ApprovalsManager from './pages/Dashboard/ApprovalsManager';
import AuditLog from './pages/Dashboard/AuditLog';
import Warehouse from './pages/Warehouse/Warehouse';
import WarehouseInventory from './components/WarehouseInventory';
import './index.css';

// تم کنترلر به صورت یک کامپوننت پوششی
const ThemeController = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <>
      {/* پس‌زمینه انیمیت‌شده با بلاب‌ها و ذرات شناور */}
      <div className="animated-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
        <div className="particle particle-5"></div>
        <div className="particle particle-6"></div>
      </div>

      {/* دکمه تغییر تم */}
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label="تغییر تم"
        title={theme === 'light' ? 'حالت تاریک' : 'حالت روشن'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      {children}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ThemeController>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* روت‌های دفتر فنی (مدیریتی) */}
            <Route element={<ProtectedRoute allowedRoles={['TECHNICAL', 'ADMIN']} />}>
              <Route path="/dashboard" element={<DashboardLayout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="contractors" element={<ContractorsManager />} />
                <Route path="materials" element={<MaterialsManager />} />
                <Route path="inventory" element={<WarehouseInventory />} />
                <Route path="approvals" element={<ApprovalsManager />} />
                <Route path="audit-log" element={<AuditLog />} />
              </Route>
            </Route>
            
            {/* روت‌های انباردار */}
            <Route element={<ProtectedRoute allowedRoles={['WAREHOUSE']} />}>
              <Route path="/warehouse" element={<Warehouse />} />
            </Route>

            {/* در صورت مسیر اشتباه، اگر لاگین نبود برود به لاگین */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeController>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
