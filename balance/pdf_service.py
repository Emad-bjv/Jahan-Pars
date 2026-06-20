import os
import io
import jdatetime
from django.conf import settings
from django.http import HttpResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display

from .models import WarehouseTransaction, TechnicalOfficeApproval, Contractor, MaterialItem
from django.db.models import Sum


def register_fonts():
    """ثبت فونت‌های فارسی"""
    font_dir = os.path.join(settings.BASE_DIR, 'balance', 'fonts')
    reg_font_path = os.path.join(font_dir, 'Vazirmatn-Regular.ttf')
    bold_font_path = os.path.join(font_dir, 'Vazirmatn-Bold.ttf')
    
    if os.path.exists(reg_font_path):
        pdfmetrics.registerFont(TTFont('Vazir', reg_font_path))
    if os.path.exists(bold_font_path):
        pdfmetrics.registerFont(TTFont('Vazir-Bold', bold_font_path))


def persian_text(text):
    """تبدیل متن فارسی برای نمایش صحیح در ReportLab"""
    if not text:
        return ""
    text = str(text)
    reshaped_text = arabic_reshaper.reshape(text)
    bidi_text = get_display(reshaped_text)
    return bidi_text


def get_balance_pdf_response(contractor_ids=None, material_ids=None, from_date=None, to_date=None, status_filter=None, contractor_id=None, material_id=None):
    """
    تولید گزارش PDF رسمی از موازنه متریال
    """
    if not contractor_ids and contractor_id:
        contractor_ids = [contractor_id]
    if not material_ids and material_id:
        material_ids = [material_id]

    register_fonts()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=landscape(A4),
        rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30,
        title="گزارش موازنه متریال"
    )
    
    elements = []
    
    # ─── استایل‌ها ────────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'PersianTitle',
        parent=styles['Title'],
        fontName='Vazir-Bold' if 'Vazir-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica',
        fontSize=18,
        alignment=1, # Center
        spaceAfter=20
    )
    
    header_style = ParagraphStyle(
        'PersianHeader',
        fontName='Vazir' if 'Vazir' in pdfmetrics.getRegisteredFontNames() else 'Helvetica',
        fontSize=12,
        alignment=2, # Right
        spaceAfter=15
    )
    
    # ─── هدر گزارش ────────────────────────────────────────────────────────────
    current_date = jdatetime.datetime.now().strftime('%Y/%m/%d %H:%M')
    
    elements.append(Paragraph(persian_text("گزارش رسمی موازنه متریال پروژه جهان‌پارس"), title_style))
    elements.append(Paragraph(persian_text(f"تاریخ تهیه گزارش: {current_date}"), header_style))

    if from_date or to_date:
        try:
            fd_str = jdatetime.date.fromgregorian(date=jdatetime.datetime.strptime(from_date, '%Y-%m-%d').date()).isoformat() if from_date else 'ابتدا'
            td_str = jdatetime.date.fromgregorian(date=jdatetime.datetime.strptime(to_date, '%Y-%m-%d').date()).isoformat() if to_date else 'انتها'
            date_str = f"بازه زمانی: {fd_str} تا {td_str}"
        except Exception:
            date_str = f"بازه زمانی: {from_date or 'ابتدا'} تا {to_date or 'انتها'}"
            
        elements.append(Paragraph(persian_text(date_str), header_style))
    
    if contractor_ids:
        try:
            selected_contractors = Contractor.objects.filter(id__in=contractor_ids)
            names_list = [c.get_full_name() for c in selected_contractors]
            if names_list:
                elements.append(Paragraph(persian_text(f"پیمانکاران: {'، '.join(names_list)}"), header_style))
        except Exception:
            pass
            
    if material_ids:
        try:
            selected_materials = MaterialItem.objects.filter(id__in=material_ids)
            names_list = [f"{m.name} ({m.get_unit_display()})" for m in selected_materials]
            if names_list:
                elements.append(Paragraph(persian_text(f"متریال‌ها: {'، '.join(names_list)}"), header_style))
        except Exception:
            pass
            
    if status_filter:
        status_map = {
            'debtor': 'بدهکار (مازاد دریافت)', 
            'creditor': 'بستانکار (کسری)', 
            'cleared': 'تسویه',
            'under_review': 'در حال بررسی توسط دفتر فنی'
        }
        if status_filter in status_map:
            elements.append(Paragraph(persian_text(f"وضعیت موازنه: {status_map[status_filter]}"), header_style))
            
    elements.append(Spacer(1, 20))
    
    # ─── استخراج داده‌ها ──────────────────────────────────────────────────────
    contractors = Contractor.objects.all().order_by('first_name', 'last_name')
    if contractor_ids:
        contractors = contractors.filter(id__in=contractor_ids)
        
    materials = MaterialItem.objects.all().order_by('name')
    if material_ids:
        materials = materials.filter(id__in=material_ids)
        
    # هدر جدول
    table_data = [[
        persian_text('موازنه نهایی'),
        persian_text('پرتی مجاز'),
        persian_text('کار تایید شده'),
        persian_text('دریافتی از انبار'),
        persian_text('واحد'),
        persian_text('متریال'),
        persian_text('پیمانکار')
    ]]
    
    for contractor in contractors:
        for material in materials:
            # اعمال فیلتر تاریخ
            tx_qs = WarehouseTransaction.objects.filter(contractor=contractor, material=material, transaction_type='OUT')
            ap_qs = TechnicalOfficeApproval.objects.filter(contractor=contractor, material=material)

            if from_date:
                tx_qs = tx_qs.filter(date__gte=from_date)
                ap_qs = ap_qs.filter(approval_date__gte=from_date)
            if to_date:
                tx_qs = tx_qs.filter(date__lte=to_date)
                ap_qs = ap_qs.filter(approval_date__lte=to_date)

            # دریافتی (خروج از انبار به پیمانکار)
            received = tx_qs.aggregate(t=Sum('quantity'))['t'] or 0
            
            # کارهای تایید شده دفتر فنی
            approved = ap_qs.aggregate(t=Sum('approved_quantity'))['t'] or 0
            
            # اگر هیچ تعاملی نبوده نشان داده نشود
            if received == 0 and approved == 0:
                continue
                
            waste = float(approved) * (float(material.waste_percentage) / 100)
            balance = float(approved) + waste - float(received)
            
            # فیلتر وضعیت موازنه
            if status_filter == 'debtor' and balance <= 0:
                continue
            if status_filter == 'creditor' and balance >= 0:
                continue
            if status_filter == 'cleared' and balance != 0:
                continue
            if status_filter == 'under_review' and (approved != 0 or received == 0):
                continue
            
            # فرمت اعداد
            def fmt(val):
                return "{:,.2f}".format(float(val)).rstrip('0').rstrip('.')
                
            row = [
                persian_text(f"{fmt(balance)} {'+' if balance > 0 else ''}"),
                persian_text(fmt(waste)),
                persian_text(fmt(approved)),
                persian_text(fmt(received)),
                persian_text(material.get_unit_display()),
                persian_text(material.name),
                persian_text(contractor.get_full_name())
            ]
            table_data.append(row)
            
    if len(table_data) == 1:
        # هیچ داده‌ای یافت نشد
        table_data.append([persian_text('هیچ رکوردی یافت نشد'), '', '', '', '', '', ''])

    # ─── جدول و استایل‌ها ──────────────────────────────────────────────────────
    table = Table(table_data, colWidths=[90, 80, 80, 80, 60, 200, 150])
    
    font_name = 'Vazir' if 'Vazir' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
    font_bold = 'Vazir-Bold' if 'Vazir-Bold' in pdfmetrics.getRegisteredFontNames() else font_name
    
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 14),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1e293b')),
        ('FONTNAME', (0, 1), (-1, -1), font_name),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]
    
    # Conditional styling for Balance column (Column 0)
    for i, row in enumerate(table_data):
        if i == 0: continue
        val_str = row[0]
        if '+' in val_str:  # Surplus (Debtor)
            table_style.append(('TEXTCOLOR', (0, i), (0, i), colors.HexColor('#dc2626')))
            table_style.append(('FONTNAME', (0, i), (0, i), font_bold))
        elif val_str.strip() != '0.00' and val_str.strip() != '0' and val_str.strip() != persian_text('هیچ رکوردی یافت نشد'): # Deficit (Creditor)
            table_style.append(('TEXTCOLOR', (0, i), (0, i), colors.HexColor('#16a34a')))
            table_style.append(('FONTNAME', (0, i), (0, i), font_bold))

    table.setStyle(TableStyle(table_style))
    
    elements.append(table)
    
    # ساخت فایل PDF
    doc.build(elements)
    buffer.seek(0)
    
    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="jahanpars_balance_report.pdf"'
    return response


