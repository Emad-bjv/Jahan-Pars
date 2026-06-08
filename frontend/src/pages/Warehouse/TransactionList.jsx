import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { SkeletonTable } from '../../components/Skeleton';
import { formatPersianNumber, toPersianDate } from '../../utils/persianNumbers';

const TransactionList = ({ refreshTrigger }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTx, setSelectedTx] = useState(null);

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

  return (
    <div className="section-panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="table-container">
        <table className="table">
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
            {transactions.length === 0 ? (
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
              transactions.map((tx) => (
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
                  <td style={{ fontWeight: 600 }}>{tx.material_detail?.name}</td>
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
