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


from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 1000


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
        if self.action in ('list', 'retrieve', 'received_materials'):
            return [IsAuthenticated(), IsTechnicalOfficeOrWarehouse()]
        return [IsAuthenticated(), IsTechnicalReadOnlyOrAdmin()]

    @action(detail=True, methods=['get'], url_path='received-materials')
    def received_materials(self, request, pk=None):
        """لیست آیدی متریال‌هایی که این پیمانکار تحویل گرفته است"""
        material_ids = WarehouseTransaction.objects.filter(
            contractor_id=pk,
            transaction_type='OUT'
        ).values_list('material_id', flat=True).distinct()
        return Response(list(material_ids))


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

    def create(self, request, *args, **kwargs):
        data = request.data
        name = data.get('name', '').strip() if data.get('name') else ''
        work_category = data.get('work_category')
        material_type = data.get('material_type', '').strip() if data.get('material_type') else ''
        size = data.get('size', '').strip() if data.get('size') else ''
        thickness = data.get('thickness', '').strip() if data.get('thickness') else ''
        unit = data.get('unit', '').strip() if data.get('unit') else ''

        try:
            work_category_id = int(work_category) if work_category else None
        except (ValueError, TypeError):
            work_category_id = None

        # Check if a material with the exact same specs already exists
        existing = MaterialItem.objects.filter(
            name__iexact=name,
            work_category_id=work_category_id,
            material_type__iexact=material_type,
            size__iexact=size,
            thickness__iexact=thickness,
            unit=unit
        ).first()

        if existing:
            serializer = self.get_serializer(existing)
            return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated(), IsTechnicalOfficeOrWarehouse()]
        return [IsAuthenticated(), IsTechnicalReadOnlyOrAdmin()]


