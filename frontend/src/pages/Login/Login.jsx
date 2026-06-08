import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(username, password);
      // ریدایرکت بر اساس نقش کاربر
      if (user.role === 'WAREHOUSE') {
        navigate('/warehouse');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('نام کاربری یا رمز عبور اشتباه است.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* بخش برند (سمت چپ) */}
      <div className="login-brand-panel">
        <div className="brand-grid-pattern"></div>
        <div className="brand-shape brand-shape-1"></div>
        <div className="brand-shape brand-shape-2"></div>
        <div className="brand-shape brand-shape-3"></div>
        <div className="brand-shape brand-shape-4"></div>
        <div className="brand-shape brand-shape-5"></div>
        <div className="brand-shape brand-shape-6"></div>

        <div className="login-brand-content">
          <div className="login-brand-logo">جهان‌پارس</div>
          <p className="login-brand-subtitle">
            سیستم یکپارچه موازنه متریال کارگاه
          </p>

          <div className="login-brand-features">
            <div className="login-brand-feature">
              <div className="login-brand-feature-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
              </div>
              <span>مدیریت هوشمند ورود و خروج متریال</span>
            </div>
            <div className="login-brand-feature">
              <div className="login-brand-feature-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/></svg>
              </div>
              <span>گزارش‌گیری خودکار و صدور اکسل</span>
            </div>
            <div className="login-brand-feature">
              <div className="login-brand-feature-icon">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z"/></svg>
              </div>
              <span>سطوح دسترسی امن و حفاظت‌شده</span>
            </div>
          </div>
        </div>
      </div>

      {/* بخش فرم ورود (سمت راست) */}
      <div className="login-form-panel">
        <div className="login-card">
          <div className="login-header">
            <h1>ورود به سیستم</h1>
            <p>لطفاً اطلاعات ورود خود را وارد نمایید</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}

            <div className="input-group">
              <label htmlFor="username">نام کاربری</label>
              <div className="input-wrapper">
                <input
                  id="username"
                  type="text"
                  className="input-control"
                  placeholder="نام کاربری خود را وارد کنید"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
                <span className="input-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z"/></svg>
                </span>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">رمز عبور</label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type="password"
                  className="input-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <span className="input-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z"/></svg>
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-login"
              disabled={isLoading}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                  </svg>
                  در حال ورود...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v1"/></svg>
                  ورود به سیستم
                </span>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