def generate_global_material_balance_pdf(is_superuser=False, task_id=None, resume_from=None) -> bytes:
    """
    تولید گزارش PDF موازنه کل کارگاه به صورت ناهمگام با استفاده از جدول پیش‌محاسبه‌شده.
    """
    from .services import get_global_material_balance_rows_data
    import os
    import pickle
    from django.conf import settings
    register_fonts()
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=landscape(A4),
        rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30,
        title="گزارش موازنه متریال کل"
    )
    
    elements = []
    
    # ─── استایل‌ها ────────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'PersianTitle',
        parent=styles['Title'],
        fontName='Vazir-Bold' if 'Vazir-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica',
        fontSize=18,
        alignment=1, # Center
        spaceAfter=20
    )
    
    header_style = ParagraphStyle(
        'PersianHeader',
        fontName='Vazir' if 'Vazir' in pdfmetrics.getRegisteredFontNames() else 'Helvetica',
        fontSize=12,
        alignment=2, # Right
        spaceAfter=15
    )
    
    # ─── هدر گزارش ────────────────────────────────────────────────────────────
    current_date = jdatetime.datetime.now().strftime('%Y/%m/%d %H:%M')
    
    elements.append(Paragraph(persian_text("گزارش رسمی موازنه متریال کل پروژه جهان‌پارس"), title_style))
    elements.append(Paragraph(persian_text(f"تاریخ تهیه گزارش: {current_date}"), header_style))
    elements.append(Paragraph(persian_text("حوزه گزارش: موازنه کل (به تفکیک تمامی پیمانکاران)"), header_style))
    elements.append(Spacer(1, 20))
    
    # دریافت داده‌ها از جدول پیش‌محاسبه‌شده
    rows = get_global_material_balance_rows_data()
    total_rows = len(rows)
    
    # هدر جدول
    header_row = [
        persian_text('موازنه نهایی'),
        persian_text('پرتی مجاز'),
        persian_text('کار تایید شده'),
        persian_text('دریافتی از انبار'),
        persian_text('واحد'),
        persian_text('متریال'),
        persian_text('پیمانکار')
    ]
    
    font_name = 'Vazir' if 'Vazir' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
    font_bold = 'Vazir-Bold' if 'Vazir-Bold' in pdfmetrics.getRegisteredFontNames() else font_name
    
    base_table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#1e293b')),
        ('FONTNAME', (0, 1), (-1, -1), font_name),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]
    
    import time
    start_time = time.time()
    
    # آرایه برای انباشت داده‌های آماده‌شده
    formatted_data = []
    start_idx = 0
    
    if resume_from:
        temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_exports')
        if os.path.exists(temp_dir):
            temp_file = None
            for f in os.listdir(temp_dir):
                if f.startswith(f"temp_{resume_from}_") and f.endswith(".pkl"):
                    temp_file = os.path.join(temp_dir, f)
                    try:
                        start_idx = int(f.split("_")[2].split(".")[0]) + 1
                    except ValueError:
                        start_idx = 0
                    break
            
            if temp_file and start_idx > 0 and start_idx < total_rows:
                try:
                    with open(temp_file, 'rb') as pf:
                        formatted_data = pickle.load(pf)
                except Exception:
                    formatted_data = []
                    start_idx = 0
    
    for idx in range(start_idx, total_rows):
        row = rows[idx]
        if task_id and total_rows > 0 and (idx % 500 == 0 or idx == total_rows - 1):
            progress_pct = int(((idx + 1) / total_rows) * 90) # اختصاص ۹۰ درصد به آماده‌سازی داده‌ها
            elapsed = time.time() - start_time
            avg_time_per_row = elapsed / (idx - start_idx + 1) if (idx - start_idx) > 0 else 0.001
            remaining_rows = total_rows - (idx + 1)
            eta_seconds = int(remaining_rows * avg_time_per_row) + 5
            
            from .models import ExportTask
            task_obj = ExportTask.objects.filter(pk=task_id).first()
            
            # Check for cancellation or pause first
            if task_obj and task_obj.status not in ('PENDING', 'PROCESSING'):
                # Save temp file immediately before aborting
                temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_exports')
                os.makedirs(temp_dir, exist_ok=True)
                for f in os.listdir(temp_dir):
                    if f.startswith(f"temp_{task_id}_") and f.endswith(".pkl"):
                        try:
                            os.remove(os.path.join(temp_dir, f))
                        except Exception:
                            pass
                temp_file_path = os.path.join(temp_dir, f"temp_{task_id}_{idx}.pkl")
                try:
                    with open(temp_file_path, 'wb') as pf:
                        pickle.dump(formatted_data, pf)
                except Exception:
                    pass
                raise ValueError("توسط کاربر لغو شد.")
                
            ExportTask.objects.filter(pk=task_id).update(progress=progress_pct, eta=eta_seconds)
            
            # Periodic saving (every 3000 rows) to minimize disk writes
            if idx % 3000 == 0 or idx == total_rows - 1:
                temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_exports')
                os.makedirs(temp_dir, exist_ok=True)
                for f in os.listdir(temp_dir):
                    if f.startswith(f"temp_{task_id}_") and f.endswith(".pkl"):
                        try:
                            os.remove(os.path.join(temp_dir, f))
                        except Exception:
                            pass
                temp_file_path = os.path.join(temp_dir, f"temp_{task_id}_{idx}.pkl")
                try:
                    with open(temp_file_path, 'wb') as pf:
                        pickle.dump(formatted_data, pf)
                except Exception:
                    pass
            
        balance_val = row['balance']
        if isinstance(balance_val, (int, float)):
            balance_str = "{:,.2f}".format(balance_val).rstrip('0').rstrip('.')
            if balance_val > 0:
                balance_str = f"{balance_str} +"
        else:
            balance_str = str(balance_val)
            
        allowed_waste_str = "{:,.2f}".format(row['allowed_waste']).rstrip('0').rstrip('.')
        approved_work_str = "{:,.2f}".format(row['approved_work']).rstrip('0').rstrip('.')
        total_issued_str = "{:,.2f}".format(row['total_issued']).rstrip('0').rstrip('.')
        
        pdf_row = [
            persian_text(balance_str),
            persian_text(allowed_waste_str),
            persian_text(approved_work_str),
            persian_text(total_issued_str),
            persian_text(row['unit']),
            persian_text(row['material_name']),
            persian_text(row['contractor_name'])
        ]
        formatted_data.append(pdf_row)
        
    if not formatted_data:
        formatted_data.append([persian_text('هیچ رکوردی یافت نشد'), '', '', '', '', '', ''])

    # بخش‌بندی داده‌های جدول جهت بهینه‌سازی سرعت خروجی ReportLab و جلوگیری از خطای کمبود حافظه
    # داده‌ها را به قطعات ۱۰۰۰ سطری تقسیم می‌کنیم و هر قطعه را به عنوان یک جدول جداگانه اضافه می‌کنیم.
    chunk_size = 1000
    for chunk_start in range(0, len(formatted_data), chunk_size):
        chunk_end = chunk_start + chunk_size
        chunk_rows = formatted_data[chunk_start:chunk_end]
        
        # ترکیب هدر با داده‌های قطعه
        table_content = [header_row] + chunk_rows
        
        table = Table(table_content, colWidths=[90, 80, 80, 80, 60, 200, 150])
        
        # استایل جداگانه برای هر جدول
        table_style = list(base_table_style)
        
        # رنگ‌بندی شرطی ستون موازنه
        for j, pdf_row in enumerate(chunk_rows):
            row_idx = j + 1
            # بررسی جهت رنگ ستون موازنه (pdf_row[0] همان موازنه نهایی است)
            val_str = pdf_row[0]
            if '+' in val_str:  # مازاد دریافت (بدهکار) -> قرمز
                table_style.append(('TEXTCOLOR', (0, row_idx), (0, row_idx), colors.HexColor('#dc2626')))
                table_style.append(('FONTNAME', (0, row_idx), (0, row_idx), font_bold))
            elif val_str.strip() != '0.00' and val_str.strip() != '0' and val_str.strip() != persian_text('هیچ رکوردی یافت نشد'):  # کسری (بستانکار) -> سبز
                table_style.append(('TEXTCOLOR', (0, row_idx), (0, row_idx), colors.HexColor('#16a34a')))
                table_style.append(('FONTNAME', (0, row_idx), (0, row_idx), font_bold))
                
        table.setStyle(TableStyle(table_style))
        elements.append(table)
        elements.append(Spacer(1, 15))
        
    # Clean up temp files for this task and resume_from task on success
    temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp_exports')
    if os.path.exists(temp_dir):
        for f in os.listdir(temp_dir):
            if f.startswith(f"temp_{task_id}_") or (resume_from and f.startswith(f"temp_{resume_from}_")):
                try:
                    os.remove(os.path.join(temp_dir, f))
                except Exception:
                    pass

    if task_id:
        from .models import ExportTask
        ExportTask.objects.filter(pk=task_id).update(progress=95, eta=2)
        
    # ساخت فایل PDF نهایی
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()

