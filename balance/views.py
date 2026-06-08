"""
views.py - ویوهای DRF برای سیستم بالانس متریال جهانپارس
=========================================================
"""

from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from django.db import transaction
from django.db.models import Count, Sum

from .models import (
    Contractor,
    WorkCategory,
    MaterialItem,
    WarehouseTransaction,
    TechnicalOfficeApproval,
    AuditLog,
)
from .serializers import (
    ContractorSerializer,
    WorkCategorySerializer,
    MaterialItemSerializer,
    WarehouseTransactionSerializer,
    TechnicalOfficeApprovalSerializer,
    AuditLogSerializer,
)
from .permissions import (
    IsTechnicalOffice,
    IsWarehouseKeeper,
    IsTechnicalOfficeOrWarehouse,
    CanDownloadBalanceReport,
    IsTechnicalReadOnlyOrAdmin,
    CanDownloadWarehouseReport,
)
from .services import (
    get_balance_excel_response, 
    get_global_balance_excel_response,
    get_contractors_balance_summary,
    get_warehouse_inventory_excel_response,
    get_contractors_excel_response,
    get_approvals_excel_response,
)
from .pdf_service import get_balance_pdf_response


# ─────────────────────────────────────────────────────────────────────────────
# Rate Limiter اختصاصی برای دانلود گزارش (حداکثر ۱۰ بار در ساعت)
# ─────────────────────────────────────────────────────────────────────────────
class DownloadReportThrottle(UserRateThrottle):
    scope = 'download'


# ─────────────────────────────────────────────────────────────────────────────
# AuditMixin: ثبت خودکار لاگ تغییرات
# ─────────────────────────────────────────────────────────────────────────────
class AuditMixin:
    """
    Mixin برای ثبت خودکار لاگ تغییرات در عملیات Create, Update, Delete.
    این Mixin را به ViewSet‌هایی که نیاز به Audit Trail دارند اضافه کنید.
    """

    def _get_client_ip(self, request):
        """استخراج آدرس IP واقعی کاربر"""
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded:
            return x_forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def _get_model_name(self):
        """نام فارسی مدل"""
        model = self.get_queryset().model
        return model._meta.verbose_name or model.__name__

    def _serialize_instance(self, instance):
        """تبدیل فیلدهای مهم یک instance به dict برای ذخیره در لاگ"""
        data = {}
        for field in instance._meta.fields:
            val = getattr(instance, field.name, None)
            if val is not None:
                data[field.verbose_name or field.name] = str(val)
        return data

    def perform_create(self, serializer):
        with transaction.atomic():
            super().perform_create(serializer)
            instance = serializer.instance
            AuditLog.objects.create(
                user=self.request.user if self.request.user.is_authenticated else None,
                action='CREATE',
                model_name=self._get_model_name(),
                object_id=instance.pk,
                object_repr=str(instance)[:300],
                changes={'created': self._serialize_instance(instance)},
                ip_address=self._get_client_ip(self.request),
            )

    def perform_update(self, serializer):
        with transaction.atomic():
            instance = serializer.instance
            old_data = self._serialize_instance(instance)
            super().perform_update(serializer)
            instance.refresh_from_db()
            new_data = self._serialize_instance(instance)

            # محاسبه تفاوت‌ها
            changes = {}
            for key in set(list(old_data.keys()) + list(new_data.keys())):
                old_val = old_data.get(key)
                new_val = new_data.get(key)
                if old_val != new_val:
                    changes[key] = {'before': old_val, 'after': new_val}

            if changes:
                AuditLog.objects.create(
                    user=self.request.user if self.request.user.is_authenticated else None,
                    action='UPDATE',
                    model_name=self._get_model_name(),
                    object_id=instance.pk,
                    object_repr=str(instance)[:300],
                    changes=changes,
                    ip_address=self._get_client_ip(self.request),
                )

    def perform_destroy(self, instance):
        with transaction.atomic():
            obj_data = self._serialize_instance(instance)
            obj_id = instance.pk
            obj_repr = str(instance)[:300]
            model_name = self._get_model_name()
            ip = self._get_client_ip(self.request)
            user = self.request.user if self.request.user.is_authenticated else None

            super().perform_destroy(instance)

            AuditLog.objects.create(
                user=user,
                action='DELETE',
                model_name=model_name,
                object_id=obj_id,
                object_repr=obj_repr,
                changes={'deleted': obj_data},
                ip_address=ip,
            )


