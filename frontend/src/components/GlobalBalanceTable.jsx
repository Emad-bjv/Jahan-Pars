import React, { useState, useEffect } from 'react';
import api from '../services/api';

const GlobalBalanceTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedContractor, setSelectedContractor] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [expandedRow, setExpandedRow] = useState(null);

  // Fetch balance rows
  useEffect(() => {
    const fetchBalanceRows = async () => {
      try {
        setLoading(true);
        const res = await api.get('balance/global-rows/');
        setData(res.data);
      } catch (err) {
        console.error("Error fetching global balance rows", err);
        setError("خطا در بارگذاری اطلاعات موازنه کل.");
      } finally {
        setLoading(false);
      }
    };
    fetchBalanceRows();
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
    setExpandedRow(null);
  }, [searchQuery, selectedCategory, selectedContractor, selectedMaterial, selectedStatus]);

  // Extract unique filter options dynamically from data
  const categories = [...new Set(data.map(item => item.work_category).filter(Boolean))].sort();
  const contractors = [...new Set(data.map(item => item.contractor_name).filter(Boolean))].sort();
  const materials = [...new Set(data.map(item => item.material_name).filter(Boolean))].sort();
  const statuses = [...new Set(data.map(item => item.balance_label).filter(Boolean))].sort();

  // Filtering Logic
  const filteredData = data.filter(item => {
    const matchesSearch = 
      item.contractor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.contract_subject && item.contract_subject.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory ? item.work_category === selectedCategory : true;
    const matchesContractor = selectedContractor ? item.contractor_name === selectedContractor : true;
    const matchesMaterial = selectedMaterial ? item.material_name === selectedMaterial : true;
    const matchesStatus = selectedStatus ? item.balance_label === selectedStatus : true;

    return matchesSearch && matchesCategory && matchesContractor && matchesMaterial && matchesStatus;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    setExpandedRow(null);
  };

  const getStatusBadgeClass = (label) => {
    if (label.includes("مازاد")) return "status-badge-success";
    if (label.includes("کسری")) return "status-badge-danger";
    if (label.includes("ایده‌آل")) return "status-badge-warning";
    return "status-badge-info"; // For under review
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') return num;
    return new Intl.NumberFormat('fa-IR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const toggleRowExpand = (index) => {
    if (expandedRow === index) {
      setExpandedRow(null);
    } else {
      setExpandedRow(index);
    }
  };

  if (loading) {
    return (
      <div className="section-panel" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">در حال بارگذاری...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger-500)' }}>
        {error}
      </div>
    );
  }

  return (
    <div className="section-panel" style={{ marginTop: '2rem' }}>
      <div className="section-title">
        <div className="section-title-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-500)' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125z" />
          </svg>
        </div>
        گزارش موازنه کل متریال کارگاه
      </div>

      {/* Advanced Filter Bar */}
      <div className="balance-filter-bar">
        <div className="balance-search-wrap">
          <input
            type="text"
            className="form-control"
            placeholder="جستجو در نام پیمانکار، کالا، قرارداد..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-icon-inside">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>

        <div className="balance-dropdowns-wrap">
          <div className="filter-select-group">
            <label>رسته کاری</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">همه رسته‌ها</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="filter-select-group">
            <label>پیمانکار</label>
            <select
              className="form-select"
              value={selectedContractor}
              onChange={(e) => setSelectedContractor(e.target.value)}
            >
              <option value="">همه پیمانکاران</option>
              {contractors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="filter-select-group">
            <label>کالا</label>
            <select
              className="form-select"
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
            >
              <option value="">همه کالاها</option>
              {materials.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="filter-select-group">
            <label>وضعیت موازنه</label>
            <select
              className="form-select"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              {statuses.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="table-container" style={{ marginTop: '1.5rem' }}>
        <table className="table table-lg balance-rows-table">
          <thead>
            <tr>
              <th style={{ width: '60px', textAlign: 'center' }}>ردیف</th>
              <th>پیمانکار</th>
              <th>نام کالا</th>
              <th style={{ textAlign: 'center' }}>کل تحویلی</th>
              <th style={{ textAlign: 'center' }}>کار تاییدشده</th>
              <th style={{ textAlign: 'center' }}>موازنه (انحراف)</th>
              <th style={{ textAlign: 'center', width: '150px' }}>وضعیت نهایی</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {currentItems.length > 0 ? (
              currentItems.map((row, idx) => {
                const globalIdx = indexOfFirstItem + idx + 1;
                const isExpanded = expandedRow === idx;
                const isStringBalance = typeof row.balance === 'string';
                const balanceVal = isStringBalance ? 0 : row.balance;

                return (
                  <React.Fragment key={`${row.contractor_name}-${row.material_name}-${row.contract_number}-${idx}`}>
                    <tr 
                      className={`balance-tr-main ${isExpanded ? 'is-expanded' : ''}`}
                      onClick={() => toggleRowExpand(idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ textAlign: 'center', fontWeight: '500', color: 'var(--text-muted)' }}>
                        {globalIdx}
                      </td>
                      <td style={{ fontWeight: '600' }}>{row.contractor_name}</td>
                      <td style={{ fontWeight: '500' }}>{row.material_name}</td>
                      <td style={{ textAlign: 'center', fontWeight: '500' }}>
                        {formatNumber(row.total_issued)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.unit}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '500' }}>
                        {formatNumber(row.approved_work)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.unit}</span>
                      </td>
                      <td 
                        style={{ 
                          textAlign: 'center', 
                          fontWeight: '700',
                          direction: 'ltr',
                          color: isStringBalance 
                            ? 'var(--text-muted)' 
                            : balanceVal > 0 
                              ? 'var(--success)' 
                              : balanceVal < 0 
                                ? 'var(--danger)' 
                                : 'var(--warning)'
                        }}
                      >
                        {isStringBalance ? '—' : formatNumber(row.balance)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${getStatusBadgeClass(row.balance_label)}`}>
                          {row.balance_label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`expand-chevron-icon ${isExpanded ? 'rotated' : ''}`}>
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </span>
                      </td>
                    </tr>

                    {/* Accordion Collapsible Detail Row */}
                    <tr className={`balance-tr-detail ${isExpanded ? 'show' : ''}`}>
                      <td colSpan="8" style={{ padding: 0 }}>
                        <div className="balance-detail-wrapper">
                          <div className="balance-detail-grid">
                            <div className="balance-detail-section">
                              <h6>اطلاعات قرارداد</h6>
                              <div className="balance-detail-field">
                                <span className="label">شماره قرارداد:</span>
                                <span className="val">{row.contract_number}</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">موضوع قرارداد:</span>
                                <span className="val">{row.contract_subject}</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">رسته کاری:</span>
                                <span className="val">{row.work_category}</span>
                              </div>
                            </div>

                            <div className="balance-detail-section">
                              <h6>مشخصات کالا</h6>
                              <div className="balance-detail-field">
                                <span className="label">نام متریال:</span>
                                <span className="val">{row.material_name}</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">ابعاد / سایز:</span>
                                <span className="val">{row.size}</span>
                              </div>
                              <div className="balance-detail-field font-center">
                                <span className="label">جنس:</span>
                                <span className="val">{row.mat_type}</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">ضخامت:</span>
                                <span className="val">{row.thickness}</span>
                              </div>
                            </div>

                            <div className="balance-detail-section">
                              <h6>جزئیات و محاسبات موازنه</h6>
                              <div className="balance-detail-field">
                                <span className="label">کل متریال تحویلی:</span>
                                <span className="val">{formatNumber(row.total_issued)} {row.unit}</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">مقدار کار تایید شده:</span>
                                <span className="val">{formatNumber(row.approved_work)} {row.unit}</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">درصد پرتی متریال:</span>
                                <span className="val">{row.waste_pct} ٪</span>
                              </div>
                              <div className="balance-detail-field">
                                <span className="label">پرتی مجاز محاسبه شده:</span>
                                <span className="val">{formatNumber(row.allowed_waste)} {row.unit}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  هیچ موردی یافت نشد. فیلترها یا عبارت جستجو را تغییر دهید.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="balance-pagination-container">
          <div className="pagination-info">
            نمایش ردیف‌های {formatNumber(indexOfFirstItem + 1)} تا {formatNumber(Math.min(indexOfLastItem, filteredData.length))} از {formatNumber(filteredData.length)} ردیف موازنه
          </div>
          <div className="pagination-buttons">
            <button 
              className="pagination-btn" 
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              قبلی
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                className={`pagination-btn-number ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => handlePageChange(pageNum)}
              >
                {formatNumber(pageNum)}
              </button>
            ))}

            <button 
              className="pagination-btn" 
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalBalanceTable;
