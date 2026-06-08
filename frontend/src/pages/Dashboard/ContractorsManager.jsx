import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonTable } from '../../components/Skeleton';
import { AuthContext } from '../../contexts/AuthContext';
import { toPersianDigits } from '../../utils/persianNumbers';

/* ─── SVG Icons ──────────────────────────────────────────────── */
const Icons = {
  download: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
    </svg>
  ),
  plus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"/>
    </svg>
  ),
};

const ContractorsManager = () => {
  const { user } = useContext(AuthContext);
  const isReadOnly = !user?.is_superuser;

  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ first_name: '', last_name: '' });
  const [submitLoading, setSubmitLoading] = useState(false);
  const { showToast } = useToast();

  const fetchContractors = async () => {
    setLoading(true);
    try {
      const response = await api.get('contractors/');
      setContractors(response.data.results || response.data);
    } catch (err) {
      console.error("Error fetching contractors", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.post('contractors/', formData);
      setFormData({ first_name: '', last_name: '' });
      showToast('پیمانکار با موفقیت ثبت شد', 'success');
      fetchContractors(); // Refresh the list
    } catch (err) {
      showToast(err.response?.data ? JSON.stringify(err.response.data) : 'خطا در ثبت پیمانکار.', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('آیا از حذف این پیمانکار اطمینان دارید؟ تمام تراکنش‌های مرتبط ممکن است تحت تاثیر قرار گیرند.')) {
      try {
        await api.delete(`contractors/${id}/`);
        showToast('پیمانکار حذف شد', 'success');
        fetchContractors();
      } catch (err) {
        showToast('امکان حذف پیمانکار وجود ندارد. (شاید دارای تراکنش فعال باشد)', 'error');
      }
    }
  };

  const downloadReport = async () => {
    try {
      const response = await api.get('balance/download-contractors/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'contractors_list.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود گزارش پیمانکاران.', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '0.5rem' }}>
      {/* Header */}
      <div className="page-header animate-in">
        <div>
          <h1 className="gradient-text">مدیریت پیمانکاران</h1>
          <p>افزودن، ویرایش و مشاهده لیست پیمانکاران پروژه</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={downloadReport}>
            {Icons.download}
            دانلود لیست
          </button>
        </div>
      </div>

      {/* Form Section */}
      {!isReadOnly && (
        <div className="section-panel animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem' }}>
          <div className="section-title">
            <div className="section-title-icon">{Icons.plus}</div>
            افزودن پیمانکار جدید
          </div>
          <form onSubmit={handleSubmit} className="flex gap-4 items-center" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <input 
                type="text" 
                name="first_name" 
                placeholder="نام" 
                className="form-control" 
                value={formData.first_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: '180px' }}>
              <input 
                type="text" 
                name="last_name" 
                placeholder="نام خانوادگی" 
                className="form-control" 
                value={formData.last_name} 
                onChange={handleChange} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ height: '46px', minWidth: '140px' }}>
              {submitLoading ? 'در حال ثبت...' : (
                <>{Icons.plus} ثبت پیمانکار</>
              )}
            </button>
          </form>
        </div>
      )}

      {/* List Section */}
      <div className="section-panel animate-in animate-in-delay-2">
        <div className="section-title">
          <div className="section-title-icon">
            <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          لیست پیمانکاران
          {!loading && <span style={{ marginRight: 'auto', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 }}>{toPersianDigits(contractors.length)} پیمانکار</span>}
        </div>
        {loading ? (
          <SkeletonTable rows={4} cols={4} />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>شناسه</th>
                  <th>نام و نام خانوادگی</th>
                  <th style={{ textAlign: 'center' }}>تعداد تراکنش‌ها</th>
                  {!isReadOnly && <th style={{ textAlign: 'center' }}>عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {contractors.length === 0 ? (
                  <tr>
                    <td colSpan={isReadOnly ? "3" : "4"}>
                      <div className="empty-state">
                        <div className="empty-state-icon">👷</div>
                        <div className="empty-state-title">هیچ پیمانکاری یافت نشد</div>
                        <div className="empty-state-description">برای شروع، پیمانکار جدید اضافه کنید</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contractors.map(c => (
                    <tr key={c.id}>
                      <td>
                        <span className="badge badge-primary">#{c.id}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.full_name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-primary">{toPersianDigits(c.transaction_count || 0)} تراکنش</span>
                      </td>
                      {!isReadOnly && (
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-ghost"
                            style={{ color: 'var(--danger-500)', padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => handleDelete(c.id)}
                          >
                            {Icons.trash}
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractorsManager;
