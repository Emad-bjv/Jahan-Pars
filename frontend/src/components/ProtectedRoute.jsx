import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          در حال بررسی دسترسی...
        </div>
      </div>
    );
  }

  // اگر لاگین نبود برگردد به لاگین
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // سوپریوزر دسترسی کامل به همه بخش‌ها دارد
  if (user.is_superuser) {
    return <Outlet />;
  }

  // اگر نقشش مجاز نبود به صفحه‌ای متناسب هدایت شود
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'WAREHOUSE') {
      return <Navigate to="/warehouse" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  // اجازه عبور به Route‌های زیرین
  return <Outlet />;
};

export default ProtectedRoute;
