import React, { useState } from 'react';

const UserProfileModal = ({ user, onClose }) => {
  const [emailVisible, setEmailVisible] = useState(false);

  const maskEmail = (email) => {
    if (!email) return 'ثبت نشده';
    const [name, domain] = email.split('@');
    if (!domain) return email;
    if (name.length <= 2) return `**@${domain}`;
    return `${name.substring(0, 2)}***@${domain}`;
  };

  const formatJoinedDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('fa-IR-u-nu-latn');
    } catch (e) {
      return '—';
    }
  };

  const roleLabels = {
    TECHNICAL: 'دفتر فنی',
    WAREHOUSE: 'انباردار',
    ADMIN: 'مدیر سیستم',
  };

  const getRoleBadge = (role) => {
    if (user?.is_superuser) return 'سوپر ادمین';
    return roleLabels[role] || role || 'کاربر سیستم';
  };

  return (
    <div className="luxury-modal-overlay" onClick={onClose}>
      <div className="luxury-modal-container user-profile-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="luxury-modal-header">
          <h3>مشخصات حساب کاربری</h3>
          <button className="luxury-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="luxury-modal-body" style={{ padding: '2rem' }}>
          
          {/* Main User Card (Avatar and Name) */}
          <div className="profile-hero">
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : '؟')}
              </div>
              <div className="profile-avatar-pulse"></div>
            </div>
            
            <h2 className="profile-name">{user?.full_name || user?.username}</h2>
            <div className={`profile-role-badge ${user?.is_superuser ? 'role-admin' : (user?.role === 'TECHNICAL' ? 'role-technical' : 'role-warehouse')}`}>
              {getRoleBadge(user?.role)}
            </div>
          </div>

          {/* Details Section */}
          <div className="profile-details-grid">
            
            {/* Username */}
            <div className="profile-detail-card">
              <div className="profile-detail-icon">👤</div>
              <div className="profile-detail-info">
                <span className="profile-detail-label">نام کاربری (حساب)</span>
                <span className="profile-detail-value font-mono">{user?.username}</span>
              </div>
            </div>

            {/* Email (with Masking & Toggle Visibility) */}
            <div className="profile-detail-card">
              <div className="profile-detail-icon">✉️</div>
              <div className="profile-detail-info" style={{ flexGrow: 1 }}>
                <span className="profile-detail-label">پست الکترونیک</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span className="profile-detail-value font-mono">
                    {emailVisible ? user?.email || 'ثبت نشده' : maskEmail(user?.email)}
                  </span>
                  {user?.email && (
                    <button 
                      type="button" 
                      className="btn-profile-toggle-email" 
                      onClick={() => setEmailVisible(!emailVisible)}
                      title={emailVisible ? "مخفی کردن ایمیل" : "نمایش ایمیل"}
                      style={{ cursor: 'pointer' }}
                    >
                      {emailVisible ? (
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Date Joined */}
            <div className="profile-detail-card">
              <div className="profile-detail-icon">📅</div>
              <div className="profile-detail-info">
                <span className="profile-detail-label">تاریخ عضویت</span>
                <span className="profile-detail-value">{formatJoinedDate(user?.date_joined)}</span>
              </div>
            </div>

            {/* Session Security Indicator */}
            <div className="profile-detail-card profile-security-card">
              <div className="profile-detail-icon security-glow">🛡️</div>
              <div className="profile-detail-info">
                <span className="profile-detail-label">وضعیت امنیت نشست</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="security-pulse-dot"></span>
                  <span className="profile-detail-value security-status-text">فعال و امن (SSL)</span>
                </div>
              </div>
            </div>

          </div>

          {/* Warning/Footer message */}
          <div className="profile-security-footer">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginLeft: '6px' }}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>این اطلاعات فقط برای شما نمایش داده می‌شود. جهت حفظ امنیت، پس از اتمام کار حتماً خارج شوید.</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
