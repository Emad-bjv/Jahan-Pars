from django.db import models, transaction
from django.db.models import Sum
from django.core.exceptions import ValidationError
from django.contrib.auth.models import AbstractUser
from django_jalali.db import models as jmodels
from .utils import normalize_persian_text


class User(AbstractUser):
    """
    جدول کاربران سیستم
    فقط شامل نقش‌های: دفتر فنی و انباردار
    (پیمانکاران کاربر سیستم نیستند و در جدول جداگانه مدیریت می‌شوند)
    """
    ROLE_CHOICES = (
        ('TECHNICAL', 'دفتر فنی'),
        ('WAREHOUSE', 'انباردار'),
    )
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        verbose_name="نقش کاربری",
        blank=True,
        null=True,
        help_text="دفتر فنی = مهندسین و کارشناسان | انباردار = مسئول انبار کارگاه",
    )

    class Meta:
        verbose_name = "کاربر"
        verbose_name_plural = "کاربران"

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    def save(self, *args, **kwargs):
        # هنگام ایجاد کاربر جدید، در صورت داشتن نقش، وضعیت کارمندی به طور خودکار فعال می‌شود
        if not self.pk and self.role in dict(self.ROLE_CHOICES).keys() and not self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)

    def has_module_perms(self, app_label):
        if self.is_superuser:
            return True
        if self.is_staff and self.role and app_label == 'balance':
            return True
        return super().has_module_perms(app_label)

    def has_perm(self, perm, obj=None):
        if self.is_superuser:
            return True
        
        # در صورتی که پرمیشن سنتی (گروه) داشته باشد
        if super().has_perm(perm, obj):
            return True

        if not self.is_staff or not self.role:
            return False

        # ─── مجوزهای دفتر فنی ───
        if self.role == 'TECHNICAL':
            # تاییدیه عملکرد: دسترسی کامل
            if perm.endswith('_technicalofficeapproval'):
                return True
            
            # سایر بخش‌ها (پیمانکار، رسته، متریال، تراکنش انبار): فقط خواندن
            allowed_view_only = [
                'balance.view_contractor',
                'balance.view_workcategory',
                'balance.view_materialitem',
                'balance.view_warehousetransaction'
            ]
            if perm in allowed_view_only:
                return True

        # ─── مجوزهای انباردار ───
        elif self.role == 'WAREHOUSE':
            # تراکنش انبار: دسترسی کامل
            if perm.endswith('_warehousetransaction'):
                return True
            
            # پیمانکار، رسته، کالا: فقط خواندن
            if perm in ['balance.view_contractor', 'balance.view_materialitem', 'balance.view_workcategory']:
                return True

        return False


class Contractor(models.Model):
    """
    جدول پیمانکاران
    فقط شامل نام و نام خانوادگی. این رکوردها به صورت خودکار
    هنگام ثبت تراکنش خروج از انبار ساخته می‌شوند.
    """
    first_name = models.CharField(max_length=100, verbose_name="نام پیمانکار")
    last_name = models.CharField(max_length=100, verbose_name="نام خانوادگی پیمانکار")

    class Meta:
        verbose_name = "پیمانکار"
        verbose_name_plural = "پیمانکاران"
        unique_together = ('first_name', 'last_name')

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"


class WorkCategory(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="رسته کاری")
    description = models.TextField(blank=True, null=True, verbose_name="توضیحات")

    class Meta:
        verbose_name = "رسته کاری"
        verbose_name_plural = "رسته های کاری"

    def __str__(self):
        return self.name


class MaterialItem(models.Model):
    UNIT_CHOICES = (
        ('KG', 'کیلوگرم'),
        ('M', 'متر'),
        ('SQM', 'متر مربع'),
        ('PCS', 'عدد'),
    )
    name = models.CharField(max_length=255, verbose_name="نام کالا")
    work_category = models.ForeignKey(WorkCategory, on_delete=models.SET_NULL, null=True, related_name='materials', verbose_name="رسته کاری")
    size = models.CharField(max_length=100, blank=True, null=True, verbose_name="سایز")
    material_type = models.CharField(max_length=100, blank=True, null=True, verbose_name="جنس متریال")
    thickness = models.CharField(max_length=100, blank=True, null=True, verbose_name="ضخامت")
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, verbose_name="واحد اندازه گیری")
    waste_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name="درصد پرتی مجاز")
    low_stock_threshold = models.DecimalField(
        max_digits=12, decimal_places=2, default=0,
        verbose_name="آستانه موجودی بحرانی",
        help_text="اگر موجودی انبار از این مقدار کمتر شود، هشدار صادر می‌شود. مقدار ۰ = غیرفعال."
    )

    class Meta:
        verbose_name = "کالا / متریال"
        verbose_name_plural = "کالاها / متریال ها"

    def __str__(self):
        parts = [self.name]
        if self.size:
            parts.append(self.size)
        if self.material_type:
            parts.append(self.material_type)
        return " - ".join(parts)


