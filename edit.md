# امن‌سازی و ضدگلوله کردن پروژه جهان‌پارس (Jahan Pars)

هدف از این طرح، ارتقای معماری پروژه، رفع باگ‌های بحرانی و جلوگیری از خطاهای احتمالی ناشی از هم‌زمانی و دسترسی‌های غیرمجاز است. این تغییرات بر اساس بررسی‌های انجام شده و پاسخ‌های شما در جلسه‌ی پرسش‌وپاسخ تدوین شده است.

## User Review Required
> [!WARNING]
> **مهاجرت به PostgreSQL:** با تغییر دیتابیس از SQLite به PostgreSQL، داده‌های موجود در فایل `db.sqlite3` به دیتابیس جدید منتقل **نمی‌شوند** مگر اینکه یک اسکریپت انتقال داده بنویسیم. با توجه به اینکه در فاز توسعه هستیم، فرض بر این است که ایجاد دیتابیس تمیز (Fresh DB) مشکلی ندارد. لطفاً در صورت نیاز به حفظ داده‌های تستی فعلی اطلاع دهید.

> [!IMPORTANT]
> **سیستم احراز هویت (JWT):** پس از پیاده‌سازی این بخش، فرانت‌اند باید آپدیت شود تا توکن‌های JWT را در هدر درخواست‌ها (`Authorization: Bearer <token>`) ارسال کند. آیا آمادگی دارید تا کدهای فرانت‌اند (فایل `api.js`) نیز در همین مرحله ویرایش شود؟

## Proposed Changes

---

### Database & Environment

#### [NEW] [docker-compose.yml](file:///e:/Codes/Jahan%20pars/docker-compose.yml)
- ایجاد فایل Docker Compose برای راه‌اندازی سریع دیتابیس PostgreSQL جهت توسعه محلی.

#### [MODIFY] [settings.py](file:///e:/Codes/Jahan%20pars/jahanpars/settings.py)
- تغییر تنظیمات `DATABASES` به PostgreSQL.
- نصب و تنظیم `rest_framework_simplejwt`.
- تنظیم JWT به عنوان کلاس احراز هویت پیش‌فرض DRF.

---

### Security & Roles

#### [NEW] [permissions.py](file:///e:/Codes/Jahan%20pars/balance/permissions.py)
- ایجاد کلاس‌های سفارشی دسترسی (Custom Permissions) برای تفکیک نقش‌های `Manager` (دفتر فنی - دسترسی کامل) و `Operator` (انباردار - فقط ثبت تراکنش). این نقش‌ها بر اساس گروه‌های پیش‌فرض جنگو پیاده‌سازی می‌شوند.

#### [MODIFY] [urls.py](file:///e:/Codes/Jahan%20pars/jahanpars/urls.py)
- افزودن اندپوینت‌های دریافت و رفرش توکن (`api/token/` و `api/token/refresh/`).

#### [MODIFY] [views.py](file:///e:/Codes/Jahan%20pars/balance/views.py)
- اعمال کلاس‌های Permission روی تمام ViewSetها.
- محدود کردن دسترسی دانلود گزارش‌های اکسل و PDF فقط برای مدیران.

---

### Concurrency & Data Integrity

#### [MODIFY] [views.py](file:///e:/Codes/Jahan%20pars/balance/views.py)
- افزودن دکوراتور `@transaction.atomic` به توابع حساس از جمله ایجاد تراکنش انبار و ثبت پیمانکار برای جلوگیری از تداخل در درخواست‌های همزمان (Concurrency).

---

### Bug Fixes

#### [MODIFY] [services.py](file:///e:/Codes/Jahan%20pars/balance/services.py)
- **رفع باگ بحرانی:** حذف فیلدهای ناموجود `subject` و `letter_number` از تابع `generate_approvals_list_excel` تا سرور هنگام دریافت خروجی اکسل کراش نکند.

#### [MODIFY] [pdf_service.py](file:///e:/Codes/Jahan%20pars/balance/pdf_service.py)
- **رفع باگ تاریخ:** تبدیل تاریخ‌های ورودی `from_date` و `to_date` (که میلادی هستند) به تاریخ شمسی (`jdatetime`) قبل از چاپ در هدر گزارش PDF.

## Verification Plan

### Automated Tests
- اجرای تست‌های واحدِ بک‌اند با دستور `python manage.py test` پس از اعمال تغییرات برای اطمینان از صحت عملکرد منطق موازنه روی PostgreSQL.

### Manual Verification
- اجرای دیتابیس با `docker-compose up -d`.
- لاگین کردن از طریق فرانت‌اند، دریافت توکن JWT و تست فراخوانی API.
- بررسی محدودیت‌های دسترسی با کاربر انباردار.
- تست دانلود فایل اکسل و PDF و اطمینان از ثبت صحیح تاریخ‌های شمسی و عدم کراش سرور.
