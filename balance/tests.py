from django.test import TestCase
from decimal import Decimal
from datetime import date
from .models import Contractor, MaterialItem, WorkCategory, WarehouseTransaction, TechnicalOfficeApproval
from .utils import normalize_persian_text
from .services import generate_material_balance_excel, generate_global_material_balance_excel

class NormalizerTests(TestCase):
    def test_normalize_persian_text(self):
        self.assertEqual(normalize_persian_text("علي"), "علی")
        self.assertEqual(normalize_persian_text("پيمانكار"), "پیمانکار")
        self.assertEqual(normalize_persian_text("متريال‌جديد"), "متریال جدید")
        self.assertEqual(normalize_persian_text("  فاصله   زیاد  "), "فاصله زیاد")


class BalanceMathTests(TestCase):
    def setUp(self):
        # ساخت دیتا پایه
        self.category = WorkCategory.objects.create(name="پایپینگ")
        self.material = MaterialItem.objects.create(
            name="لوله",
            work_category=self.category,
            unit='M',
            waste_percentage=Decimal('10.00')
        )
        
    def test_contractor_creation_and_normalization(self):
        # ساخت یک رکورد متریال ورود برای جلوگیری از خطای موجودی
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('200'),
            date=date.today()
        )
        
        # ساخت پیمانکار مستقیم
        contractor = Contractor.objects.create(first_name="علی", last_name="رضایی")
        
        # ساخت تراکنش خروج با پیمانکار
        WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100'),
            contractor=contractor,
            contract_number="123",
            date=date.today()
        )
        
        self.assertEqual(Contractor.objects.count(), 1)
        self.assertEqual(WarehouseTransaction.objects.filter(transaction_type='OUT').first().contractor.first_name, "علی")

    def test_excel_generation_no_error(self):
        contractor = Contractor.objects.create(first_name="تست", last_name="پیمانکار")
        
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('200'),
            date=date.today()
        )
        
        WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100'),
            contractor=contractor,
            date=date.today()
        )
        
        TechnicalOfficeApproval.objects.create(
            contractor=contractor,
            material=self.material,
            approved_quantity=Decimal('80'),
            approval_date=date.today()
        )
        
        # فقط می‌خواهیم مطمئن شویم خطا نمی‌دهد و یک فایل معتبر خروجی می‌دهد
        wb_bytes = generate_material_balance_excel()
        self.assertIsNotNone(wb_bytes)
        self.assertIsInstance(wb_bytes, bytes)
        self.assertGreater(len(wb_bytes), 0)

    def test_global_excel_generation_no_error(self):
        contractor1 = Contractor.objects.create(first_name="تست1", last_name="پیمانکار")
        contractor2 = Contractor.objects.create(first_name="تست2", last_name="پیمانکار")
        
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('200'),
            date=date.today()
        )
        
        WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100'),
            contractor=contractor1,
            date=date.today()
        )
        WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('50'),
            contractor=contractor2,
            date=date.today()
        )
        
        TechnicalOfficeApproval.objects.create(
            contractor=contractor1,
            material=self.material,
            approved_quantity=Decimal('80'),
            approval_date=date.today()
        )
        
        wb_bytes = generate_global_material_balance_excel()
        self.assertIsNotNone(wb_bytes)
        self.assertIsInstance(wb_bytes, bytes)
        self.assertGreater(len(wb_bytes), 0)

    def test_jalali_date_field(self):
        import jdatetime
        contractor = Contractor.objects.create(first_name="مهدی", last_name="کریمی")
        
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('200'),
            date=jdatetime.date(1402, 5, 10)
        )
        
        # ثبت تراکنش با استفاده از jdatetime.date
        j_date = jdatetime.date(1402, 5, 10)
        txn = WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100'),
            contractor=contractor,
            date=j_date
        )
        
        # بازیابی تراکنش و بررسی نوع فیلد تاریخ
        retrieved_txn = WarehouseTransaction.objects.get(pk=txn.pk)
        self.assertIsInstance(retrieved_txn.date, jdatetime.date)
        self.assertEqual(retrieved_txn.date.year, 1402)
        self.assertEqual(retrieved_txn.date.month, 5)
        self.assertEqual(retrieved_txn.date.day, 10)
        
        # تست فیلتر کردن با شیء jdatetime.date
        self.assertTrue(WarehouseTransaction.objects.filter(date=j_date).exists())

