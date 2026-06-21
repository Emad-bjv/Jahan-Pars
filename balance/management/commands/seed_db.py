import random
import uuid
import jdatetime
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

from balance.models import (
    Contractor, 
    WorkCategory, 
    MaterialItem, 
    WarehouseTransaction, 
    TechnicalOfficeApproval,
    GlobalMaterialBalance
)

User = get_user_model()

# ─── Static Lists of Realistic Persian Names ───────────────────────

CONTRACTORS_LIST = [
    ("پیمانکاری", "حسینیان"),
    ("سازه گستران", "آروند"),
    ("پارس ابنیه", "کارون"),
    ("مکانیک نصب", "زاگرس"),
    ("برق و ابزار دقیق", "الوند"),
    ("پیمانکاری", "جعفری"),
    ("پیشرو سازه", "شمال"),
    ("پیمانکاری", "رستمی"),
    ("تاسیسات", "مهرگان"),
    ("مهندسی و ساختمان", "زاینده‌رود"),
    ("فولاد کاران", "امید"),
    ("راه و ساختمان", "دنا"),
    ("پترو سازه", "کوشا"),
    ("پترو نصب", "خلیج فارس"),
    ("عایق کاران", "پارس"),
    ("پیمانکاری", "احمدی"),
    ("نیرو گستر", "سمنان"),
    ("نصب‌آوران", "شوشتر"),
    ("عمران کلوت", "سپاهان"),
    ("فولاد دژ", "کرمان"),
    ("پایپینگ کاران", "جنوب"),
    ("اتصالات صنعت", "تهران"),
    ("آریا صنعت", "سیرجان"),
    ("توسعه عمران", "طوس"),
    ("پیمانکاری", "رضایی"),
    ("پیمانکاری", "کریمی"),
    ("صنایع فلزی", "البرز"),
    ("گروه مهندسی", "کیان"),
    ("برنا اندیش", "خرمشهر"),
    ("تجهیزات صنعتی", "امیرکبیر"),
    ("عمران گستر", "کاسپین"),
    ("پیمانکاری", "مومنی"),
    ("پترو صنعت", "آریا"),
    ("پایپینگ گستر", "اهواز"),
    ("آبادراه", "مرکزی"),
    ("شایان بتن", "فارس"),
    ("فولاد فریم", "یزد"),
    ("نورآوران", "کرمانشاه"),
    ("تهویه گستر", "تبریز"),
    ("سازه پی", "آستارا"),
    ("پیمانکاری", "صادقیان"),
    ("پیمانکاری", "مرادی"),
    ("پیمانکاری", "نوروزی"),
    ("سازه مقاوم", "گیلان"),
    ("عایق پوشش", "مازندران"),
    ("برق کاران", "هرمزگان"),
    ("تاسیسات گاز", "بوشهر"),
    ("پیمانکاری", "شفیعی"),
    ("توسعه پترو", "همدان"),
    ("فولاد نصب", "اصفهان"),
]