# ─────────────────────────────────────────────────────────────────────────────
# ۰. پیمانکاران (Contractor)
# ─────────────────────────────────────────────────────────────────────────────
class ContractorViewSet(AuditMixin, viewsets.ModelViewSet):
    """
    مدیریت پیمانکاران.
    دفتر فنی دسترسی کامل دارد. انباردار فقط می‌تواند لیست را ببیند (GET).
    transaction_count با annotate محاسبه می‌شود (بدون N+1 Query).
    """
    serializer_class = ContractorSerializer

    def get_queryset(self):
        # annotate برای جلوگیری از N+1 - یک کوئری به جای N کوئری
        return Contractor.objects.annotate(
            transaction_count=Count('warehousetransaction')
        ).order_by('first_name', 'last_name')

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsTechnicalOfficeOrWarehouse()]
        return [IsAuthenticated(), IsTechnicalReadOnlyOrAdmin()]


# ─────────────────────────────────────────────────────────────────────────────
# ۱. رستهٔ کاری (WorkCategory)
# ─────────────────────────────────────────────────────────────────────────────
class WorkCategoryViewSet(AuditMixin, viewsets.ModelViewSet):
    queryset = WorkCategory.objects.all().order_by('name')
    serializer_class = WorkCategorySerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsTechnicalOfficeOrWarehouse()]
        return [IsAuthenticated(), IsTechnicalReadOnlyOrAdmin()]


# ─────────────────────────────────────────────────────────────────────────────
# ۲. کالا / متریال (MaterialItem)
# ─────────────────────────────────────────────────────────────────────────────
class MaterialItemViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = MaterialItemSerializer

    def get_queryset(self):
        qs = MaterialItem.objects.select_related('work_category').order_by('name')
        params = self.request.query_params

        category_id = params.get('category')
        unit = params.get('unit')

        # اعتبارسنجی category_id - باید عدد باشد
        if category_id:
            if not category_id.isdigit():
                return qs.none()
            qs = qs.filter(work_category_id=int(category_id))

        if unit:
            valid_units = {'KG', 'M', 'SQM', 'PCS'}
            unit_upper = unit.upper()
            if unit_upper in valid_units:
                qs = qs.filter(unit=unit_upper)

        return qs

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsTechnicalOfficeOrWarehouse()]
        return [IsAuthenticated(), IsTechnicalReadOnlyOrAdmin()]


