import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { SkeletonTable } from '../../components/Skeleton';
import { formatPersianNumber, toPersianDate } from '../../utils/persianNumbers';

const TransactionList = ({ refreshTrigger }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const response = await api.get('transactions/');
        // Handle DRF paginated response
        let data = response.data.results || response.data;
        data = [...data].sort((a, b) => b.id - a.id);
        setTransactions(data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="section-panel">
        <SkeletonTable rows={5} cols={5} />
      </div>
    );
  }

  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'ALL' && tx.transaction_type !== filterType) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const materialName = (tx.material_detail?.name || '').toLowerCase();
      const contractorName = (tx.contractor_detail?.full_name || '').toLowerCase();
      const bill = (tx.bill_of_lading || '').toLowerCase();
      const contract = (tx.contract_number || '').toLowerCase();
      
      if (!materialName.includes(term) && 
          !contractorName.includes(term) && 
          !bill.includes(term) && 
          !contract.includes(term)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="section-panel" style={{ padding: 0, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      
      {/* Search and Filter UI */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', backgroundColor: 'var(--bg-surface-solid)' }}>
        <input 
          type="text" 
          className="form-control" 
          placeholder="جستجو (متریال، پیمانکار، شماره قرارداد، بارنامه...)" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1 }}
        />
        <select 
          className="form-control" 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{ width: '200px' }}
        >
          <option value="ALL">همه تراکنش‌ها</option>
          <option value="IN">ورود به انبار</option>
          <option value="OUT">خروج از انبار</option>
        </select>
      </div>

      <div className="table-container" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto', borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
        <table className="table table-lg">
          <thead>
            <tr>
              <th>نوع</th>
              <th>متریال</th>
              <th>مقدار</th>
              <th>تاریخ</th>
              <th>پیمانکار / بارنامه</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">هیچ تراکنشی یافت نشد</div>
                    <div className="empty-state-description">تراکنش‌های ثبت‌شده اینجا نمایش داده می‌شوند</div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} onClick={() => setSelectedTx(tx)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className={`badge ${tx.transaction_type === 'IN' ? 'badge-success' : 'badge-warning'}`}>
                      {tx.transaction_type === 'IN' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                          ورود
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                          خروج
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {tx.material_detail?.name}
                    {tx.material_detail && (tx.material_detail.size || tx.material_detail.thickness || tx.material_detail.material_type) ? (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginRight: '6px', fontWeight: 400 }}>
                        ({[tx.material_detail.size, tx.material_detail.thickness, tx.material_detail.material_type].filter(Boolean).join(' / ')})
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--primary-500)' }}>{formatPersianNumber(tx.quantity, 2)}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginRight: '4px' }}>{tx.material_detail?.unit_display}</span>
                  </td>
                  <td style={{ direction: 'ltr', textAlign: 'right', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{toPersianDate(tx.date)}</td>
                  <td>
                    {tx.transaction_type === 'IN' ? (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        {tx.bill_of_lading ? `بارنامه: ${tx.bill_of_lading}` : '—'}
                      </span>
                    ) : (
                      <span style={{ fontWeight: 500 }}>{tx.contractor_detail?.full_name || 'نامشخص'}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Transaction Details Modal */}
      {selectedTx && createPortal(
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3 className="modal-title">جزئیات تراکنش</h3>
              <button className="modal-close" onClick={() => setSelectedTx(null)}>
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">نوع تراکنش</span>
                  <span className="modal-detail-value">
                    {selectedTx.transaction_type === 'IN' ? 'ورود به انبار' : 'خروج از انبار'}
                  </span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">نام متریال</span>
                  <span className="modal-detail-value">{selectedTx.material_detail?.name || '—'}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">رسته کاری</span>
                  <span className="modal-detail-value">{selectedTx.material_detail?.work_category_name || '—'}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">جنس</span>
                  <span className="modal-detail-value">{selectedTx.material_detail?.material_type || '—'}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">سایز</span>
                  <span className="modal-detail-value">{selectedTx.material_detail?.size || '—'}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">ضخامت</span>
                  <span className="modal-detail-value">{selectedTx.material_detail?.thickness || '—'}</span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">مقدار / تعداد</span>
                  <span className="modal-detail-value" style={{ color: 'var(--primary-500)', fontSize: '1.1rem' }}>
                    {formatPersianNumber(selectedTx.quantity)} {selectedTx.material_detail?.unit_display}
                  </span>
                </div>
                <div className="modal-detail-item">
                  <span className="modal-detail-label">تاریخ ثبت</span>
                  <span className="modal-detail-value" style={{ direction: 'ltr', textAlign: 'right' }}>
                    {toPersianDate(selectedTx.date)}
                  </span>
                </div>

                {selectedTx.transaction_type === 'IN' ? (
                  <>
                    <div className="modal-detail-item">
                      <span className="modal-detail-label">شماره بارنامه</span>
                      <span className="modal-detail-value">{selectedTx.bill_of_lading || '—'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="modal-detail-item">
                      <span className="modal-detail-label">پیمانکار تحویل‌گیرنده</span>
                      <span className="modal-detail-value">{selectedTx.contractor_detail?.full_name || '—'}</span>
                    </div>
                    <div className="modal-detail-item">
                      <span className="modal-detail-label">شماره قرارداد</span>
                      <span className="modal-detail-value">{selectedTx.contract_number || '—'}</span>
                    </div>
                    <div className="modal-detail-item">
                      <span className="modal-detail-label">موضوع قرارداد</span>
                      <span className="modal-detail-value">{selectedTx.contract_subject || '—'}</span>
                    </div>
                  </>
                )}

                {/* Scanned Document Preview & Download */}
                {(selectedTx.bill_of_lading_image || selectedTx.exit_document_image) && (
                  <div className="modal-detail-item" style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--border-color)', paddingTop: '1.2rem', marginTop: '0.5rem' }}>
                    <span className="modal-detail-label" style={{ fontSize: '0.95rem', color: 'var(--primary-500)', marginBottom: '0.8rem', fontWeight: 600 }}>
                      سند اسکن شده ({selectedTx.transaction_type === 'IN' ? 'عکس بارنامه' : 'برگه خروج'})
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center' }}>
                      <div className="scan-thumb-wrap" style={{ maxWidth: '380px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: '#1e1e2e' }}>
                        <img 
                          src={selectedTx.transaction_type === 'IN' ? selectedTx.bill_of_lading_image : selectedTx.exit_document_image} 
                          alt="document scan" 
                          style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block' }} 
                        />
                      </div>
                      <a 
                        href={selectedTx.transaction_type === 'IN' ? selectedTx.bill_of_lading_image : selectedTx.exit_document_image} 
                        download={`scan-${selectedTx.transaction_type === 'IN' ? 'lading' : 'exit'}-${selectedTx.id}.jpg`}
                        className="btn btn-excel" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 1rem', fontSize: '0.82rem', borderRadius: 'var(--radius-md)', textDecoration: 'none' }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>دانلود سند اسکن شده</span>
                      </a>
                    </div>
                  </div>
                )}

                {selectedTx.remarks && (
                  <div className="modal-detail-item" style={{ gridColumn: '1 / -1' }}>
                    <span className="modal-detail-label">توضیحات تکمیلی</span>
                    <span className="modal-detail-value" style={{ fontWeight: 400, lineHeight: 1.6 }}>{selectedTx.remarks}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TransactionList;