CATEGORIES_AND_MATERIALS = {
    "سیویل و بتن‌ریزی": [
        ("میلگرد آجدار A3 سایز ۱۶", "شاخه", "KG", 10.0),
        ("میلگرد آجدار A3 سایز ۲۰", "شاخه", "KG", 10.0),
        ("سیمان پرتلند تیپ ۲", "کیسه ۵۰ کیلویی", "KG", 5.0),
        ("واتراستاپ PVC عرض ۲۵", "حلقه", "M", 2.0),
        ("فوم پلی‌استایرن سقفی", "بلوک", "PCS", 2.0),
        ("شن و ماسه شسته دانه‌بندی شده", "تن", "KG", 5.0),
        ("روان‌کننده بتن کربوکسیلاتی", "گالن ۲۰ لیتری", "KG", 8.0),
        ("سیم آرماتوربندی نمره ۱.۵", "کلاف", "KG", 5.0),
        ("میلگرد آجدار A3 سایز ۲۵", "شاخه", "KG", 10.0),
        ("بتن آماده رده C30", "متر مکعب", "KG", 5.0),
    ],
    "پایپینگ و لوله‌کشی صنعتی": [
        ("لوله مانیسمان ۶ اینچ Sch 40", "شاخه ۶ متری", "M", 12.0),
        ("لوله مانیسمان ۴ اینچ Sch 40", "شاخه ۶ متری", "M", 12.0),
        ("زانو ۹۰ درجه ۶ اینچ Sch 40", "عدد", "PCS", 15.0),
        ("شیر فلکه کشویی فولادی ۱۰ اینچ", "کلاس ۱۵۰", "PCS", 8.0),
        ("فلنج گلودار ۶ اینچ کلاس ۱۵۰", "عدد", "PCS", 10.0),
        ("پیچ و مهره استد بولت ۵/۸ اینچ", "عدد", "PCS", 5.0),
        ("واشر آب‌بندی اسپیرال وند ۶ اینچ", "عدد", "PCS", 5.0),
        ("شیر توپی استیل ۲ اینچ دنده‌ای", "عدد", "PCS", 5.0),
        ("لوله استنلس استیل ۳ اینچ", "شاخه ۶ متری", "M", 12.0),
        ("شیر خودکار یکطرفه ۴ اینچ", "کلاس ۳۰۰", "PCS", 8.0),
    ],
    "برق و ابزار دقیق": [
        ("کابل کنترل ۲۰ زوج زره‌دار XY", "متر", "M", 5.0),
        ("کابل قدرت ۳ در ۲.۵ آرموردار", "متر", "M", 5.0),
        ("سینی کابل عرض ۳۰ گالوانیزه", "شاخه ۳ متری", "M", 5.0),
        ("ترانسمیتر فشار فیشر مدل ۳۰۵۱", "دستگاه", "PCS", 0.0),
        ("سیم ارت نمره ۱۶ مسی بدون روکش", "متر", "M", 2.0),
        ("گلند کابل برق سایز M25 برنجی", "عدد", "PCS", 2.0),
        ("لوله فولادی کاندوئیت برق PG21", "شاخه ۳ متری", "M", 2.0),
        ("جعبه تقسیم آلومینیومی ضد انفجار", "عدد", "PCS", 5.0),
        ("تابلو توزیع برق کارگاهی", "دستگاه", "PCS", 5.0),
        ("سنسور حرارتی تیپ K", "دستگاه", "PCS", 0.0),
    ],
    "تجهیزات و سازه فلزی": [
        ("تیرآهن IPE نمره ۱۸ ذوب‌آهن", "شاخه ۱۲ متری", "KG", 5.0),
        ("ورق سیاه ضخامت ۱۰ میل فولاد مبارکه", "برگ", "KG", 5.0),
        ("الکترود جوشکاری ۶۰۱۰ آما", "کارتن ۲۰ کیلویی", "KG", 10.0),
        ("پیچ و مهره گرید ۸.۸ سایز ۲۰", "عدد", "PCS", 5.0),
        ("قوطی آهن ۴۰*۴۰ صنعتی ضخامت ۳", "شاخه ۶ متری", "M", 5.0),
        ("ناودانی نمره ۱۲ سنگین البرز", "شاخه ۱۲ متری", "KG", 5.0),
        ("ورق گالوانیزه کرکره‌ای ضخامت ۰.۶", "متر مربع", "SQM", 8.0),
        ("الکترود جوشکاری ۷۰۱۸ آما", "کارتن ۲۰ کیلویی", "KG", 10.0),
        ("نبشی نمره ۸ ضخامت ۸ میل", "شاخه ۱۲ متری", "KG", 5.0),
        ("پیچ خودکار سقفی واشردار", "عدد", "PCS", 5.0),
    ],
    "عایق‌کاری و پوشش محافظتی": [
        ("پشم سنگ لوله‌ای ۲ اینچ ضخامت ۵۰", "متر", "M", 5.0),
        ("رنگ اپوکسی زینک ریچ طوسی", "بشکه ۲۵ کیلویی", "KG", 12.0),
        ("تینر اپوکسی مخصوص زینک ریچ", "گالن ۲۰ لیتری", "KG", 12.0),
        ("نوار چسب عایق سرجوش نیاشیمی", "حلقه", "M", 5.0),
        ("ورق آلومینیوم پوشش عایق ضخامت ۰.۵", "رول", "SQM", 5.0),
        ("پشم شیشه لحافی با روکش فویل", "رول", "SQM", 5.0),
        ("رنگ پلی‌یورتان براق سفید", "بشکه ۲۰ کیلویی", "KG", 10.0),
        ("پرایمر عایق‌کاری بیتومینی", "بشکه ۲۲۰ لیتری", "KG", 5.0),
        ("ماستیک عایق‌کاری سردساز", "سطل ۲۰ کیلویی", "KG", 5.0),
        ("پرایمر اپوکسی ضد زنگ اکسید آهن", "بشکه ۲۵ کیلویی", "KG", 10.0),
    ],
    "تجهیزات مکانیکی و ثابت": [
        ("پمپ سانتریفیوژ انتقال آب", "دستگاه", "PCS", 0.0),
        ("کمپرسور هوای فشرده اسکرو", "دستگاه", "PCS", 0.0),
        ("مبدل حرارتی پوسته و لوله", "دستگاه", "PCS", 0.0),
        ("گیربکس صنعتی شافت مستقیم", "دستگاه", "PCS", 0.0),
        ("فن هوادهی سانتریفیوژ صنعتی", "دستگاه", "PCS", 0.0),
        ("مخزن تحت فشار ذخیره نیتروژن", "دستگاه", "PCS", 0.0),
        ("اتصالات لرزه‌گیر لاستیکی فلنج‌دار", "عدد", "PCS", 2.0),
        ("الکتروموتور ۵.۵ کیلووات موتوژن", "دستگاه", "PCS", 0.0),
        ("سایلنسر اگزوز موتور ژنراتور", "عدد", "PCS", 0.0),
        ("تله بخار فلوتری سایز ۱ اینچ", "عدد", "PCS", 0.0),
    ]
}

