import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/Skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Area, AreaChart
} from 'recharts';
import { formatPersianNumber, toPersianDigits } from '../../utils/persianNumbers';

/* ─── Animated Counter Hook ──────────────────────────────────── */
const useAnimatedCounter = (end, duration = 1200) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (end == null || isNaN(end)) return;
    const target = Number(end);
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [end, duration]);

  return count;
};

/* ─── SVG Icons ──────────────────────────────────────────────── */
const StatIcons = {
  inbound: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
    </svg>
  ),
  outbound: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
    </svg>
  ),
  approved: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
    </svg>
  ),
  balance: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 0 0 6.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>
    </svg>
  ),
  download: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z"/>
    </svg>
  ),
  pdf: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
};

/* ─── Stat Card Component ────────────────────────────────────── */
const StatCard = ({ icon, iconClass, title, value, subtitle, accentBar, delay }) => {
  const animatedValue = useAnimatedCounter(value);
  return (
    <div className={`glow-card stat-card animate-in animate-in-delay-${delay} glow-${accentBar === 'bar-success' ? 'success' : accentBar === 'bar-warning' ? 'warning' : accentBar === 'bar-primary' ? 'primary' : 'danger'}`}>
      <div className={`stat-accent-bar ${accentBar}`}></div>
      <div className={`stat-card-icon ${iconClass}`}>{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-title">{title}</div>
        <div className="stat-card-value">{formatPersianNumber(animatedValue)}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
};

/* ─── Custom Tooltip ─────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'var(--bg-surface-solid)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(10px)',
      }}>
        <p style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-main)' }}>{label}</p>
        <p style={{ color: payload[0].color, fontWeight: 600, fontSize: '1.1rem' }}>
          {formatPersianNumber(Number(payload[0].value))}
        </p>
      </div>
    );
  }
  return null;
};

/* ─── Main Component ─────────────────────────────────────────── */
const DashboardOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Modal States
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [apiContractors, setApiContractors] = useState([]);
  const [apiMaterials, setApiMaterials] = useState([]);
  
  // Excel Modal State
  const [excelContractorSearch, setExcelContractorSearch] = useState('');
  const [selectedExcelContractor, setSelectedExcelContractor] = useState(null);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);

  // PDF Modal State
  const [pdfContractorSearch, setPdfContractorSearch] = useState('');
  const [selectedPdfContractor, setSelectedPdfContractor] = useState(null);
  const [showPdfContractorDropdown, setShowPdfContractorDropdown] = useState(false);
  
  const [pdfMaterialSearch, setPdfMaterialSearch] = useState('');
  const [selectedPdfMaterial, setSelectedPdfMaterial] = useState(null);
  const [showPdfMaterialDropdown, setShowPdfMaterialDropdown] = useState(false);

  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('dashboard/');
        setData(response.data);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    const fetchFilterData = async () => {
      try {
        const [contRes, matRes] = await Promise.all([
          api.get('contractors/'),
          api.get('materials/')
        ]);
        setApiContractors(contRes.data.results || contRes.data);
        setApiMaterials(matRes.data.results || matRes.data);
      } catch (error) {
        console.error("Error fetching filter data", error);
      }
    };
    fetchDashboardData();
    fetchFilterData();
  }, []);

  const downloadReport = async (type = 'global') => {
    try {
      showToast('در حال آماده سازی گزارش...', 'info');
      let endpoint = 'balance/download-global/';
      let filename = 'global_balance';
      
      const response = await api.get(endpoint, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('گزارش با موفقیت دانلود شد', 'success');
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود گزارش.', 'error');
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedExcelContractor) {
      showToast('لطفاً یک پیمانکار انتخاب کنید', 'error');
      return;
    }
    
    try {
      showToast('در حال آماده سازی گزارش...', 'info');
      const response = await api.get(`balance/download/?contractor_id=${selectedExcelContractor.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `balance_${selectedExcelContractor.first_name}_${selectedExcelContractor.last_name}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('گزارش با موفقیت دانلود شد', 'success');
      setIsExcelModalOpen(false);
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود گزارش.', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      showToast('در حال تولید فایل PDF...', 'info');
      let urlStr = 'balance/download-pdf/?';
      const params = new URLSearchParams();
      if (selectedPdfContractor) params.append('contractor_id', selectedPdfContractor.id);
      if (selectedPdfMaterial) params.append('material_id', selectedPdfMaterial.id);
      if (pdfFromDate) params.append('from_date', pdfFromDate);
      if (pdfToDate) params.append('to_date', pdfToDate);
      
      const response = await api.get(`${urlStr}${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'balance_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('گزارش PDF با موفقیت دانلود شد', 'success');
      setIsPdfModalOpen(false);
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود فایل PDF.', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1400px', margin: '0 auto', paddingTop: '1rem' }}>
        <div className="grid grid-cols-4" style={{ marginBottom: '2rem' }}>
          {Array.from({length: 4}).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-2">
          <div className="glass-panel" style={{ padding: '1.5rem', height: '400px' }}><Skeleton width="100%" height="100%" /></div>
          <div className="glass-panel" style={{ padding: '1.5rem', height: '400px' }}><SkeletonTable rows={4} cols={3} /></div>
        </div>
      </div>
    );
  }

  const chartData = [
    { name: 'متریال ورودی', value: data?.total_in || 0, fill: 'var(--success-500)', color: '#10b981' },
    { name: 'متریال خروجی', value: data?.total_out || 0, fill: 'var(--warning-500)', color: '#f59e0b' },
    { name: 'کار تایید شده', value: data?.total_approved || 0, fill: 'var(--primary-500)', color: '#6366f1' },
  ];

  const contractors = data?.contractors || [];
  const totalBalance = contractors.reduce((acc, curr) => acc + curr.total_balance, 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header animate-in">
        <div>
          <h1 className="gradient-text">نمای کلی کارگاه</h1>
          <p>خلاصه وضعیت موازنه متریال و عملکرد پیمانکاران</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setIsExcelModalOpen(true)}>
            {StatIcons.download}
            تفکیک پیمانکاران
          </button>
          <button className="btn btn-secondary" onClick={() => setIsPdfModalOpen(true)}>
            {StatIcons.pdf}
            خروجی PDF
          </button>
          <button className="btn btn-primary" onClick={() => downloadReport('global')}>
            {StatIcons.download}
            موازنه کل
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4" style={{ marginBottom: '1rem' }}>
        <StatCard
          icon={StatIcons.inbound}
          iconClass="icon-success"
          title="کل متریال ورودی"
          value={data?.total_in || 0}
          accentBar="bar-success"
          delay={1}
        />
        <StatCard
          icon={StatIcons.outbound}
          iconClass="icon-warning"
          title="کل متریال خروجی"
          value={data?.total_out || 0}
          accentBar="bar-warning"
          delay={2}
        />
        <StatCard
          icon={StatIcons.approved}
          iconClass="icon-primary"
          title="کل تاییدیه‌ها"
          value={data?.total_approved || 0}
          accentBar="bar-primary"
          delay={3}
        />
        <StatCard
          icon={StatIcons.balance}
          iconClass={totalBalance > 0 ? 'icon-danger' : 'icon-success'}
          title="وضعیت موازنه"
          value={Math.abs(totalBalance)}
          subtitle={totalBalance > 0 ? 'بدهکار کل (مازاد دریافت)' : totalBalance < 0 ? 'بستانکار کل (کسری)' : 'وضعیت نرمال ✓'}
          accentBar={totalBalance > 0 ? 'bar-danger' : 'bar-success'}
          delay={4}
        />
      </div>

      {/* Charts & Table */}
      <div className="grid grid-cols-2" style={{ alignItems: 'start' }}>
        {/* Chart Section */}
        <div className="section-panel animate-in animate-in-delay-5" style={{ height: '340px' }}>
          <div className="section-title">
            <div className="section-title-icon">
              <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/></svg>
            </div>
            نمودار کلی عملیات
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 50px)', direction: 'ltr' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.9}/>
                  </linearGradient>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#d97706" stopOpacity={0.9}/>
                  </linearGradient>
                  <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                  <Cell fill="url(#gradGreen)" />
                  <Cell fill="url(#gradOrange)" />
                  <Cell fill="url(#gradIndigo)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contractors Table Section */}
        <div className="section-panel animate-in animate-in-delay-6" style={{ height: '340px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">
            <div className="section-title-icon">
              <svg width="16" height="16" fill="none" stroke="var(--primary-500)" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            موازنه پیمانکاران
          </div>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>نام پیمانکار</th>
                  <th style={{ textAlign: 'center' }}>موازنه (مقادیر)</th>
                  <th style={{ textAlign: 'center' }}>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {contractors.length === 0 ? (
                  <tr>
                    <td colSpan="3">
                      <div className="empty-state">
                        <div className="empty-state-icon">📋</div>
                        <div className="empty-state-title">اطلاعاتی یافت نشد</div>
                        <div className="empty-state-description">هنوز هیچ تراکنشی ثبت نشده است</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contractors.map((c) => (
                    <tr key={c.contractor_id}>
                      <td style={{ fontWeight: 600 }}>
                        {c.contractor_name}
                        {c.under_review_count > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                            ⏳ {formatPersianNumber(c.under_review_count)} مورد در دست بررسی دفتر فنی
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', direction: 'ltr' }}>
                        <span style={{ 
                          fontWeight: 700, 
                          color: c.total_balance > 0 ? 'var(--danger-500)' : c.total_balance < 0 ? 'var(--success-500)' : 'var(--text-main)'
                        }}>
                          {c.total_balance > 0 ? `+${formatPersianNumber(c.total_balance)}` : formatPersianNumber(c.total_balance)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.total_balance > 0 ? (
                          <span className="badge badge-danger">بدهکار (مازاد دریافت)</span>
                        ) : c.total_balance < 0 ? (
                          <span className="badge badge-success">بستانکار (کسری)</span>
                        ) : c.under_review_count > 0 ? (
                          <span className="badge badge-secondary">در انتظار تایید</span>
                        ) : (
                          <span className="badge badge-warning">تسویه</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Excel Modal */}
      {isExcelModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExcelModalOpen(false)}>
          <div className="modal-container animate-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>دانلود گزارش تفکیک پیمانکار</h2>
              <button className="modal-close-btn" onClick={() => setIsExcelModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">انتخاب پیمانکار</label>
                <div className="searchable-dropdown">
                  <input
                    type="text"
                    className="searchable-dropdown-input"
                    placeholder="جستجوی نام پیمانکار..."
                    value={excelContractorSearch}
                    onChange={(e) => {
                      setExcelContractorSearch(e.target.value);
                      setShowExcelDropdown(true);
                      if (e.target.value === '') setSelectedExcelContractor(null);
                    }}
                    onFocus={() => setShowExcelDropdown(true)}
                  />
                  {showExcelDropdown && (
                    <div className="searchable-dropdown-list">
                      {apiContractors
                        .filter(c => `${c.first_name} ${c.last_name}`.includes(excelContractorSearch))
                        .map(c => (
                          <div
                            key={c.id}
                            className={`searchable-dropdown-item ${selectedExcelContractor?.id === c.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedExcelContractor(c);
                              setExcelContractorSearch(`${c.first_name} ${c.last_name}`);
                              setShowExcelDropdown(false);
                            }}
                          >
                            {c.first_name} {c.last_name}
                          </div>
                      ))}
                      {apiContractors.filter(c => `${c.first_name} ${c.last_name}`.includes(excelContractorSearch)).length === 0 && (
                        <div className="searchable-dropdown-item" style={{color: 'var(--text-dim)', textAlign: 'center'}}>پیمانکاری یافت نشد</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsExcelModalOpen(false)}>انصراف</button>
              <button className="btn btn-primary" onClick={handleDownloadExcel}>دانلود گزارش</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      {isPdfModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPdfModalOpen(false)}>
          <div className="modal-container animate-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>تولید فایل PDF موازنه</h2>
              <button className="modal-close-btn" onClick={() => setIsPdfModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">انتخاب پیمانکار (اختیاری)</label>
                <div className="searchable-dropdown">
                  <input
                    type="text"
                    className="searchable-dropdown-input"
                    placeholder="همه پیمانکاران..."
                    value={pdfContractorSearch}
                    onChange={(e) => {
                      setPdfContractorSearch(e.target.value);
                      setShowPdfContractorDropdown(true);
                      if (e.target.value === '') setSelectedPdfContractor(null);
                    }}
                    onFocus={() => setShowPdfContractorDropdown(true)}
                  />
                  {showPdfContractorDropdown && (
                    <div className="searchable-dropdown-list">
                      <div className="searchable-dropdown-item" onClick={() => { setSelectedPdfContractor(null); setPdfContractorSearch(''); setShowPdfContractorDropdown(false); }}>
                        همه پیمانکاران
                      </div>
                      {apiContractors
                        .filter(c => `${c.first_name} ${c.last_name}`.includes(pdfContractorSearch))
                        .map(c => (
                          <div
                            key={c.id}
                            className={`searchable-dropdown-item ${selectedPdfContractor?.id === c.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedPdfContractor(c);
                              setPdfContractorSearch(`${c.first_name} ${c.last_name}`);
                              setShowPdfContractorDropdown(false);
                            }}
                          >
                            {c.first_name} {c.last_name}
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">انتخاب متریال (اختیاری)</label>
                <div className="searchable-dropdown">
                  <input
                    type="text"
                    className="searchable-dropdown-input"
                    placeholder="همه متریال‌ها..."
                    value={pdfMaterialSearch}
                    onChange={(e) => {
                      setPdfMaterialSearch(e.target.value);
                      setShowPdfMaterialDropdown(true);
                      if (e.target.value === '') setSelectedPdfMaterial(null);
                    }}
                    onFocus={() => setShowPdfMaterialDropdown(true)}
                  />
                  {showPdfMaterialDropdown && (
                    <div className="searchable-dropdown-list">
                      <div className="searchable-dropdown-item" onClick={() => { setSelectedPdfMaterial(null); setPdfMaterialSearch(''); setShowPdfMaterialDropdown(false); }}>
                        همه متریال‌ها
                      </div>
                      {apiMaterials
                        .filter(m => m.name.includes(pdfMaterialSearch))
                        .map(m => (
                          <div
                            key={m.id}
                            className={`searchable-dropdown-item ${selectedPdfMaterial?.id === m.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedPdfMaterial(m);
                              setPdfMaterialSearch(m.name);
                              setShowPdfMaterialDropdown(false);
                            }}
                          >
                            {m.name} <small style={{color:'var(--text-dim)'}}>({m.unit_display || m.unit})</small>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">از تاریخ (اختیاری)</label>
                  <input type="date" className="form-control" value={pdfFromDate} onChange={e => setPdfFromDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">تا تاریخ (اختیاری)</label>
                  <input type="date" className="form-control" value={pdfToDate} onChange={e => setPdfToDate(e.target.value)} />
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsPdfModalOpen(false)}>انصراف</button>
              <button className="btn btn-primary" onClick={handleDownloadPdf}>تولید فایل PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