# ─────────────────────────────────────────────────────────────────────────────
# ۳. تراکنش انبار (WarehouseTransaction)
# ─────────────────────────────────────────────────────────────────────────────
class WarehouseTransactionViewSet(AuditMixin, viewsets.ModelViewSet):
    serializer_class = WarehouseTransactionSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsWarehouseKeeper()]

    def get_queryset(self):
        qs = WarehouseTransaction.objects.select_related(
            'material', 'material__work_category', 'contractor'
        ).order_by('-date', '-created_at')

        params = self.request.query_params

        # جستجوی متنی پیشرفته
        search = params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(material__name__icontains=search) |
                Q(contractor__first_name__icontains=search) |
                Q(contractor__last_name__icontains=search) |
                Q(bill_of_lading__icontains=search) |
                Q(contract_number__icontains=search)
            )

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

    @action(detail=False, methods=['get'], url_path='contractor-contracts')
    def contractor_contracts(self, request):
        """
        لیست قراردادهای یک پیمانکار و متریال را برمی‌گرداند.
        """
        contractor_id = request.query_params.get('contractor_id')
        material_id = request.query_params.get('material_id')

        if not contractor_id or not material_id:
            return Response([])

        qs = WarehouseTransaction.objects.filter(
            contractor_id=contractor_id,
            material_id=material_id
        ).exclude(
            contract_number__isnull=True
        ).exclude(
            contract_number=''
        ).values('contract_number', 'contract_subject').distinct()

        return Response(list(qs))

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
    pagination_class = StandardResultsSetPagination

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

        # جستجوی متنی پیشرفته
        search = params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(material__name__icontains=search) |
                Q(contractor__first_name__icontains=search) |
                Q(contractor__last_name__icontains=search) |
                Q(contract_number__icontains=search)
            )
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

    from .models import ExportTask
    from .tasks import generate_global_balance_excel_task

    resume_from = request.GET.get('resume_from')

    # ایجاد تسک جدید در دیتابیس
    task = ExportTask.objects.create(status='PENDING', task_type='excel', progress=0, eta=0)
    
    # اجرای تسک سلری به صورت غیرهمزمان با تعیین شناسه تسک همسان با شناسه دیتابیس
    generate_global_balance_excel_task.apply_async(
        args=(str(task.id), request.user.is_superuser, resume_from),
        task_id=str(task.id)
    )

    return Response({
        'task_id': str(task.id),
        'status': task.status,
        'progress': task.progress,
        'eta': task.eta
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, CanDownloadBalanceReport])
def download_global_pdf(request):
    throttle = DownloadReportThrottle()
    if not throttle.allow_request(request, None):
        return Response(
            {'detail': 'تعداد درخواست‌های دانلود شما بیش از حد مجاز است. لطفاً بعداً مجدداً تلاش کنید.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    from .models import ExportTask
    from .tasks import generate_global_balance_pdf_task

    resume_from = request.GET.get('resume_from')

    # ایجاد تسک جدید در دیتابیس
    task = ExportTask.objects.create(status='PENDING', task_type='pdf', progress=0, eta=0)
    
    # اجرای تسک سلری به صورت غیرهمزمان با تعیین شناسه تسک همسان با شناسه دیتابیس
    generate_global_balance_pdf_task.apply_async(
        args=(str(task.id), request.user.is_superuser, resume_from),
        task_id=str(task.id)
    )

    return Response({
        'task_id': str(task.id),
        'status': task.status,
        'progress': task.progress,
        'eta': task.eta
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_task_status(request, task_id):
    """
    بررسی وضعیت پیشرفت تسک تولید فایل اکسل گزارش موازنه کل در پس‌زمینه.
    """
    from .models import ExportTask
    from django.shortcuts import get_object_or_404

    task = get_object_or_404(ExportTask, pk=task_id)
    return Response({
        'task_id': str(task.id),
        'status': task.status,
        'progress': task.progress,
        'eta': task.eta,
        'file_url': task.file_url,
        'error_message': task.error_message,
        'created_at': task.created_at
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_export_task(request, task_id):
    """
    لغو تسک تولید گزارش در پس‌زمینه و متوقف کردن فرآیند سلری.
    """
    from .models import ExportTask
    from django.shortcuts import get_object_or_404
    from jahanpars.celery import app
    
    task = get_object_or_404(ExportTask, pk=task_id)
    if task.status in ('PENDING', 'PROCESSING'):
        # لغو تسک در Celery
        try:
            app.control.revoke(str(task.id), terminate=True, reply=False)
        except Exception:
            # حتی اگر اتصال به ورکرها برقرار نباشد، تسک را در دیتابیس لغو می‌کنیم
            pass
        
        # به‌روزرسانی وضعیت در دیتابیس
        task.status = 'FAILURE'
        task.error_message = 'توسط کاربر لغو شد.'
        task.progress = 0
        task.eta = 0
        task.save()
        return Response({'status': 'CANCELLED'})
        
    return Response({'status': task.status})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def active_export_tasks(request):
    """
    دریافت لیست تسک‌های فعال اخیر (برای لود مجدد در صورت رفرش صفحه فرانت‌اند).
    تسک‌هایی که در وضعیت PENDING یا PROCESSING هستند و در ۱ ساعت اخیر ساخته شده‌اند.
    """
    from .models import ExportTask
    from django.utils import timezone
    from datetime import timedelta
    
    one_hour_ago = timezone.now() - timedelta(hours=1)
    
    # دریافت تسک‌های فعال
    tasks = ExportTask.objects.filter(
        status__in=('PENDING', 'PROCESSING'),
        created_at__gte=one_hour_ago
    )
    
    data = []
    for task in tasks:
        data.append({
            'task_id': str(task.id),
            'status': task.status,
            'progress': task.progress,
            'eta': task.eta,
            'type': task.task_type,
            'file_url': task.file_url,
            'error_message': task.error_message,
            'created_at': task.created_at.isoformat() if task.created_at else None
        })
    return Response(data)


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

    contractor_ids_str = request.GET.get('contractor_ids')
    material_ids_str   = request.GET.get('material_ids')
    contractor_id = request.GET.get('contractor_id')
    material_id   = request.GET.get('material_id')
    from_date     = request.GET.get('from_date')
    to_date       = request.GET.get('to_date')
    status_filter = request.GET.get('status')

    contractor_ids = []
    if contractor_ids_str:
        contractor_ids = [int(x.strip()) for x in contractor_ids_str.split(',') if x.strip().isdigit()]
    elif contractor_id and contractor_id.isdigit():
        contractor_ids = [int(contractor_id)]

    material_ids = []
    if material_ids_str:
        material_ids = [int(x.strip()) for x in material_ids_str.split(',') if x.strip().isdigit()]
    elif material_id and material_id.isdigit():
        material_ids = [int(material_id)]

    return get_balance_pdf_response(
        contractor_ids=contractor_ids or None, 
        material_ids=material_ids or None,
        from_date=from_date,
        to_date=to_date,
        status_filter=status_filter
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
    برگرداندن فیلدهای پایه و مشخصات پروفایل کاربر.
    """
    user = request.user
    return Response({
        'id': user.id,
        'username': user.username,
        'role': getattr(user, 'role', 'UNKNOWN'),
        'is_superuser': user.is_superuser,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'full_name': user.get_full_name() or user.username,
        'email': user.email,
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTechnicalOffice])
def dashboard_summary(request):
    """
    تولید دیتای داشبورد برای فرانت‌اند (مخصوص دفتر فنی).
    شامل مجموع ورودی، خروجی، کارهای تایید شده و موازنه پیمانکاران.
    """
    total_in_qs = WarehouseTransaction.objects.filter(transaction_type='IN') \
        .values('material__unit') \
        .annotate(total=Sum('quantity'))
    total_in = {item['material__unit']: float(item['total']) for item in total_in_qs}

    total_out_qs = WarehouseTransaction.objects.filter(transaction_type='OUT') \
        .values('material__unit') \
        .annotate(total=Sum('quantity'))
    total_out = {item['material__unit']: float(item['total']) for item in total_out_qs}

    total_approved_qs = TechnicalOfficeApproval.objects \
        .values('material__unit') \
        .annotate(total=Sum('approved_quantity'))
    total_approved = {item['material__unit']: float(item['total']) for item in total_approved_qs}

    summary = get_contractors_balance_summary()
    return Response({
        'total_in': total_in,
        'total_out': total_out,
        'total_approved': total_approved,
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contractor_outbound_summary(request):
    """
    تولید دیتای خروجی انبار به تفکیک پیمانکار، کالا و مشخصات فنی (سایز، جنس، ضخامت)
    """
    from .models import WarehouseTransaction

    # کوئری تجمیعی روی دیتابیس برای دریافت مجموع خروجی‌ها
    qs = WarehouseTransaction.objects.filter(transaction_type='OUT') \
        .values(
            'contractor_id',
            'contractor__first_name',
            'contractor__last_name',
            'material__name',
            'material__size',
            'material__material_type',
            'material__thickness',
            'material__unit',
        ) \
        .annotate(total_qty=Sum('quantity')) \
        .order_by('contractor__first_name', 'contractor__last_name', 'material__name')

    data = []
    for item in qs:
        first_name = item['contractor__first_name'] or ''
        last_name = item['contractor__last_name'] or ''
        full_name = f"{first_name} {last_name}".strip() or "پیمانکار ناشناس"
        
        data.append({
            'contractor_id': item['contractor_id'],
            'contractor_name': full_name,
            'material_name': item['material__name'],
            'size': item['material__size'] or '',
            'material_type': item['material__material_type'] or '',
            'thickness': item['material__thickness'] or '',
            'unit': item['material__unit'] or '',
            'total_qty': float(item['total_qty'] or 0),
        })

    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def technical_approval_summary(request):
    """
    تولید دیتای تاییدیه‌های دفتر فنی به تفکیک پیمانکار، متریال، سایز، جنس و ضخامت،
    به همراه مقدار تحویلی (OUT transactions) و مقدار تایید شده (approvals).
    """
    from .models import WarehouseTransaction, TechnicalOfficeApproval
    from django.db.models import Sum

    # ۱. تجمیع مقادیر تحویلی (خروجی انبار)
    delivered_qs = WarehouseTransaction.objects.filter(transaction_type='OUT') \
        .values(
            'contractor_id',
            'contractor__first_name',
            'contractor__last_name',
            'material__id',
            'material__name',
            'material__size',
            'material__material_type',
            'material__thickness',
            'material__unit',
            'material__waste_percentage',
        ) \
        .annotate(total_delivered=Sum('quantity'))

    # ۲. تجمیع مقادیر تایید شده (دفتر فنی)
    approved_qs = TechnicalOfficeApproval.objects.all() \
        .values(
            'contractor_id',
            'contractor__first_name',
            'contractor__last_name',
            'material__id',
            'material__name',
            'material__size',
            'material__material_type',
            'material__thickness',
            'material__unit',
            'material__waste_percentage',
        ) \
        .annotate(total_approved=Sum('approved_quantity'))

    # ادغام اطلاعات بر اساس کلید یکتا
    merged = {}

    for item in delivered_qs:
        c_id = item['contractor_id']
        m_id = item['material__id']
        if not c_id or not m_id:
            continue
        first_name = item['contractor__first_name'] or ''
        last_name = item['contractor__last_name'] or ''
        full_name = f"{first_name} {last_name}".strip() or "پیمانکار ناشناس"
        
        key = (c_id, m_id, item['material__size'] or '', item['material__material_type'] or '', item['material__thickness'] or '', item['material__unit'] or '')
        merged[key] = {
            'contractor_id': c_id,
            'contractor_name': full_name,
            'material_id': m_id,
            'material_name': item['material__name'],
            'size': item['material__size'] or '',
            'material_type': item['material__material_type'] or '',
            'thickness': item['material__thickness'] or '',
            'unit': item['material__unit'] or '',
            'waste_percentage': float(item['material__waste_percentage'] or 0),
            'total_delivered': float(item['total_delivered'] or 0),
            'total_approved': 0.0,
        }

    for item in approved_qs:
        c_id = item['contractor_id']
        m_id = item['material__id']
        if not c_id or not m_id:
            continue
        first_name = item['contractor__first_name'] or ''
        last_name = item['contractor__last_name'] or ''
        full_name = f"{first_name} {last_name}".strip() or "پیمانکار ناشناس"

        key = (c_id, m_id, item['material__size'] or '', item['material__material_type'] or '', item['material__thickness'] or '', item['material__unit'] or '')
        
        if key in merged:
            merged[key]['total_approved'] = float(item['total_approved'] or 0)
        else:
            merged[key] = {
                'contractor_id': c_id,
                'contractor_name': full_name,
                'material_id': m_id,
                'material_name': item['material__name'],
                'size': item['material__size'] or '',
                'material_type': item['material__material_type'] or '',
                'thickness': item['material__thickness'] or '',
                'unit': item['material__unit'] or '',
                'waste_percentage': float(item['material__waste_percentage'] or 0),
                'total_delivered': 0.0,
                'total_approved': float(item['total_approved'] or 0),
            }

    result = list(merged.values())
    result.sort(key=lambda x: (x['contractor_name'], x['material_name']))
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsTechnicalOffice])
def global_balance_rows(request):
    """
    دریافت ردیف‌های گزارش موازنه متریال کل کارگاه برای نمایش در داشبورد فرانت‌اند با پشتیبانی از فیلتر و صفحه‌بندی.
    """
    from .services import get_global_material_balance_rows_data
    
    # خواندن فیلترها و صفحه‌بندی
    search = request.GET.get('search')
    category = request.GET.get('category')
    contractor = request.GET.get('contractor')
    material = request.GET.get('material')
    status_filter = request.GET.get('status')
    return_filters = request.GET.get('return_filters') == 'true'
    
    page = request.GET.get('page', '1')
    page_size = request.GET.get('page_size', '10')
    
    try:
        page = int(page)
    except ValueError:
        page = 1
        
    try:
        page_size = int(page_size)
    except ValueError:
        page_size = 10
        
    data = get_global_material_balance_rows_data(
        search=search,
        category=category,
        contractor=contractor,
        material=material,
        status=status_filter,
        page=page,
        page_size=page_size,
        return_filters=return_filters
    )
    return Response(data)

