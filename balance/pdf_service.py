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


def get_balance_pdf_response(contractor_id=None, material_id=None, from_date=None, to_date=None):
    """
    تولید گزارش PDF رسمی از موازنه متریال
    """
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
        date_str = f"بازه زمانی: {from_date or 'ابتدا'} تا {to_date or 'انتها'}"
        elements.append(Paragraph(persian_text(date_str), header_style))
    
    if contractor_id:
        try:
            contractor = Contractor.objects.get(id=contractor_id)
            elements.append(Paragraph(persian_text(f"پیمانکار: {contractor.get_full_name()}"), header_style))
        except Contractor.DoesNotExist:
            pass
            
    if material_id:
        try:
            material = MaterialItem.objects.get(id=material_id)
            elements.append(Paragraph(persian_text(f"متریال: {material.name} ({material.get_unit_display()})"), header_style))
        except MaterialItem.DoesNotExist:
            pass
            
    elements.append(Spacer(1, 20))
    
    # ─── استخراج داده‌ها ──────────────────────────────────────────────────────
    contractors = Contractor.objects.all().order_by('first_name', 'last_name')
    if contractor_id:
        contractors = contractors.filter(id=contractor_id)
        
    materials = MaterialItem.objects.all().order_by('name')
    if material_id:
        materials = materials.filter(id=material_id)
        
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