CONTRACT_SUBJECTS = [
    "عملیات محوطه‌سازی و بتن‌ریزی فونداسیون",
    "نصب لوله‌کشی آب آتش‌نشانی و شبکه زیرزمینی",
    "کابل‌کشی سیستم ابزار دقیق و کنترل واحد ۱۰۱",
    "ساخت و نصب پایپ رک‌های فلزی ناحیه شرقی",
    "رنگ‌آمیزی پایپینگ و استراکچر فلزی خطوط اصلی",
    "اجرای فونداسیون تجهیزات دوار و پمپ‌ها",
    "کابل‌کشی فشار متوسط پست برق جانبی",
    "لوله‌کشی گاز طبیعی واحد یوتیلیتی",
    "عایق‌کاری حرارتی لوله‌های بخار داغ واحد تقطیر",
    "نصب و راه‌اندازی کمپرسورهای هوای فشرده ابزار دقیق",
    "ساخت مخازن اتمسفریک ذخیره سوخت",
    "نصب سیستم ارتینگ و صاعقه‌گیر محوطه مخازن",
    "اجرای عایق ضد حریق روی استراکچر فلزی گالری‌ها",
    "عملیات بتن‌ریزی کانال‌های کابل و لوله کارگاه",
    "لوله‌کشی خنک‌کننده رفت و برگشت پمپ‌ها",
]

