import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { SkeletonTable } from '../../components/Skeleton';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import { formatPersianNumber, toPersianDigits } from '../../utils/persianNumbers';
import Select from 'react-select';

const selectStyles = {
  control: (base) => ({
    ...base,
    background: 'var(--bg-surface-solid)',
    borderColor: 'var(--border-color)',
    borderRadius: 'var(--radius-md)',
    minHeight: '42px',
    boxShadow: 'none',
    '&:hover': { borderColor: 'var(--primary-500)' }
  }),
  menu: (base) => ({
    ...base,
    background: 'var(--bg-surface-solid)',
    border: '1px solid var(--border-color)',
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    background: state.isFocused ? 'var(--bg-body)' : 'transparent',
    color: 'var(--text-main)',
    cursor: 'pointer'
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--text-main)'
  }),
  input: (base) => ({
    ...base,
    color: 'var(--text-main)'
  })
};

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
  check: (
    <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
    </svg>
  ),
};

const ApprovalsManager = () => {
  const [approvals, setApprovals] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [materials, setMaterials] = useState([]);
  
  const [formData, setFormData] = useState({ 
    contractor: '', material: '', approved_quantity: '', 
    contract_number: '', contract_subject: '', 
    approval_date: new Date().toISOString().split('T')[0] 
  });
  
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [liveReceived, setLiveReceived] = useState(null);
  const { showToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appRes, contRes, matRes] = await Promise.all([
        api.get('approvals/'),
        api.get('contractors/'),
        api.get('materials/')
      ]);
      setApprovals(appRes.data.results || appRes.data);
      setContractors(contRes.data.results || contRes.data);
      setMaterials(matRes.data.results || matRes.data);
    } catch (err) {
      console.error("Error fetching data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchLiveReceived = async () => {
      if (formData.contractor && formData.material) {
        try {
          const res = await api.get(`balance/contractor-material-received/?contractor_id=${formData.contractor}&material_id=${formData.material}`);
          setLiveReceived(res.data.total_received);
        } catch (err) {
          console.error("Error fetching live received stats", err);
          setLiveReceived(null);
        }
      } else {
        setLiveReceived(null);
      }
    };
    fetchLiveReceived();
  }, [formData.contractor, formData.material]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      await api.post('approvals/', formData);
      setFormData({ 
        ...formData, 
        material: '', approved_quantity: '', contract_number: '', contract_subject: '' 
      });
      showToast('تاییدیه با موفقیت ثبت شد', 'success');
      fetchData();
    } catch (err) {
      showToast(err.response?.data ? JSON.stringify(err.response.data) : 'خطا در ثبت تاییدیه دفتر فنی', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const downloadReport = async () => {
    try {
      const response = await api.get('balance/download-approvals/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'approvals_list.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود گزارش تاییدیه‌ها.', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingTop: '0.5rem' }}>
      {/* Header */}
      <div className="page-header animate-in">
        <div>
          <h1 className="gradient-text">مدیریت تاییدیه‌های کارکرد</h1>
          <p>ثبت مقادیر تایید شده دفتر فنی برای پیمانکاران جهت محاسبه اتوماتیک پرتی و کسری</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={downloadReport}>
            {Icons.download}
            دانلود تاییدیه‌ها
          </button>
        </div>
      </div>

      {/* Form Section */}
      <div className="section-panel animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem', position: 'relative', zIndex: 10 }}>
        <div className="section-title">
          <div className="section-title-icon">{Icons.plus}</div>
          ثبت تاییدیه جدید
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-3">
          
          <div className="form-group">
            <label className="form-label">پیمانکار</label>
            <Select 
              styles={selectStyles}
              placeholder="انتخاب پیمانکار..."
              isClearable
              options={contractors.map(c => ({ value: c.id, label: c.full_name }))}
              value={formData.contractor ? { value: formData.contractor, label: contractors.find(c => c.id === parseInt(formData.contractor))?.full_name } : null}
              onChange={selected => setFormData({...formData, contractor: selected ? selected.value : ''})}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">متریال / کالا</label>
            <Select 
              styles={selectStyles}
              placeholder="انتخاب متریال..."
              isClearable
              options={materials.map(m => ({ value: m.id, label: `${m.name} (${m.unit_display})` }))}
              value={formData.material ? { value: formData.material, label: materials.find(m => m.id === parseInt(formData.material))?.name + ' (' + materials.find(m => m.id === parseInt(formData.material))?.unit_display + ')' } : null}
              onChange={selected => setFormData({...formData, material: selected ? selected.value : ''})}
            />
            {liveReceived !== null && (
              <div className="live-indicator live-warning">
                <span className="live-indicator-dot"></span>
                مجموع دریافتی پیمانکار: {formatPersianNumber(parseFloat(liveReceived))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">مقدار تایید شده</label>
            <input type="number" step="0.01" name="approved_quantity" className="form-control" value={formData.approved_quantity} onChange={handleChange} required />
          </div>

          <div className="form-group">
            <label className="form-label">شماره قرارداد</label>
            <input type="text" name="contract_number" className="form-control" value={formData.contract_number} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">موضوع قرارداد</label>
            <input type="text" name="contract_subject" className="form-control" value={formData.contract_subject} onChange={handleChange} />
          </div>

          <div className="form-group">
            <label className="form-label">تاریخ تایید</label>
            <JalaliDatePicker 
              name="approval_date" 
              value={formData.approval_date} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={submitLoading} style={{ width: '100%', padding: '0.85rem' }}>
              {submitLoading ? 'در حال ثبت...' : (
                <>{Icons.plus} ثبت تاییدیه کارکرد</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* List Section */}
      <div className="section-panel animate-in animate-in-delay-2" style={{ position: 'relative', zIndex: 1 }}>
        <div className="section-title">
          <div className="section-title-icon">{Icons.check}</div>
          لیست تاییدیه‌ها
          {!loading && <span style={{ marginRight: 'auto', fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 500 }}>{toPersianDigits(approvals.length)} تاییدیه</span>}
        </div>
        {loading ? (
          <SkeletonTable rows={4} cols={6} />
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>پیمانکار</th>
                  <th>متریال</th>
                  <th>مقدار تایید شده</th>
                  <th>شماره قرارداد</th>
                  <th>پرتی مجاز</th>
                  <th>یادداشت محاسبه</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <div className="empty-state-title">تاییدیه‌ای یافت نشد</div>
                        <div className="empty-state-description">برای شروع، تاییدیه جدید ثبت کنید</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  approvals.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 600 }}>{a.contractor_detail?.full_name}</td>
                      <td>{a.material_detail?.name}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary-500)' }}>
                          {a.approved_quantity} {a.material_detail?.unit_display}
                        </span>
                      </td>
                      <td style={{ direction: 'ltr', textAlign: 'right' }}>{a.contract_number || '-'}</td>
                      <td><span className="badge badge-warning">{a.allowed_waste}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-dim)', maxWidth: '200px' }}>{a.balance_note}</td>
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

export default ApprovalsManager;
