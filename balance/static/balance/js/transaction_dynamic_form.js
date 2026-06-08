/**
 * transaction_dynamic_form.js
 * ===========================
 * کنترل پویای فرم تراکنش انبار در پنل مدیریت جنگو.
 *
 * عملکرد:
 *   - هنگام انتخاب "ورود متریال به انبار" (IN):
 *       فیلدهای بارنامه نمایش داده می‌شوند
 *       فیلدهای پیمانکار و قرارداد مخفی می‌شوند
 *
 *   - هنگام انتخاب "خروج متریال به پیمانکار" (OUT):
 *       فیلدهای پیمانکار و قرارداد نمایش داده می‌شوند
 *       فیلد بارنامه مخفی می‌شود
 */
(function () {
    'use strict';

    // شناسه فیلدهای مربوطه در فرم ادمین جنگو
    const FIELD_IDS = {
        type: 'id_transaction_type',
        // فیلدهای ورود
        bill_of_lading: '.field-bill_of_lading',
        // فیلدهای خروج (پیمانکار)
        contractor_first_name: '.field-contractor_first_name',
        contractor_last_name: '.field-contractor_last_name',
        contract_number: '.field-contract_number',
        contract_subject: '.field-contract_subject',
    };

    const IN_FIELDS = [FIELD_IDS.bill_of_lading];
    const OUT_FIELDS = [
        FIELD_IDS.contractor_first_name,
        FIELD_IDS.contractor_last_name,
        FIELD_IDS.contract_number,
        FIELD_IDS.contract_subject,
    ];

    function setVisibility(selectors, visible) {
        selectors.forEach(function (selector) {
            var el = document.querySelector(selector);
            if (el) {
                el.style.display = visible ? '' : 'none';
            }
        });
    }

    function updateFields() {
        var typeSelect = document.getElementById(FIELD_IDS.type);
        if (!typeSelect) return;

        var value = typeSelect.value;

        if (value === 'IN') {
            setVisibility(IN_FIELDS, true);
            setVisibility(OUT_FIELDS, false);
        } else if (value === 'OUT') {
            setVisibility(IN_FIELDS, false);
            setVisibility(OUT_FIELDS, true);
        } else {
            // هنوز انتخاب نشده - همه مخفی
            setVisibility(IN_FIELDS, false);
            setVisibility(OUT_FIELDS, false);
        }
    }

    function init() {
        var typeSelect = document.getElementById(FIELD_IDS.type);
        if (!typeSelect) return;

        // اجرا در لحظه بارگذاری صفحه (برای حالت ویرایش)
        updateFields();

        // اجرا هنگام تغییر انتخاب
        typeSelect.addEventListener('change', updateFields);
    }

    // اجرا پس از بارگذاری کامل DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
