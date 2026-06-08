import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import JalaliDatePicker from '../../components/JalaliDatePicker';
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
  plus: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 4v16m8-8H4"/>
    </svg>
  ),
  arrowDown: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/>
    </svg>
  ),
  arrowUp: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
    </svg>
  ),
};

const TransactionForm = ({ onSuccess }) => {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liveInventory, setLiveInventory] = useState(null);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    transaction_type: 'OUT',
    material: '',
    quantity: '',
    date: new Date().toISOString().split('T')[0],
    bill_of_lading: '',
    contractor_first_name: '',
    contractor_last_name: '',
    contract_number: '',
    contract_subject: '',
    // Fields for Inbound Material Creation
    mat_name: '',
    mat_work_category: '',
    mat_size: '',
    mat_material_type: '',
    mat_thickness: '',
    mat_unit: 'KG',
    mat_waste_percentage: '0.00'
  });

  // Outbound Cascading Dropdowns State
  const [outForm, setOutForm] = useState({
    name: null,
    material_type: null,
    size: null,
    thickness: null
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [matRes, catRes] = await Promise.all([
          api.get('materials/'),
          api.get('categories/')
        ]);
        setMaterials(matRes.data.results || matRes.data);
        setCategories(catRes.data.results || catRes.data);
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };
    fetchData();
  }, [formData.transaction_type]);

  // Compute cascading options
  const availableNames = [...new Set(materials.map(m => m.name).filter(Boolean))];
  const level1 = materials.filter(m => m.name === outForm.name);
  const availableTypes = outForm.name !== null ? [...new Set(level1.map(m => m.material_type || ''))] : [];
  const level2 = level1.filter(m => (m.material_type || '') === (outForm.material_type || ''));
  const availableSizes = outForm.material_type !== null ? [...new Set(level2.map(m => m.size || ''))] : [];
  const level3 = level2.filter(m => (m.size || '') === (outForm.size || ''));
  const availableThicknesses = outForm.size !== null ? [...new Set(level3.map(m => m.thickness || ''))] : [];

  const resolvedMaterial = materials.find(m => 
    m.name === outForm.name && 
    (m.material_type || '') === (outForm.material_type || '') &&
    (m.size || '') === (outForm.size || '') &&
    (m.thickness || '') === (outForm.thickness || '')
  );

  useEffect(() => {
    if (formData.transaction_type === 'OUT') {
      if (resolvedMaterial) {
        setFormData(prev => ({ ...prev, material: resolvedMaterial.id }));
      } else {
        setFormData(prev => ({ ...prev, material: '' }));
      }
    }
  }, [resolvedMaterial, formData.transaction_type]);

  useEffect(() => {
    const fetchLiveInventory = async () => {
      if (formData.transaction_type === 'OUT' && formData.material) {
        try {
          const res = await api.get(`balance/material-inventory/?material_id=${formData.material}`);
          setLiveInventory(res.data.current_stock);
        } catch (err) {
          console.error("Error fetching live inventory", err);
          setLiveInventory(null);
        }
      } else {
        setLiveInventory(null);
      }
    };
    fetchLiveInventory();
  }, [formData.transaction_type, formData.material]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.transaction_type === 'OUT') {
      if (!formData.material) {
        showToast('لطفا تمام مشخصات متریال خروجی را انتخاب کنید.', 'error');
        return;
      }
      if (liveInventory !== null && parseFloat(formData.quantity) > parseFloat(liveInventory)) {
        showToast('مقدار خروجی نمی‌تواند از موجودی انبار بیشتر باشد.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      let materialIdToUse = formData.material;

      // If INBOUND, first create the material
      if (formData.transaction_type === 'IN') {
        const materialData = {
          name: formData.mat_name,
          work_category: formData.mat_work_category,
          size: formData.mat_size,
          material_type: formData.mat_material_type,
          thickness: formData.mat_thickness,
          unit: formData.mat_unit,
          waste_percentage: formData.mat_waste_percentage,
          low_stock_threshold: '0'
        };
        const matRes = await api.post('materials/', materialData);
        materialIdToUse = matRes.data.id;
      }

      // Submit transaction
      const transactionData = {
        transaction_type: formData.transaction_type,
        material: materialIdToUse,
        quantity: formData.quantity,
        date: formData.date,
        bill_of_lading: formData.bill_of_lading,
        contractor_first_name: formData.contractor_first_name,
        contractor_last_name: formData.contractor_last_name,
        contract_number: formData.contract_number,
        contract_subject: formData.contract_subject
      };

      await api.post('transactions/', transactionData);
      
      // Reset form but keep contractor details
      setFormData({
        ...formData,
        quantity: '',
        bill_of_lading: '',
        contract_number: '',
        contract_subject: '',
        material: '',
        mat_name: '',
        mat_work_category: '',
        mat_size: '',
        mat_material_type: '',
        mat_thickness: '',
        mat_waste_percentage: '0.00'
      });
      setOutForm({ name: null, material_type: null, size: null, thickness: null });
      if (onSuccess) onSuccess();
      showToast('تراکنش با موفقیت ثبت شد', 'success');
    } catch (err) {
      showToast(err.response?.data ? JSON.stringify(err.response.data) : 'خطا در ثبت اطلاعات.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isInbound = formData.transaction_type === 'IN';

  return (
    <div className="section-panel">
      {/* Form Header with Type Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div className="section-title" style={{ marginBottom: 0 }}>
          <div className="section-title-icon" style={{ 
            background: isInbound ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' 
          }}>
            {isInbound ? Icons.arrowDown : Icons.arrowUp}
          </div>
          ثبت تراکنش جدید
        </div>
        {/* Transaction Type Toggle */}
        <div style={{ 
          display: 'flex', 
          background: 'var(--bg-surface-solid)',
          borderRadius: 'var(--radius-full)',
          padding: '3px',
          border: '1px solid var(--border-color)',
        }}>
          <button
            type="button"
            onClick={() => {
              setFormData({...formData, transaction_type: 'OUT', material: ''});
              setOutForm({ name: null, material_type: null, size: null, thickness: null });
            }}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.25s',
              background: !isInbound ? 'var(--gradient-warm)' : 'transparent',
              color: !isInbound ? 'white' : 'var(--text-muted)',
              boxShadow: !isInbound ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none',
            }}
          >
            خروج متریال
          </button>
          <button
            type="button"
            onClick={() => setFormData({...formData, transaction_type: 'IN', material: ''})}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              transition: 'all 0.25s',
              background: isInbound ? 'var(--gradient-success)' : 'transparent',
              color: isInbound ? 'white' : 'var(--text-muted)',
              boxShadow: isInbound ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
            }}
          >
            ورود متریال
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2">

          {isInbound ? (
            <>
              {/* Order: 1-نوع متریال 2-جنس متریال 3-سایز 4-ضخامت 5-رسته کاری 6-واحد 7-درصد پرتی 8-شماره بارنامه 9-مقدار/تعداد 10-تاریخ */}
              <div className="form-group">
                <label className="form-label">نوع متریال <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="mat_name" className="form-control" placeholder="مثلا: لوله" value={formData.mat_name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">جنس متریال <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="mat_material_type" className="form-control" placeholder="مثلا: Carbon Steel" value={formData.mat_material_type} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">سایز <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="mat_size" className="form-control" placeholder="مثلا: 10 inch" value={formData.mat_size} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">ضخامت <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="mat_thickness" className="form-control" placeholder="مثلا: SCH40" value={formData.mat_thickness} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">رسته کاری <span style={{color: 'red'}}>*</span></label>
                <Select 
                  styles={selectStyles}
                  placeholder="انتخاب رسته کاری..."
                  isClearable
                  options={categories.map(c => ({ value: c.id, label: c.name }))}
                  value={formData.mat_work_category ? { value: formData.mat_work_category, label: categories.find(c => c.id === parseInt(formData.mat_work_category))?.name } : null}
                  onChange={selected => setFormData({...formData, mat_work_category: selected ? selected.value : ''})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">واحد اندازه‌گیری <span style={{color: 'red'}}>*</span></label>
                <select name="mat_unit" className="form-control" value={formData.mat_unit} onChange={handleChange} required>
                  <option value="KG">کیلوگرم (KG)</option>
                  <option value="M">متر (M)</option>
                  <option value="SQM">متر مربع (SQM)</option>
                  <option value="PCS">عدد (PCS)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">درصد پرتی (%) <span style={{color: 'red'}}>*</span></label>
                <input type="number" step="0.01" name="mat_waste_percentage" className="form-control" value={formData.mat_waste_percentage} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">شماره بارنامه <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="bill_of_lading" className="form-control" value={formData.bill_of_lading} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">مقدار / تعداد <span style={{color: 'red'}}>*</span></label>
                <input type="number" step="0.01" name="quantity" className="form-control" value={formData.quantity} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">تاریخ ثبت <span style={{color: 'red'}}>*</span></label>
                <JalaliDatePicker name="date" value={formData.date} onChange={handleChange} required />
              </div>
            </>
          ) : (
            <>
              {/* Outbound Fields */}
              <div className="form-group">
                <label className="form-label">تاریخ خروج</label>
                <JalaliDatePicker name="date" value={formData.date} onChange={handleChange} required />
              </div>
              
              <div className="form-group">
                <label className="form-label">نام پیمانکار <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="contractor_first_name" className="form-control" value={formData.contractor_first_name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">نام خانوادگی پیمانکار <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="contractor_last_name" className="form-control" value={formData.contractor_last_name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">شماره قرارداد <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="contract_number" className="form-control" value={formData.contract_number} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">موضوع قرارداد <span style={{color: 'red'}}>*</span></label>
                <input type="text" name="contract_subject" className="form-control" value={formData.contract_subject} onChange={handleChange} required />
              </div>

              {/* OUTBOUND MATERIAL CASCADING DROPDOWNS */}
              <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', paddingBottom: '0.5rem' }}>
                <label className="form-label" style={{ fontSize: '1rem', color: 'var(--primary-600)', marginBottom: 0 }}>مشخصات متریال خروجی</label>
              </div>

              <div className="form-group">
                <label className="form-label">نوع متریال <span style={{color: 'red'}}>*</span></label>
                <Select 
                  styles={selectStyles}
                  placeholder="-- انتخاب نوع --"
                  isClearable
                  options={availableNames.map(n => ({ value: n, label: n }))}
                  value={outForm.name ? { value: outForm.name, label: outForm.name } : null}
                  onChange={selected => setOutForm({name: selected ? selected.value : null, material_type: null, size: null, thickness: null})}
                />
              </div>

              {outForm.name !== null && (
                <div className="form-group">
                  <label className="form-label">جنس (Material Type) <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    placeholder="-- انتخاب جنس --"
                    isClearable
                    options={availableTypes.map(t => ({ value: t || '', label: t || 'بدون مشخصه جنس' }))}
                    value={outForm.material_type !== null ? { value: outForm.material_type || '', label: outForm.material_type || 'بدون مشخصه جنس' } : null}
                    onChange={selected => setOutForm({...outForm, material_type: selected ? selected.value : null, size: null, thickness: null})}
                  />
                </div>
              )}

              {outForm.material_type !== null && (
                <div className="form-group">
                  <label className="form-label">سایز <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    placeholder="-- انتخاب سایز --"
                    isClearable
                    options={availableSizes.map(s => ({ value: s || '', label: s || 'بدون سایز' }))}
                    value={outForm.size !== null ? { value: outForm.size || '', label: outForm.size || 'بدون سایز' } : null}
                    onChange={selected => setOutForm({...outForm, size: selected ? selected.value : null, thickness: null})}
                  />
                </div>
              )}

              {outForm.size !== null && (
                <div className="form-group">
                  <label className="form-label">ضخامت <span style={{color: 'red'}}>*</span></label>
                  <Select 
                    styles={selectStyles}
                    placeholder="-- انتخاب ضخامت --"
                    isClearable
                    options={availableThicknesses.map(t => ({ value: t || '', label: t || 'بدون ضخامت' }))}
                    value={outForm.thickness !== null ? { value: outForm.thickness || '', label: outForm.thickness || 'بدون ضخامت' } : null}
                    onChange={selected => setOutForm({...outForm, thickness: selected ? selected.value : null})}
                  />
                </div>
              )}

              {outForm.thickness !== null && (
                <div className="form-group">
                  <label className="form-label">مقدار / تعداد خروج <span style={{color: 'red'}}>*</span></label>
                  <input type="number" step="0.01" name="quantity" className="form-control" value={formData.quantity} onChange={handleChange} required />
                  {liveInventory !== null && formData.material && (
                    <div className="live-indicator live-success" style={{marginTop: '0.8rem'}}>
                      <span className="live-indicator-dot"></span>
                      موجودی فعلی انبار: {parseFloat(liveInventory).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

            </>
          )}

        </div>

        <div style={{ marginTop: '1rem' }}>
          <button 
            type="submit" 
            className={isInbound ? 'btn btn-accent' : 'btn btn-primary'} 
            disabled={loading} 
            style={{ width: '100%', padding: '0.9rem', fontSize: '1rem' }}
          >
            {loading ? 'در حال ثبت...' : (
              <>{Icons.plus} ثبت تراکنش</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransactionForm;