# ─────────────────────────────────────────────────────────────────────────────
# ۳. تراکنش انبار (WarehouseTransaction)
# ─────────────────────────────────────────────────────────────────────────────
class WarehouseTransactionViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = WarehouseTransactionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsWarehouseKeeper()]

    def get_queryset(self):
        qs = WarehouseTransaction.objects.select_related(
            'material', 'material__work_category', 'contractor'
        ).order_by('-date', '-created_at')

        params = self.request.query_params

        # اعتبارسنجی type
        txn_type = params.get('type', '').upper()
        if txn_type in ('IN', 'OUT'):
            qs = qs.filter(transaction_type=txn_type)

        # اعتبارسنجی contractor (باید عدد باشد)
        contractor = params.get('contractor')
        if contractor:
            if contractor.isdigit():
                qs = qs.filter(contractor_id=int(contractor))

        # اعتبارسنجی material (باید عدد باشد)
        material = params.get('material')
        if material:
            if material.isdigit():
                qs = qs.filter(material_id=int(material))

        # اعتبارسنجی تاریخ‌ها (فرمت YYYY-MM-DD)
        import re
        date_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}$')

        from_date = params.get('from_date', '')
        if from_date and date_pattern.match(from_date):
            qs = qs.filter(date__gte=from_date)

        to_date = params.get('to_date', '')
        if to_date and date_pattern.match(to_date):
            qs = qs.filter(date__lte=to_date)

        return qs

    def destroy(self, request, *args, **kwargs):
        import jdatetime
        from django.utils import timezone
        from datetime import timedelta
        instance = self.get_object()
        limit = timezone.now() - timedelta(hours=24)
        limit_jalali = jdatetime.datetime.fromgregorian(datetime=limit)
        if instance.created_at < limit_jalali:
            return Response(
                {'detail': 'تراکنش‌های بیش از ۲۴ ساعت گذشته قابل حذف نیستند.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)


# ─────────────────────────────────────────────────────────────────────────────
# ۴. تاییدیه عملکرد دفتر فنی (TechnicalOfficeApproval)
# ─────────────────────────────────────────────────────────────────────────────
class TechnicalOfficeApprovalViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = TechnicalOfficeApprovalSerializer

    def get_permissions(self):
        return [IsAuthenticated(), IsTechnicalOffice()]

    def get_queryset(self):
        qs = TechnicalOfficeApproval.objects.select_related(
            'contractor', 'material', 'material__work_category'
        ).order_by('-approval_date', '-created_at')

        user = self.request.user
        if getattr(user, 'role', None) == 'WAREHOUSE':
            return qs.none()

        params = self.request.query_params
        import re
        date_pattern = re.compile(r'^\d{4}-\d{2}-\d{2}$')

        contractor = params.get('contractor')
        if contractor and contractor.isdigit():
            qs = qs.filter(contractor_id=int(contractor))

        material = params.get('material')
        if material and material.isdigit():
            qs = qs.filter(material_id=int(material))

        from_date = params.get('from_date', '')
        if from_date and date_pattern.match(from_date):
            qs = qs.filter(approval_date__gte=from_date)

        to_date = params.get('to_date', '')
        if to_date and date_pattern.match(to_date):
            qs = qs.filter(approval_date__lte=to_date)

        return qs

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        if getattr(request.user, 'role', None) != 'TECHNICAL' and not request.user.is_superuser:
            return Response(
                {'detail': 'این بخش فقط برای دفتر فنی قابل دسترسی است.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        data = (
            TechnicalOfficeApproval.objects
            .values('contractor__first_name', 'contractor__last_name', 'material__name', 'material__unit')
            .annotate(
                total_approved=Sum('approved_quantity'),
                records_count=Count('id'),
            )
            .order_by('contractor__first_name', 'contractor__last_name', 'material__name')
        )
        return Response(list(data))


# ─────────────────────────────────────────────────────────────────────────────
# ۵. دانلود گزارش بالانس متریال (اکسل)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, CanDownloadBalanceReport])
def download_balance(request):
    # اعمال Rate Limit برای این endpoint (حداکثر ۱۰ بار در ساعت)
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'detail': 'تعداد درخواست‌های دانلود شما بیش از حد مجاز است. لطفاً بعداً مجدداً تلاش کنید.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    # اعتبارسنجی ورودی‌ها
    contractor_id = request.GET.get('contractor_id')
    material_id   = request.GET.get('material_id')

    if contractor_id:
        if not contractor_id.isdigit():
            return Response({'error': 'شناسه پیمانکار نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
        contractor_id = int(contractor_id)

    if material_id:
        if not material_id.isdigit():
            return Response({'error': 'شناسه متریال نامعتبر است.'}, status=status.HTTP_400_BAD_REQUEST)
        material_id = int(material_id)

    return get_balance_excel_response(
        contractor_id=contractor_id, 
        material_id=material_id, 
        is_superuser=request.user.is_superuser
    )


# ─────────────────────────────────────────────────────────────────────────────
# ۶. دانلود گزارش موازنه کل (اکسل)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, CanDownloadBalanceReport])
def download_global_balance(request):
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'detail': 'تعداد درخواست‌های دانلود شما بیش از حد مجاز است. لطفاً بعداً مجدداً تلاش کنید.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return get_global_balance_excel_response(is_superuser=request.user.is_superuser)


# ─────────────────────────────────────────────────────────────────────────────
# ۷. دانلود گزارش بالانس متریال (PDF)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, CanDownloadBalanceReport])
def download_balance_pdf(request):
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'detail': 'تعداد درخواست‌های دانلود شما بیش از حد مجاز است.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    contractor_id = request.GET.get('contractor_id')
    material_id   = request.GET.get('material_id')
    from_date     = request.GET.get('from_date')
    to_date       = request.GET.get('to_date')

    if contractor_id and contractor_id.isdigit():
        contractor_id = int(contractor_id)
    if material_id and material_id.isdigit():
        material_id = int(material_id)

    return get_balance_pdf_response(
        contractor_id=contractor_id, 
        material_id=material_id,
        from_date=from_date,
        to_date=to_date
    )


# ─────────────────────────────────────────────────────────────────────────────
# ۸. دانلود لیست تراکنش‌های انبار (اکسل)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, CanDownloadWarehouseReport])
def download_warehouse_inventory(request):
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'detail': 'تعداد درخواست‌های دانلود شما بیش از حد مجاز است. لطفاً بعداً مجدداً تلاش کنید.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    return get_warehouse_inventory_excel_response(is_superuser=request.user.is_superuser)


# ─────────────────────────────────────────────────────────────────────────────
# API های یکپارچه‌سازی فرانت‌اند (React SPA)
# ─────────────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """
    دریافت اطلاعات کاربر لاگین شده فعلی (برای پنل فرانت‌اند).
    برگرداندن فیلدهای پایه مانند نقش کاربر (role).
    """
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'role': getattr(user, 'role', 'UNKNOWN'),
        'is_superuser': user.is_superuser,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTechnicalOffice])
def dashboard_summary(request):
    """
    تولید دیتای داشبورد برای فرانت‌اند (مخصوص دفتر فنی).
    شامل مجموع ورودی، خروجی، کارهای تایید شده و موازنه پیمانکاران.
    """
    total_in = WarehouseTransaction.objects.filter(transaction_type='IN').aggregate(Sum('quantity'))['quantity__sum'] or 0
    total_out = WarehouseTransaction.objects.filter(transaction_type='OUT').aggregate(Sum('quantity'))['quantity__sum'] or 0
    total_approved = TechnicalOfficeApproval.objects.aggregate(Sum('approved_quantity'))['approved_quantity__sum'] or 0

    summary = get_contractors_balance_summary()
    return Response({
        'total_in': float(total_in),
        'total_out': float(total_out),
        'total_approved': float(total_approved),
        'contractors': summary
    })

# ─────────────────────────────────────────────────────────────────────────────
# دانلود خروجی‌های اکسل جدید
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTechnicalReadOnlyOrAdmin])
def download_contractors(request):
    from .services import get_contractors_excel_response
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response({'detail': 'تعداد درخواست‌ها بیش از حد مجاز است.'}, status=429)
    return get_contractors_excel_response(is_superuser=request.user.is_superuser)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTechnicalReadOnlyOrAdmin])
def download_approvals(request):
    from .services import get_approvals_excel_response
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response({'detail': 'تعداد درخواست‌ها بیش از حد مجاز است.'}, status=429)
    return get_approvals_excel_response(is_superuser=request.user.is_superuser)

# ─────────────────────────────────────────────────────────────────────────────
# استعلام آمارهای زنده (برای فرم‌های تاییدیه و خروج انبار)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_material_inventory(request):
    """موجودی لحظه‌ای یک متریال را برمی‌گرداند"""
    material_id = request.GET.get('material_id')
    if not material_id:
        return Response({'detail': 'شناسه متریال الزامی است.'}, status=400)
    
    qs = WarehouseTransaction.objects.filter(material_id=material_id)
    
    total_in = qs.filter(transaction_type='IN').aggregate(t=Sum('quantity'))['t'] or 0
    total_out = qs.filter(transaction_type='OUT').aggregate(t=Sum('quantity'))['t'] or 0
    current_stock = total_in - total_out
    
    return Response({
        'total_in': total_in,
        'total_out': total_out,
        'current_stock': current_stock
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_material_inventory(request):
    """لیست کامل متریال‌ها به همراه موجودی را برمی‌گرداند"""
    from django.db.models import Sum, F, Q, Value, DecimalField
    from django.db.models.functions import Coalesce
    from .models import MaterialItem
    
    # حاشیه نویسی موجودی کل با تجمیع تراکنش‌ها
    materials = MaterialItem.objects.select_related('work_category').annotate(
        total_in=Coalesce(
            Sum('transactions__quantity', filter=Q(transactions__transaction_type='IN')),
            Value(0, output_field=DecimalField())
        ),
        total_out=Coalesce(
            Sum('transactions__quantity', filter=Q(transactions__transaction_type='OUT')),
            Value(0, output_field=DecimalField())
        )
    )
    
    data = []
    for mat in materials:
        current_stock = mat.total_in - mat.total_out
        data.append({
            'id': mat.id,
            'name': mat.name,
            'size': mat.size,
            'thickness': mat.thickness,
            'material_type': mat.material_type,
            'unit_display': mat.get_unit_display(),
            'work_category_name': mat.work_category.name if mat.work_category else '—',
            'total_in': mat.total_in,
            'total_out': mat.total_out,
            'current_stock': current_stock,
        })
        
    return Response(data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_contractor_material_received(request):
    """مقدار دریافتی لحظه‌ای یک پیمانکار از یک متریال را برمی‌گرداند"""
    material_id = request.GET.get('material_id')
    contractor_id = request.GET.get('contractor_id')
    if not material_id or not contractor_id:
        return Response({'detail': 'شناسه متریال و پیمانکار الزامی است.'}, status=400)
    
    total_received = WarehouseTransaction.objects.filter(
        transaction_type='OUT',
        material_id=material_id,
        contractor_id=contractor_id
    ).aggregate(t=Sum('quantity'))['t'] or 0
    
    return Response({
        'total_received': total_received
    })


# ─────────────────────────────────────────────────────────────────────────────
# ۸. API هشدارهای سیستم (Notifications)
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_notifications(request):
    """
    لیست هشدارهای سیستم:
    - متریال‌های با موجودی بحرانی (زیر آستانه)
    """
    notifications = []

    # ─── هشدارهای موجودی بحرانی ────────────────────────────────────────────
    from django.db.models import Sum, F, Q, Value, DecimalField
    from django.db.models.functions import Coalesce

    materials_with_threshold = MaterialItem.objects.filter(
        low_stock_threshold__gt=0
    ).select_related('work_category').annotate(
        total_in=Coalesce(
            Sum('transactions__quantity', filter=Q(transactions__transaction_type='IN')),
            Value(0, output_field=DecimalField())
        ),
        total_out=Coalesce(
            Sum('transactions__quantity', filter=Q(transactions__transaction_type='OUT')),
            Value(0, output_field=DecimalField())
        )
    )

    for mat in materials_with_threshold:
        current_stock = mat.total_in - mat.total_out

        if current_stock <= mat.low_stock_threshold:
            notifications.append({
                'type': 'LOW_STOCK',
                'severity': 'critical' if current_stock <= 0 else 'warning',
                'title': f'موجودی بحرانی: {mat.name}',
                'message': f'موجودی فعلی {current_stock} {mat.get_unit_display()} — آستانه: {mat.low_stock_threshold} {mat.get_unit_display()}',
                'material_id': mat.id,
                'current_stock': float(current_stock),
                'threshold': float(mat.low_stock_threshold),
            })

    return Response({
        'count': len(notifications),
        'notifications': notifications,
    })


# ─────────────────────────────────────────────────────────────────────────────
# ۹. لاگ تغییرات (Audit Log) - فقط سوپریوزر
# ─────────────────────────────────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_logs_list(request):
    """لیست لاگ تغییرات — فقط برای سوپریوزر"""
    if not request.user.is_superuser:
        return Response({'detail': 'دسترسی فقط برای مدیر سیستم مجاز است.'}, status=403)

    qs = AuditLog.objects.select_related('user').all()

    # فیلتر بر اساس نوع عملیات
    action_filter = request.GET.get('action')
    if action_filter and action_filter.upper() in ('CREATE', 'UPDATE', 'DELETE'):
        qs = qs.filter(action=action_filter.upper())

    # فیلتر بر اساس مدل
    model_filter = request.GET.get('model')
    if model_filter:
        qs = qs.filter(model_name__icontains=model_filter)

    # محدودیت تعداد (پیش‌فرض ۵۰)
    limit = request.GET.get('limit', '50')
    try:
        limit = min(int(limit), 200)
    except ValueError:
        limit = 50

    qs = qs[:limit]
    serializer = AuditLogSerializer(qs, many=True)
    return Response({
        'count': len(serializer.data),
        'results': serializer.data,
    })
