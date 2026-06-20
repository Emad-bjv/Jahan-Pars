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

    def test_pdf_generation_under_review(self):
        from .pdf_service import get_balance_pdf_response
        
        # پیمانکار ۱: تراکنش خروج دارد، تاییدیه ندارد -> باید در وضعیت "تحت بررسی" قرار بگیرد
        contractor1 = Contractor.objects.create(first_name="پیمانکار", last_name="اول")
        # پیمانکار ۲: تراکنش خروج دارد، تاییدیه هم دارد -> نباید در وضعیت "تحت بررسی" باشد
        contractor2 = Contractor.objects.create(first_name="پیمانکار", last_name="دوم")
        
        # موجودی انبار برای متریال
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('500'),
            date=date.today()
        )
        
        # خروج برای پیمانکار اول
        WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100'),
            contractor=contractor1,
            date=date.today()
        )
        
        # خروج و تاییدیه برای پیمانکار دوم
        WarehouseTransaction.objects.create(
            transaction_type='OUT',
            material=self.material,
            quantity=Decimal('100'),
            contractor=contractor2,
            date=date.today()
        )
        TechnicalOfficeApproval.objects.create(
            contractor=contractor2,
            material=self.material,
            approved_quantity=Decimal('90'),
            approval_date=date.today()
        )
        
        # تولید PDF با فیلتر under_review
        response = get_balance_pdf_response(status_filter='under_review')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        
        # طول PDF باید بیشتر از صفر باشد
        self.assertGreater(len(response.content), 0)

    def test_pdf_generation_multiple_filters(self):
        from .pdf_service import get_balance_pdf_response
        
        contractor1 = Contractor.objects.create(first_name="پیمانکار", last_name="اول")
        contractor2 = Contractor.objects.create(first_name="پیمانکار", last_name="دوم")
        
        # موجودی انبار برای متریال
        WarehouseTransaction.objects.create(
            transaction_type='IN',
            material=self.material,
            quantity=Decimal('500'),
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
            quantity=Decimal('150'),
            contractor=contractor2,
            date=date.today()
        )
        
        # تولید PDF با فیلتر چندتایی
        response = get_balance_pdf_response(contractor_ids=[contractor1.id, contractor2.id], material_ids=[self.material.id])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertGreater(len(response.content), 0)


from rest_framework.test import APITestCase
from django.contrib.auth import get_user_model
from rest_framework import status

User = get_user_model()

class MaterialAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username="testuser", password="password", email="test@test.com")
        self.user.role = "TECHNICAL"
        self.user.save()
        self.client.force_authenticate(user=self.user)
        self.category = WorkCategory.objects.create(name="ابزاردقیق")

    def test_material_get_or_create(self):
        # 1. Create a material
        data = {
            "name": "کابل",
            "work_category": self.category.id,
            "size": "10 mm",
            "material_type": "مسی",
            "thickness": "2 mm",
            "unit": "M",
            "waste_percentage": "2.00",
            "low_stock_threshold": "0"
        }
        res1 = self.client.post("/api/materials/", data, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', res1.data)
        first_id = res1.data['id']

        # 2. Try to create the duplicate material again
        res2 = self.client.post("/api/materials/", data, format='json')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], first_id)

    def test_material_update_duplicate_blocked(self):
        # 1. Create first material
        data1 = {
            "name": "کابل A",
            "work_category": self.category.id,
            "size": "10 mm",
            "material_type": "مسی",
            "thickness": "2 mm",
            "unit": "M",
            "waste_percentage": "2.00",
            "low_stock_threshold": "0"
        }
        res1 = self.client.post("/api/materials/", data1, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        first_id = res1.data['id']

        # 2. Create second material with different specs
        data2 = {
            "name": "کابل B",
            "work_category": self.category.id,
            "size": "10 mm",
            "material_type": "مسی",
            "thickness": "2 mm",
            "unit": "M",
            "waste_percentage": "2.00",
            "low_stock_threshold": "0"
        }
        res2 = self.client.post("/api/materials/", data2, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        second_id = res2.data['id']

        # 3. Update second material to match the first material's name
        update_data = {
            "name": "کابل A",
            "work_category": self.category.id,
            "size": "10 mm",
            "material_type": "مسی",
            "thickness": "2 mm",
            "unit": "M",
            "waste_percentage": "2.00"
        }
        res_update = self.client.put(f"/api/materials/{second_id}/", update_data, format='json')
        self.assertEqual(res_update.status_code, status.HTTP_400_BAD_REQUEST)


