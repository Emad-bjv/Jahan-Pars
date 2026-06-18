import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { SkeletonTable } from '../../components/Skeleton';
import { toPersianDigits } from '../../utils/persianNumbers';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icons = {
  history: (
    <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
    </svg>
  ),
  create: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"/>
    </svg>
  ),
  update: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
    </svg>
  ),
  delete: (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
    </svg>
  ),
};

const actionBadges = {
  CREATE: { label: 'ایجاد', className: 'badge-success', icon: Icons.create },
  UPDATE: { label: 'ویرایش', className: 'badge-warning', icon: Icons.update },
  DELETE: { label: 'حذف', className: 'badge-danger', icon: Icons.delete },
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let url = 'audit-logs/?limit=100';
      if (filterAction) url += `&action=${filterAction}`;
      if (filterModel) url += `&model=${filterModel}`;
      const res = await api.get(url);
      setLogs(res.data.results || []);
    } catch (err) {
      console.error('Error fetching audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterModel]);

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    const date = d.toLocaleDateString('fa-IR-u-nu-latn');
    const time = d.toLocaleTimeString('fa-IR-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
    return `${date} — ${time}`;
  };

  const renderChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) return null;
    
    // For CREATE: show "created" key
    if (changes.created) {
      return (
        <div className="audit-changes-detail">
          <div className="audit-changes-title">مقادیر ثبت شده:</div>
          <div className="audit-changes-grid">
            {Object.entries(changes.created).map(([key, val]) => (
              <div key={key} className="audit-change-row">
                <span className="audit-change-key">{key}</span>
                <span className="audit-change-value audit-change-new">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // For DELETE: show "deleted" key
    if (changes.deleted) {
      return (
        <div className="audit-changes-detail">
          <div className="audit-changes-title">مقادیر حذف شده:</div>
          <div className="audit-changes-grid">
            {Object.entries(changes.deleted).map(([key, val]) => (
              <div key={key} className="audit-change-row">
                <span className="audit-change-key">{key}</span>
                <span className="audit-change-value audit-change-old">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // For UPDATE: show before/after
    return (
      <div className="audit-changes-detail">
        <div className="audit-changes-title">تغییرات اعمال شده:</div>
        <div className="audit-changes-grid">
          {Object.entries(changes).map(([key, val]) => (
            <div key={key} className="audit-change-row">
              <span className="audit-change-key">{key}</span>
              <span className="audit-change-value audit-change-old">{val.before || '—'}</span>
              <span className="audit-change-arrow">→</span>
              <span className="audit-change-value audit-change-new">{val.after || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 2.5rem)' }}>
      {/* Header */}
      <div className="page-header animate-in" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="gradient-text">تاریخچه تغییرات سیستم</h1>
          <p>ثبت و پیگیری تمام عملیات‌های ایجاد، ویرایش و حذف</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        </div>
      </div>

      {/* Filters */}
      <div className="section-panel animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem', flexShrink: 0 }}>
        <div className="section-title" style={{ marginBottom: '1rem' }}>
          <div className="section-title-icon">{Icons.history}</div>
          فیلتر لاگ‌ها
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
            <select className="form-control" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">همه عملیات‌ها</option>
              <option value="CREATE">ایجاد</option>
              <option value="UPDATE">ویرایش</option>
              <option value="DELETE">حذف</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
            <select className="form-control" value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
              <option value="">همه مدل‌ها</option>
              <option value="پیمانکار">پیمانکار</option>
              <option value="کالا">کالا / متریال</option>
              <option value="تراکنش">تراکنش انبار</option>
              <option value="تاییدیه">تاییدیه عملکرد</option>
              <option value="رسته">رسته کاری</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="section-panel animate-in animate-in-delay-2" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="section-title" style={{ flexShrink: 0 }}>
          <div className="section-title-icon">{Icons.history}</div>
          لاگ تغییرات
          {!loading && <span style={{ marginRight: 'auto', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 }}>{toPersianDigits(logs.length)} رکورد</span>}
        </div>

        {loading ? (
          <SkeletonTable rows={6} cols={5} />
        ) : (
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>کاربر</th>
                  <th>عملیات</th>
                  <th>بخش</th>
                  <th>شرح</th>
                  <th>زمان</th>
                  <th style={{ textAlign: 'center' }}>جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-title">لاگی یافت نشد</div>
                        <div className="empty-state-description">تاریخچه تغییرات سیستم اینجا نمایش داده می‌شود</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map(log => {
                    const badge = actionBadges[log.action] || {};
                    const isExpanded = expandedId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div className="sidebar-user-avatar" style={{ width: '28px', height: '28px', fontSize: '0.65rem' }}>
                                {log.user_display?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              {log.user_display}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${badge.className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              {badge.icon}
                              {badge.label}
                            </span>
                          </td>
                          <td>{log.model_name}</td>
                          <td style={{ fontSize: '0.82rem', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {log.object_repr}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                              {isExpanded ? '▲ بستن' : '▼ نمایش'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan="6" style={{ padding: '0.5rem 1.5rem 1rem', background: 'var(--bg-surface)' }}>
                              {renderChanges(log.changes)}
                              {log.ip_address && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                                  IP: <span style={{ direction: 'ltr', display: 'inline-block' }}>{log.ip_address}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
