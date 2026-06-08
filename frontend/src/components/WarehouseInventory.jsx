import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { SkeletonTable } from './Skeleton';
import { formatPersianNumber } from '../utils/persianNumbers';
import { useToast } from '../contexts/ToastContext';

const Icons = {
  download: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  search: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  box: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
  close: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
};

const WarehouseInventory = ({ isModal = false, onClose }) => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await api.get('balance/inventory/');
      // Sort by current stock desc
      const sorted = response.data.sort((a, b) => b.current_stock - a.current_stock);
      setInventory(sorted);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      showToast('خطا در دریافت موجودی انبار.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = async () => {
    try {
      const response = await api.get('balance/download-warehouse/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'warehouse_inventory.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود گزارش انبار.', 'error');
    }
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.work_category_name && item.work_category_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const renderContent = () => (
    <div className="section-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: isModal ? 'auto' : '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          <div className="section-title-icon">{Icons.box}</div>
          موجودی لحظه‌ای انبار
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
          <div className="search-box" style={{ maxWidth: '300px', flex: 1 }}>
            <span className="search-icon">{Icons.search}</span>
            <input
              type="text"
              className="form-control"
              placeholder="جستجوی متریال یا رسته..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingRight: '2.5rem' }}
            />
          </div>
          
          <button className="btn btn-accent" onClick={downloadReport}>
            {Icons.download}
            دانلود اکسل موجودی
          </button>
        </div>
      </div>

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : (
        <div className="table-container" style={{ flex: 1, maxHeight: isModal ? '60vh' : 'auto', overflowY: 'auto' }}>
          <table className="table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th>نام متریال</th>
                <th>رسته کاری</th>
                <th>مشخصات (سایز / ضخامت / جنس)</th>
                <th>ورودی کل</th>
                <th>خروجی کل</th>
                <th>موجودی فعلی</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon">📦</div>
                      <div className="empty-state-title">هیچ متریالی یافت نشد</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const specs = [item.size, item.thickness, item.material_type].filter(Boolean).join(' / ') || '—';
                  const isLow = item.current_stock <= 0;
                  
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.work_category_name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{specs}</td>
                      <td>
                        <span style={{ color: 'var(--success-500)', fontWeight: 500 }}>
                          {formatPersianNumber(item.total_in)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginRight: '4px' }}>{item.unit_display}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--warning-500)', fontWeight: 500 }}>
                          {formatPersianNumber(item.total_out)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginRight: '4px' }}>{item.unit_display}</span>
                      </td>
                      <td>
                        <span style={{ 
                          fontWeight: 700, 
                          color: isLow ? 'var(--danger-500)' : 'var(--primary-500)',
                          fontSize: '1.05rem'
                        }}>
                          {formatPersianNumber(item.current_stock)}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginRight: '4px' }}>{item.unit_display}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px', width: '95%' }}>
          <div className="modal-header">
            <h3 className="modal-title">مشاهده موجودی انبار</h3>
            <button className="modal-close" onClick={onClose}>
              {Icons.close}
            </button>
          </div>
          <div className="modal-body" style={{ padding: 0 }}>
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {renderContent()}
    </div>
  );
};

export default WarehouseInventory;
