from celery import shared_task
import os
import logging
from django.conf import settings
from .models import ExportTask
from .services import generate_global_material_balance_excel

logger = logging.getLogger(__name__)

@shared_task
def generate_global_balance_excel_task(task_id, is_superuser, resume_from=None):
    """
    تسک سلری برای تولید فایل اکسل گزارش موازنه کل در پس‌زمینه.
    """
    logger.info(f"Starting async Excel export for task: {task_id} (resume_from: {resume_from})")
    try:
        # آپدیت وضعیت به PROCESSING
        ExportTask.objects.filter(pk=task_id).update(status='PROCESSING', progress=1)

        # اجرای متد تولید اکسل. ما task_id را پاس می‌دهیم تا در طول فرآیند، پیشرفت کار آپدیت شود.
        excel_bytes = generate_global_material_balance_excel(
            is_superuser=is_superuser,
            task_id=task_id,
            resume_from=resume_from
        )

        if not excel_bytes:
            raise ValueError("فایل اکسل با محتوای خالی یا نامعتبر مواجه شد.")

        # ساخت مسیر ذخیره‌سازی در media/exports/
        exports_dir = os.path.join(settings.MEDIA_ROOT, 'exports')
        os.makedirs(exports_dir, exist_ok=True)

        file_name = f"global_material_balance_{task_id}.xlsx"
        file_path = os.path.join(exports_dir, file_name)

        # نوشتن بایت‌ها روی دیسک
        with open(file_path, 'wb') as f:
            f.write(excel_bytes)

        file_url = f"{settings.MEDIA_URL}exports/{file_name}"

        # آپدیت تسک به SUCCESS
        ExportTask.objects.filter(pk=task_id).update(
            status='SUCCESS',
            progress=100,
            eta=0,
            file_url=file_url
        )
        logger.info(f"Excel export completed successfully for task: {task_id}")

    except Exception as e:
        logger.error(f"Error during async Excel export: {str(e)}", exc_info=True)
        # ثبت وضعیت خطا در تسک
        ExportTask.objects.filter(pk=task_id).update(
            status='FAILURE',
            error_message=str(e),
            progress=0,
            eta=0
        )


@shared_task
def generate_global_balance_pdf_task(task_id, is_superuser, resume_from=None):
    """
    تسک سلری برای تولید فایل PDF گزارش موازنه کل در پس‌زمینه.
    """
    logger.info(f"Starting async PDF export for task: {task_id} (resume_from: {resume_from})")
    try:
        # آپدیت وضعیت به PROCESSING
        ExportTask.objects.filter(pk=task_id).update(status='PROCESSING', progress=1)

        # اجرای متد جدید تولید PDF موازنه کل
        from .pdf_service import generate_global_material_balance_pdf
        pdf_bytes = generate_global_material_balance_pdf(
            is_superuser=is_superuser,
            task_id=task_id,
            resume_from=resume_from
        )

        if not pdf_bytes:
            raise ValueError("فایل PDF با محتوای خالی یا نامعتبر مواجه شد.")

        # ساخت مسیر ذخیره‌سازی در media/exports/
        exports_dir = os.path.join(settings.MEDIA_ROOT, 'exports')
        os.makedirs(exports_dir, exist_ok=True)

        file_name = f"global_material_balance_{task_id}.pdf"
        file_path = os.path.join(exports_dir, file_name)

        # نوشتن بایت‌ها روی دیسک
        with open(file_path, 'wb') as f:
            f.write(pdf_bytes)

        file_url = f"{settings.MEDIA_URL}exports/{file_name}"

        # آپدیت تسک به SUCCESS
        ExportTask.objects.filter(pk=task_id).update(
            status='SUCCESS',
            progress=100,
            eta=0,
            file_url=file_url
        )
        logger.info(f"PDF export completed successfully for task: {task_id}")

    except Exception as e:
        logger.error(f"Error during async PDF export: {str(e)}", exc_info=True)
        # ثبت وضعیت خطا در تسک
        ExportTask.objects.filter(pk=task_id).update(
            status='FAILURE',
            error_message=str(e),
            progress=0,
            eta=0
        )

