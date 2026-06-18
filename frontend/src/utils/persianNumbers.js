/**
 * persianNumbers.js - ابزارهای تبدیل و نمایش اعداد فارسی
 * ─────────────────────────────────────────────────────────
 */

/**
 * تبدیل اعداد به لاتین (انگلیسی)
 * @param {string|number} input
 * @returns {string}
 */
export const toPersianDigits = (input) => {
  if (input == null) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
};

/**
 * فرمت عدد با جداکننده هزارگان و ارقام انگلیسی
 * @param {number} num
 * @param {number} decimals - تعداد رقم اعشار (پیش‌فرض: 0)
 * @returns {string}
 */
export const formatPersianNumber = (num, decimals = 0) => {
  if (num == null || isNaN(num)) return '0';
  const formatted = Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return toPersianDigits(formatted);
};

/**
 * تبدیل تاریخ YYYY-MM-DD به فرمت فارسی با اعداد انگلیسی
 * @param {string} dateStr - تاریخ در فرمت YYYY-MM-DD (شمسی یا میلادی)
 * @returns {string}
 */
export const toPersianDate = (dateStr) => {
  if (!dateStr) return '—';
  return toPersianDigits(dateStr);
};