class WarehouseTransaction(models.Model):
    TRANSACTION_TYPE_CHOICES = (
        ('IN', 'ورود متریال به انبار'),
        ('OUT', 'خروج متریال به پیمانکار'),
    )
    transaction_type = models.CharField(max_length=3, choices=TRANSACTION_TYPE_CHOICES, verbose_name="نوع تراکنش", db_index=True)
    material = models.ForeignKey(MaterialItem, on_delete=models.PROTECT, related_name='transactions', verbose_name="متریال")
    quantity = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="مقدار")

    bill_of_lading = models.CharField(
        max_length=100, blank=True, null=True, verbose_name="شماره بارنامه",
        help_text="شماره بارنامه حمل متریال (فقط برای تراکنش ورود)."
    )

    contractor_first_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="نام پیمانکار")
    contractor_last_name = models.CharField(max_length=100, blank=True, null=True, verbose_name="نام خانوادگی پیمانکار")
    contract_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="شماره قرارداد")
    contract_subject = models.CharField(max_length=255, blank=True, null=True, verbose_name="موضوع قرارداد")

    contractor = models.ForeignKey(
        'Contractor', on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name="پیمانکار (خودکار)", editable=False,
    )

    date = jmodels.jDateField(verbose_name="تاریخ", db_index=True)
    created_at = jmodels.jDateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت در سیستم")

    objects = jmodels.jManager()

    class Meta:
        verbose_name = "تراکنش انبار"
        verbose_name_plural = "تراکنش های انبار"
        indexes = [
            models.Index(fields=['contractor', 'material']),
            models.Index(fields=['transaction_type', 'date']),
        ]

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.material.name} - {self.quantity}"

    def clean(self):
        super().clean()
        if self.transaction_type == 'OUT':
            total_in = WarehouseTransaction.objects.filter(
                material=self.material, transaction_type='IN'
            ).aggregate(t=Sum('quantity'))['t'] or 0
            
            qs_out = WarehouseTransaction.objects.filter(
                material=self.material, transaction_type='OUT'
            )
            if self.pk:
                qs_out = qs_out.exclude(pk=self.pk)
            total_out = qs_out.aggregate(t=Sum('quantity'))['t'] or 0
            
            current_stock = total_in - total_out
            if self.quantity > current_stock:
                raise ValidationError({
                    'quantity': f'موجودی کافی نیست! موجودی فعلی انبار: {current_stock}'
                })

    def save(self, *args, **kwargs):
        if self.contractor_first_name:
            self.contractor_first_name = normalize_persian_text(self.contractor_first_name)
        if self.contractor_last_name:
            self.contractor_last_name = normalize_persian_text(self.contractor_last_name)
        if self.contract_subject:
            self.contract_subject = normalize_persian_text(self.contract_subject)

        if self.transaction_type == 'OUT' and self.contractor_first_name and self.contractor_last_name:
            with transaction.atomic():
                contractor_obj, _ = Contractor.objects.get_or_create(
                    first_name=self.contractor_first_name,
                    last_name=self.contractor_last_name,
                )
                self.contractor = contractor_obj
        elif self.transaction_type == 'IN':
            self.contractor = None
            self.contractor_first_name = None
            self.contractor_last_name = None
            self.contract_number = None
            self.contract_subject = None
        super().save(*args, **kwargs)


class TechnicalOfficeApproval(models.Model):
    contractor = models.ForeignKey('Contractor', on_delete=models.PROTECT, related_name='approvals', verbose_name="پیمانکار")
    material = models.ForeignKey(MaterialItem, on_delete=models.PROTECT, related_name='approvals', verbose_name="نوع متریال")
    approved_quantity = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="مقدار کار تایید شده")
    contract_number = models.CharField(max_length=100, blank=True, null=True, verbose_name="شماره قرارداد")
    contract_subject = models.CharField(max_length=255, blank=True, null=True, verbose_name="موضوع قرارداد")
    approval_date = jmodels.jDateField(verbose_name="تاریخ تایید", db_index=True)
    created_at = jmodels.jDateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت در سیستم")

    objects = jmodels.jManager()

    class Meta:
        verbose_name = "تاییدیه عملکرد دفتر فنی"
        verbose_name_plural = "تاییدیه‌های عملکرد دفتر فنی"
        indexes = [
            models.Index(fields=['contractor', 'material']),
        ]

    def __str__(self):
        return f"تایید {self.approved_quantity} {self.material.get_unit_display()} از {self.material.name} برای {self.contractor}"


class AuditLog(models.Model):
    """
    جدول لاگ تغییرات سیستم (Audit Trail)
    ثبت تمام عملیات‌های ایجاد، ویرایش و حذف روی مدل‌های اصلی سیستم.
    """
    ACTION_CHOICES = (
        ('CREATE', 'ایجاد'),
        ('UPDATE', 'ویرایش'),
        ('DELETE', 'حذف'),
    )
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audit_logs', verbose_name="کاربر"
    )
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, verbose_name="نوع عملیات", db_index=True)
    model_name = models.CharField(max_length=100, verbose_name="نام مدل", db_index=True)
    object_id = models.PositiveIntegerField(verbose_name="شناسه رکورد", null=True, blank=True)
    object_repr = models.CharField(max_length=300, verbose_name="شرح رکورد", blank=True)
    changes = models.JSONField(default=dict, blank=True, verbose_name="جزئیات تغییرات")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="آدرس IP")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="زمان", db_index=True)

    class Meta:
        verbose_name = "لاگ تغییرات"
        verbose_name_plural = "لاگ‌های تغییرات"
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp', 'model_name']),
            models.Index(fields=['user', '-timestamp']),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else "سیستم"
        return f"{user_str} → {self.get_action_display()} {self.model_name} ({self.object_repr})"