class Command(BaseCommand):
    help = 'Massive Database Seeding with 1 Million highly realistic records'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Starting fresh database seeding (1M records)..."))
        
        # Configuration
        BATCH_SIZE = 10000
        NUM_IN_TRANSACTIONS = 450000
        NUM_OUT_TRANSACTIONS = 350000
        NUM_APPROVALS = 200000

        # Get current date in Persian (1405-xx-xx)
        today = jdatetime.date.today()
        self.stdout.write(f"Today is (Jalali): {today}")

        # Date distribution generator to match week, month, 3 months, and year filters
        def random_jdate():
            r = random.random()
            if r < 0.1:
                # Last 7 days
                days_ago = random.randint(0, 6)
            elif r < 0.35:
                # Last 30 days
                days_ago = random.randint(7, 29)
            elif r < 0.75:
                # Last 90 days
                days_ago = random.randint(30, 89)
            else:
                # Last 365 days
                days_ago = random.randint(90, 365)
            
            return today - jdatetime.timedelta(days=days_ago)

        # 1. Clear Existing Test Data (dependency order)
        self.stdout.write("Clearing previous test data...")
        with transaction.atomic():
            TechnicalOfficeApproval.objects.all().delete()
            WarehouseTransaction.objects.all().delete()
            GlobalMaterialBalance.objects.all().delete()
            MaterialItem.objects.all().delete()
            WorkCategory.objects.all().delete()
            Contractor.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("  -> Previous test data cleared successfully!"))

        # 2. Creating Contractors
        self.stdout.write("Creating Contractors...")
        contractor_objs = []
        for first, last in CONTRACTORS_LIST:
            contractor_objs.append(Contractor(first_name=first, last_name=last))
        Contractor.objects.bulk_create(contractor_objs)
        contractors = list(Contractor.objects.all())
        self.stdout.write(self.style.SUCCESS(f"  -> Created {len(contractors)} contractors."))

        # 3. Creating Work Categories and Material Items
        self.stdout.write("Creating Work Categories and Material Items...")
        category_objs = []
        for cat_name in CATEGORIES_AND_MATERIALS.keys():
            category_objs.append(WorkCategory(name=cat_name, description=f"فعالیت‌های حوزه {cat_name}"))
        WorkCategory.objects.bulk_create(category_objs)
        categories = {c.name: c for c in WorkCategory.objects.all()}

        material_objs = []
        for cat_name, items in CATEGORIES_AND_MATERIALS.items():
            cat_obj = categories[cat_name]
            for mat_name, size, unit, waste_pct in items:
                material_objs.append(MaterialItem(
                    name=mat_name,
                    work_category=cat_obj,
                    size=size,
                    unit=unit,
                    waste_percentage=Decimal(str(waste_pct)),
                    current_stock=Decimal('0.00'),
                    low_stock_threshold=Decimal('500.00') if unit != 'PCS' else Decimal('50.00')
                ))
        MaterialItem.objects.bulk_create(material_objs)
        materials = list(MaterialItem.objects.all())
        material_id_map = {m.id: m for m in materials}
        self.stdout.write(self.style.SUCCESS(f"  -> Created {len(materials)} material items."))

        # 4. Creating IN Transactions (bulk, chunk-based)
        self.stdout.write(f"Generating {NUM_IN_TRANSACTIONS} IN transactions...")
        in_txs = []
        material_in_totals = {m.id: Decimal('0.00') for m in materials}
        total_in_created = 0

        for idx in range(1, NUM_IN_TRANSACTIONS + 1):
            mat = random.choice(materials)
            qty = Decimal(str(round(random.uniform(500.0, 5000.0), 2)))
            material_in_totals[mat.id] += qty

            in_txs.append(WarehouseTransaction(
                transaction_type='IN',
                material=mat,
                quantity=qty,
                bill_of_lading=f"BOL-{random.randint(100000, 999999)}",
                date=random_jdate(),
                created_at=jdatetime.datetime.now()
            ))

            if len(in_txs) >= BATCH_SIZE:
                WarehouseTransaction.objects.bulk_create(in_txs)
                total_in_created += len(in_txs)
                in_txs = []
                if total_in_created % 50000 == 0:
                    self.stdout.write(f"  -> Saved {total_in_created}/{NUM_IN_TRANSACTIONS} IN transactions...")

        if in_txs:
            WarehouseTransaction.objects.bulk_create(in_txs)
            total_in_created += len(in_txs)
        self.stdout.write(self.style.SUCCESS(f"  -> Successfully created {total_in_created} IN transactions."))

        # 5. Creating OUT Transactions (bulk, chunk-based, negative stock protection)
        self.stdout.write(f"Generating {NUM_OUT_TRANSACTIONS} OUT transactions...")
        out_txs = []
        material_out_totals = {m.id: Decimal('0.00') for m in materials}
        active_material_ids = [m.id for m in materials if material_in_totals[m.id] > Decimal('1000.0')]
        
        # We will collect outbound info to generate matching approvals later
        outbound_samples = []
        total_out_created = 0

        for idx in range(1, NUM_OUT_TRANSACTIONS + 1):
            if not active_material_ids:
                self.stdout.write(self.style.WARNING("  -> Out of available stock for OUT transactions. Stopping."))
                break

            mat_id = random.choice(active_material_ids)
            available_stock = material_in_totals[mat_id] - material_out_totals[mat_id]

            if available_stock <= Decimal('200.0'):
                active_material_ids.remove(mat_id)
                continue

            # Limit outgoing quantity to keep stock healthy
            max_qty = float(min(Decimal('400.00'), available_stock / 15))
            qty = Decimal(str(round(random.uniform(1.0, max(1.1, max_qty)), 2)))
            material_out_totals[mat_id] += qty

            contractor = random.choice(contractors)
            contract_num = f"JP-CON-{random.randint(1001, 1050)}"
            contract_subj = random.choice(CONTRACT_SUBJECTS)
            tx_date = random_jdate()

            out_txs.append(WarehouseTransaction(
                transaction_type='OUT',
                material_id=mat_id,
                contractor=contractor,
                quantity=qty,
                contract_number=contract_num,
                contract_subject=contract_subj,
                date=tx_date,
                created_at=jdatetime.datetime.now()
            ))

            # Store for approvals mapping
            outbound_samples.append((contractor.id, mat_id, contract_num, contract_subj, qty, tx_date))

            if len(out_txs) >= BATCH_SIZE:
                WarehouseTransaction.objects.bulk_create(out_txs)
                total_out_created += len(out_txs)
                out_txs = []
                if total_out_created % 50000 == 0:
                    self.stdout.write(f"  -> Saved {total_out_created}/{NUM_OUT_TRANSACTIONS} OUT transactions...")

        if out_txs:
            WarehouseTransaction.objects.bulk_create(out_txs)
            total_out_created += len(out_txs)
        self.stdout.write(self.style.SUCCESS(f"  -> Successfully created {total_out_created} OUT transactions."))

        # 6. Re-calculating Material stocks (current_stock)
        self.stdout.write("Updating MaterialItem current_stock counts...")
        for mat in materials:
            mat.current_stock = material_in_totals[mat.id] - material_out_totals[mat.id]
        MaterialItem.objects.bulk_update(materials, ['current_stock'], batch_size=BATCH_SIZE)
        self.stdout.write(self.style.SUCCESS("  -> Stock counts updated!"))

        # 7. Creating Technical Office Approvals (bulk, chunk-based, mapped to OUT transactions)
        self.stdout.write(f"Generating {NUM_APPROVALS} Technical Office Approvals...")
        approvals = []
        total_appr_created = 0

        for idx in range(1, NUM_APPROVALS + 1):
            if not outbound_samples:
                break
            
            # Sample an outbound transaction info to ensure realistic mapping
            c_id, m_id, contract_num, contract_subj, out_qty, tx_date = random.choice(outbound_samples)
            
            # Approval qty is usually between 85% and 98% of the collection qty
            appr_qty = out_qty * Decimal(str(round(random.uniform(0.85, 0.98), 2)))
            
            # Approval date must be on or after the exit transaction date
            days_after = random.randint(0, 20)
            app_date = tx_date + jdatetime.timedelta(days=days_after)
            if app_date > today:
                app_date = today

            approvals.append(TechnicalOfficeApproval(
                contractor_id=c_id,
                material_id=m_id,
                approved_quantity=appr_qty,
                contract_number=contract_num,
                contract_subject=contract_subj,
                approval_date=app_date,
                created_at=jdatetime.datetime.now()
            ))

            if len(approvals) >= BATCH_SIZE:
                TechnicalOfficeApproval.objects.bulk_create(approvals)
                total_appr_created += len(approvals)
                approvals = []
                if total_appr_created % 50000 == 0:
                    self.stdout.write(f"  -> Saved {total_appr_created}/{NUM_APPROVALS} approvals...")

        if approvals:
            TechnicalOfficeApproval.objects.bulk_create(approvals)
            total_appr_created += len(approvals)
        self.stdout.write(self.style.SUCCESS(f"  -> Successfully created {total_appr_created} Technical Office Approvals."))

        # 8. Rebuild precalculated global material balance table
        self.stdout.write("Rebuilding GlobalMaterialBalance precalculated table...")
        from balance.services import rebuild_all_global_balances
        rebuild_all_global_balances()
        self.stdout.write(self.style.SUCCESS("  -> GlobalMaterialBalance table populated!"))

        self.stdout.write(self.style.SUCCESS("Database seeding with 1M records completed successfully!"))
