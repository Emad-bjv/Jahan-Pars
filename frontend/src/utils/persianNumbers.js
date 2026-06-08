/**
 * persianNumbers.js - ابزارهای تبدیل و نمایش اعداد فارسی
 * ─────────────────────────────────────────────────────────
 */

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * تبدیل اعداد لاتین به فارسی
 * @param {string|number} input
 * @returns {string}
 */
export const toPersianDigits = (input) => {
  if (input == null) return '';
  return String(input).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
};

/**
 * فرمت عدد با جداکننده هزارگان و ارقام فارسی
 * @param {number} num
 * @param {number} decimals - تعداد رقم اعشار (پیش‌فرض: 0)
 * @returns {string}
 */
export const formatPersianNumber = (num, decimals = 0) => {
  if (num == null || isNaN(num)) return '۰';
  const formatted = Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return toPersianDigits(formatted);
};

/**
 * تبدیل تاریخ YYYY-MM-DD به فرمت فارسی با اعداد فارسی
 * @param {string} dateStr - تاریخ در فرمت YYYY-MM-DD (شمسی یا میلادی)
 * @returns {string}
 */
export const toPersianDate = (dateStr) => {
  if (!dateStr) return '—';
  return toPersianDigits(dateStr);
};
