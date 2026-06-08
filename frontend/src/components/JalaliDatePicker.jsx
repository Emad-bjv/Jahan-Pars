import React, { useState, useEffect, useRef } from 'react';
import { g2j, j2g, jDaysInMonth } from '../utils/jalaali';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const pad = (n) => n.toString().padStart(2, '0');

const JalaliDatePicker = ({ value, onChange, name, placeholder = 'انتخاب تاریخ...', required = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentJalali, setCurrentJalali] = useState({ jy: 1403, jm: 1, jd: 1 });
  const [displayValue, setDisplayValue] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (value) {
      const [gy, gm, gd] = value.split('-').map(Number);
      if (gy && gm && gd) {
        const j = g2j(gy, gm, gd);
        setCurrentJalali(j);
        setDisplayValue(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`);
      }
    } else {
      const today = new Date();
      const j = g2j(today.getFullYear(), today.getMonth() + 1, today.getDate());
      setCurrentJalali(j);
      setDisplayValue('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectDate = (d) => {
    const g = j2g(currentJalali.jy, currentJalali.jm, d);
    const gDateString = `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
    if (onChange) {
      onChange({ target: { name, value: gDateString } });
    }
    setIsOpen(false);
  };

  const handleMonthChange = (step) => {
    let { jy, jm } = currentJalali;
    jm += step;
    if (jm > 12) {
      jm = 1;
      jy++;
    } else if (jm < 1) {
      jm = 12;
      jy--;
    }
    setCurrentJalali({ ...currentJalali, jy, jm });
  };

  const daysInMonth = jDaysInMonth(currentJalali.jy, currentJalali.jm);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getStartPadding = () => {
    try {
      const g = j2g(currentJalali.jy, currentJalali.jm, 1);
      const dateObj = new Date(g.gy, g.gm - 1, g.gd);
      // (JS Day [0: Sun, 1: Mon, ... 6: Sat] + 1) % 7 -> [0: Sat, 1: Sun, ... 6: Fri]
      return (dateObj.getDay() + 1) % 7;
    } catch (e) {
      return 0;
    }
  };

  const paddingSize = getStartPadding();
  const paddingArray = Array.from({ length: paddingSize }, (_, i) => i);
  const years = Array.from({ length: 16 }, (_, i) => 1405 + i); // range from 1405 to 1420

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        className="form-control"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        onClick={() => setIsOpen(true)}
        required={required}
        style={{ cursor: 'pointer', direction: 'ltr', textAlign: 'right' }}
      />
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 'auto', left: 0, marginTop: '5px',
          width: '290px', backgroundColor: 'var(--bg-surface-solid)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
          boxShadow: 'var(--shadow-lg)', zIndex: 9999, padding: '1rem'
        }}>
          {/* Header with Navigation & Select Dropdowns */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
            <button 
              type="button" 
              onClick={() => handleMonthChange(-1)} 
              style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-main)', padding: '0 4px' }}
            >
              ▶
            </button>
            
            <div style={{ display: 'flex', gap: '4px', flexGrow: 1, justifyContent: 'center' }}>
              {/* Select Month */}
              <select
                value={currentJalali.jm}
                onChange={(e) => setCurrentJalali({ ...currentJalali, jm: Number(e.target.value) })}
                style={{
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'Vazirmatn, sans-serif'
                }}
              >
                {MONTHS.map((m, index) => (
                  <option key={m} value={index + 1} style={{ backgroundColor: 'var(--bg-surface-solid)', color: 'var(--text-main)' }}>
                    {m}
                  </option>
                ))}
              </select>

              {/* Select Year */}
              <select
                value={currentJalali.jy}
                onChange={(e) => setCurrentJalali({ ...currentJalali, jy: Number(e.target.value) })}
                style={{
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  outline: 'none',
                  fontFamily: 'Vazirmatn, sans-serif'
                }}
              >
                {years.map(year => (
                  <option key={year} value={year} style={{ backgroundColor: 'var(--bg-surface-solid)', color: 'var(--text-main)' }}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <button 
              type="button" 
              onClick={() => handleMonthChange(1)} 
              style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: '1.2rem', color: 'var(--text-main)', padding: '0 4px' }}
            >
              ◀
            </button>
          </div>

          {/* Weekdays Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px' }}>
            {WEEKDAYS.map(w => (
              <div key={w} style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px', textAlign: 'center' }}>
            {paddingArray.map(p => (
              <div key={`pad-${p}`} />
            ))}
            {daysArray.map(d => {
              const isSelected = currentJalali.jd === d && displayValue;
              return (
                <div 
                  key={d} 
                  onClick={() => handleSelectDate(d)}
                  style={{ 
                    padding: '5px', borderRadius: '4px', cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-main)',
                    fontSize: '0.85rem'
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.15)';
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {d}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default JalaliDatePicker;
