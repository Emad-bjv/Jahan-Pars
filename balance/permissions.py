"""
permissions.py - کلاس‌های دسترسی سفارشی برای سیستم بالانس متریال جهانپارس
===========================================================================
این فایل لایه امنیتی سیستم را بر اساس نقش کاربری (Role-Based Access Control)
با استفاده از Django REST Framework پیاده‌سازی می‌کند.

نقش‌های موجود در سیستم:
    TECHNICAL   → دفتر فنی
    WAREHOUSE   → انباردار
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS


# ─────────────────────────────────────────────────────────────────────────────
# کلاس پایه مشترک: بررسی احراز هویت
# ─────────────────────────────────────────────────────────────────────────────
class _IsAuthenticatedWithRole(BasePermission):
    """
    کلاس پایه داخلی: مطمئن می‌شود کاربر لاگین کرده، فعال است
    و فیلد role دارد. سایر کلاس‌ها از این ارث می‌برند.
    """
    required_role: str = ""  # زیرکلاس باید این را تنظیم کند
    required_group: str = "" # زیرکلاس باید این را تنظیم کند

    def has_permission(self, request, view):
        # کاربر باید لاگین کرده و فعال باشد
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_active:
            return False
        # سوپریوزر دسترسی کامل دارد
        if request.user.is_superuser:
            return True
            
        # بررسی نقش و گروه
        has_role = getattr(request.user, 'role', None) == self.required_role
        has_group = request.user.groups.filter(name=self.required_group).exists() if self.required_group else False
        
        return has_role or has_group


# ─────────────────────────────────────────────────────────────────────────────
# ۱. دفتر فنی (Technical Office)
# ─────────────────────────────────────────────────────────────────────────────
class IsTechnicalOffice(_IsAuthenticatedWithRole):
    """
    دسترسی کامل (CRUD) فقط برای کاربران با نقش 'دفتر فنی' (TECHNICAL).

    موارد مجاز:
        ✔ ثبت، ویرایش و مشاهده تاییدیه‌های عملکرد (TechnicalOfficeApproval)
        ✔ تعریف و مدیریت رسته‌های کاری (WorkCategory)
        ✔ تعریف و ویرایش کالاها (MaterialItem)
        ✔ مدیریت پیمانکاران (Contractor)
        ✔ مشاهده کلیه تراکنش‌های انبار (فقط خواندن)
        ✔ دریافت گزارش بالانس متریال

    موارد غیرمجاز:
        ✘ ثبت تراکنش انبار (وظیفه انباردار است)
    """
    message = "دسترسی محدود به اعضای دفتر فنی است."
    required_role = "TECHNICAL"
    required_group = "TECHNICAL_GROUP"


# ─────────────────────────────────────────────────────────────────────────────
# ۲. انباردار (Warehouse Keeper)
# ─────────────────────────────────────────────────────────────────────────────
class IsWarehouseKeeper(_IsAuthenticatedWithRole):
    """
    دسترسی فقط برای کاربران با نقش 'انباردار' (WAREHOUSE).

    موارد مجاز:
        ✔ ثبت تراکنش ورود و خروج انبار (WarehouseTransaction)
        ✔ مشاهده لیست متریال‌ها و کالاها (فقط خواندن)
        ✔ مشاهده رسته‌های کاری و پیمانکاران (فقط خواندن)

    موارد غیرمجاز:
        ✘ مشاهده یا ویرایش تاییدیه‌های دفتر فنی (TechnicalOfficeApproval)
        ✘ تعریف رسته کاری، پیمانکار یا ویرایش متریال
    """
    message = "دسترسی محدود به انباردار است."
    required_role = "WAREHOUSE"
    required_group = "WAREHOUSE_GROUP"

    def has_object_permission(self, request, view, obj):
        """
        انباردار به هیچ‌وجه نباید به آبجکت‌های TechnicalOfficeApproval دسترسی داشته باشد.
        این بررسی در سطح آبجکت انجام می‌شود تا از دسترسی از طریق URL مستقیم هم جلوگیری شود.
        """
        from .models import TechnicalOfficeApproval
        if isinstance(obj, TechnicalOfficeApproval):
            return False  # انباردار به تاییدیه‌ها دسترسی ندارد
        return True


# ─────────────────────────────────────────────────────────────────────────────
# کلاس ترکیبی: دفتر فنی یا انباردار (برای endpoint های مشترک)
# ─────────────────────────────────────────────────────────────────────────────
class IsTechnicalOfficeOrWarehouse(BasePermission):
    """
    دسترسی به کاربرانی که یا دفتر فنی هستند یا انباردار.

    کاربرد: endpoint هایی مثل لیست متریال‌ها که هر دو نقش باید ببینند،
    اما با سطح دسترسی متفاوت (دفتر فنی: خواندن/نوشتن، انباردار: فقط خواندن).
    """
    message = "دسترسی فقط برای دفتر فنی و انباردار مجاز است."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_active:
            return False
        if request.user.is_superuser:
            return True

        role = getattr(request.user, 'role', None)
        is_technical = role == 'TECHNICAL' or request.user.groups.filter(name='TECHNICAL_GROUP').exists()
        is_warehouse = role == 'WAREHOUSE' or request.user.groups.filter(name='WAREHOUSE_GROUP').exists()

        # دفتر فنی: دسترسی کامل
        if is_technical:
            return True

        # انباردار: فقط خواندن
        if is_warehouse:
            return request.method in SAFE_METHODS

        return False


# ─────────────────────────────────────────────────────────────────────────────
# کلاس کمکی: فقط دفتر فنی یا سوپریوزر می‌توانند گزارش بالانس بگیرند
# ─────────────────────────────────────────────────────────────────────────────
class CanDownloadBalanceReport(BasePermission):
    """
    دسترسی دانلود گزارش بالانس متریال.
    فقط دفتر فنی (TECHNICAL) و سوپریوزر مجاز هستند.

    کاربرد در view:
        permission_classes = [IsAuthenticated, CanDownloadBalanceReport]
    """
    message = "دانلود گزارش بالانس فقط برای دفتر فنی مجاز است."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) == 'TECHNICAL' or request.user.groups.filter(name='TECHNICAL_GROUP').exists()


# ─────────────────────────────────────────────────────────────────────────────
# کلاس جدید: دسترسی دانلود لیست انبار برای انباردار
# ─────────────────────────────────────────────────────────────────────────────
class CanDownloadWarehouseReport(BasePermission):
    """
    دسترسی دانلود لیست تراکنش‌های انبار.
    فقط انباردار (WAREHOUSE) و سوپریوزر مجاز هستند.
    """
    message = "دانلود گزارش انبار فقط برای انباردار مجاز است."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return getattr(request.user, 'role', None) == 'WAREHOUSE' or request.user.groups.filter(name='WAREHOUSE_GROUP').exists()


# ─────────────────────────────────────────────────────────────────────────────
# کلاس جدید: دفتر فنی فقط خواندن، سوپریوزر خواندن و نوشتن
# ─────────────────────────────────────────────────────────────────────────────
class IsTechnicalReadOnlyOrAdmin(BasePermission):
    """
    دسترسی تغییرات فقط برای سوپریوزر/ادمین.
    کاربران با نقش 'TECHNICAL' (دفتر فنی) فقط دسترسی خواندن (SAFE_METHODS) دارند.
    """
    message = "ثبت یا تغییر این اطلاعات فقط توسط مدیر سیستم (Superuser) مجاز است."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if not request.user.is_active:
            return False
            
        # سوپریوزر دسترسی کامل دارد
        if request.user.is_superuser:
            return True
            
        role = getattr(request.user, 'role', None)
        is_technical = role == 'TECHNICAL' or request.user.groups.filter(name='TECHNICAL_GROUP').exists()
        
        # دفتر فنی: فقط خواندن مجاز است
        if is_technical:
            return request.method in SAFE_METHODS
            
        return False

