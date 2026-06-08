import random
import datetime
import jdatetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from balance.models import Contractor, WorkCategory, MaterialItem, WarehouseTransaction, TechnicalOfficeApproval

class Command(BaseCommand):
    help = 'Seeds the database with highly realistic and logically consistent test data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )
        parser.add_argument(
            '--size',
            type=int,
            default=1,
            help='Multiplier for the size of the generated data',
        )

    def handle(self, *args, **options):
        clear = options['clear']
        db_size = int(options['size'])

        if clear:
            self.stdout.write("Clearing existing data...")
            TechnicalOfficeApproval.objects.all().delete()
            WarehouseTransaction.objects.all().delete()
            MaterialItem.objects.all().delete()
            WorkCategory.objects.all().delete()
            Contractor.objects.all().delete()

        # 1. Generate Work Categories
        categories_data = [
            ("پایپینگ (Piping)", "لوله‌کشی صنعتی سایت"),
            ("سیویل (Civil)", "عملیات خاکی و بتن‌ریزی"),
            ("استراکچر (Structure)", "سازه فلزی"),
            ("برق (Electrical)", "کابل‌کشی و تجهیزات برقی"),
            ("ابزار دقیق (Instrument)", "تجهیزات کنترلی"),
        ]
        
        categories = []
        for name, desc in categories_data:
            cat, _ = WorkCategory.objects.get_or_create(name=name, defaults={'description': desc})
            categories.append(cat)

        self.stdout.write(f"Created {len(categories)} Work Categories.")

        # 2. Generate Contractors with structural categories
        contractors_data = [
            # Piping
            ("شرکت", "سازه گستر اروند", "Piping"),
            ("پیمانکاری", "حدید نصب تهران", "Piping"),
            ("شرکت", "پایپینگ صنعت پایتخت", "Piping"),
            # Civil
            ("شرکت", "پارس بتن زاگرس", "Civil"),
            ("گروه", "عمران و ابنیه ساختار", "Civil"),
            ("پیمانکاری", "خاک‌ریزان سازه پویا", "Civil"),
            # Structure
            ("شرکت", "نصب سوله طلیعه دماوند", "Structure"),
            ("گروه", "استراکچر فلزی سهند", "Structure"),
            # Electrical
            ("شرکت", "هدایت الکتریک البرز", "Electrical"),
            ("پیمانکاری", "مهرگان نیرو زاگرس", "Electrical"),
            # Instrument
            ("فنی مهندسی", "ابزار کنترل کارون", "Instrument"),
            ("شرکت", "پترو کنترل آریا", "Instrument"),
        ]

        contractors = []
        for i in range(db_size):
            for first_name, last_name, cat_name in contractors_data:
                suffix = f" - فاز {i+1}" if i > 0 else ""
                c, _ = Contractor.objects.get_or_create(
                    first_name=first_name,
                    last_name=f"{last_name}{suffix}"
                )
                contractors.append((c, cat_name))
        
        self.stdout.write(f"Created {len(contractors)} Contractors.")

        # 3. Generate Materials
        materials_templates = [
            ("لوله بدون درز (Seamless Pipe)", "Piping", ["1/2\"", "3/4\"", "1\"", "2\"", "4\"", "6\"", "8\"", "10\"", "12\"", "16\"", "20\"", "24\""], ["Carbon Steel A106", "Stainless Steel 316L", "Alloy Steel"], ["SCH 40", "SCH 80", "STD", "XS"], "M", 3.5),
            ("لوله درزدار (Welded Pipe)", "Piping", ["10\"", "12\"", "16\"", "20\"", "24\"", "36\"", "48\""], ["Carbon Steel API 5L"], ["STD", "XS", "12mm", "16mm"], "M", 3.0),
            ("میلگرد آجدار", "Civil", ["Φ8", "Φ10", "Φ12", "Φ14", "Φ16", "Φ18", "Φ20", "Φ22", "Φ25", "Φ28", "Φ32"], ["A3", "A4"], [None], "KG", 5.0),
            ("ورق فولادی", "Structure", [None], ["ST37", "ST52", "A516 Gr70"], ["2mm", "5mm", "8mm", "10mm", "15mm", "20mm", "25mm"], "KG", 4.0),
            ("کابل برق", "Electrical", ["1x150", "3x25", "3x50", "4x10", "4x16", "4x25", "2x1.5"], ["Copper/PVC", "Aluminum/XLPE"], [None], "M", 2.0),
            ("تیرآهن", "Structure", ["IPE 140", "IPE 160", "IPE 180", "IPE 200", "HEA 200", "HEA 240"], ["ST37"], [None], "KG", 3.0),
            ("الکترود جوشکاری", "Piping", ["E6010", "E7018", "E316L", "E7010"], ["Cellulosic", "Low Hydrogen"], ["2.5mm", "3.2mm", "4.0mm"], "KG", 8.0),
        ]

        materials = []
        for name, cat_name, sizes, types, thicknesses, unit, waste in materials_templates:
            cat = next((c for c in categories if cat_name in c.name), None)
            if not cat:
                continue
            for mat_size in sizes:
                for mat_type in types:
                    for thick in thicknesses:
                        m, _ = MaterialItem.objects.get_or_create(
                            name=name,
                            work_category=cat,
                            size=mat_size,
                            material_type=mat_type,
                            thickness=thick,
                            defaults={'unit': unit, 'waste_percentage': Decimal(str(waste))}
                        )
                        materials.append(m)

        self.stdout.write(f"Created {len(materials)} Materials.")

        # 4. Generate WAREHOUSE IN transactions to stock up the warehouse
        self.stdout.write("Generating WAREHOUSE IN transactions...")
        in_txns = []
        start_date = datetime.date.today() - datetime.timedelta(days=730) # 2 years ago
        end_date = datetime.date.today()
        
        def random_date_between(s_date, e_date):
            days = random.randint(0, (e_date - s_date).days)
            return s_date + datetime.timedelta(days=days)

        for mat in materials:
            # We add 2 massive entries for each material
            for j in range(2):
                qty = Decimal(str(random.randint(500000, 2000000)))
                d = random_date_between(start_date, end_date - datetime.timedelta(days=100))
                jd = jdatetime.date.fromgregorian(date=d)
                in_txns.append(WarehouseTransaction(
                    transaction_type='IN',
                    material=mat,
                    quantity=qty,
                    bill_of_lading=f"BOL-{random.randint(10000, 99999)}",
                    date=jd
                ))
        
        WarehouseTransaction.objects.bulk_create(in_txns)
        self.stdout.write(f"Created {len(in_txns)} WAREHOUSE IN transactions.")

        # 5. Define Contract Subjects and generate logical combinations
        contract_subjects_by_cat = {
            "Piping": [
                "پیش‌ساخت و نصب لوله‌کشی واحدهای فرآیندی U-100",
                "نصب اسپول‌ها و شیرآلات واحد بازیابی گوگرد U-120",
                "اجرای پایپینگ زیرزمینی و روزمینی بخش یوتیلیتی U-160",
                "لوله‌کشی صنعتی خطوط خوراک و محصول مخازن ذخیره U-140",
            ],
            "Civil": [
                "عملیات بتن‌ریزی فونداسیون کمپرسورها و پمپ‌های اصلی U-100",
                "خاکبرداری و ساخت حوضچه‌ها و کانال‌های بتنی خطوط لوله",
                "اجرای فونداسیون مخازن کروی و استوانه‌ای واحد ذخیره",
                "عملیات بتن‌ریزی سازه پایپ‌رک فلزی فاز ۲",
            ],
            "Structure": [
                "ساخت، مونتاژ و نصب سازه‌های فلزی (پایپ‌رک) واحدها",
                "نصب استراکچر گالری‌ها و شلترهای بتنی و فلزی واحد ۱۰۰",
                "پیش‌ساخت و نصب پلتفرم‌های فلزی دور مخازن فرآیندی",
            ],
            "Electrical": [
                "عملیات کابل‌کشی کابل‌های قدرت و ارتینگ پست پاساژ ۲",
                "سیستم کابل‌کشی روشنایی و نصب تجهیزات الکتریکی محوطه صنعتی",
                "سینی‌گذاری و کابل‌کشی قدرت موتورها و پمپ‌های فاز ۱",
            ],
            "Instrument": [
                "نصب، کالیبراسیون و سیم‌کشی ابزار دقیق واحد فرآیندی U-100",
                "لوله‌کشی هوا و سیستم‌های کنترلی شیرهای ابزار دقیق",
                "نصب تجهیزات کنترلی اتاق فرمان و تست لوپ فاز ۲",
            ],
        }

        out_txns_to_create = []
        approvals_to_create = []

        self.stdout.write("Generating OUT and Approval transactions based on realistic scenarios...")

        # Keep track of unique contract numbers globally to avoid overlaps
        contract_id_counter = 1000

        # We will loop through the contractors list
        for contractor_obj, cat_name in contractors:
            # Each contractor will have 1 or 2 contracts
            num_contracts = random.randint(1, 2)
            
            for c_idx in range(num_contracts):
                contract_id_counter += 1
                contract_number = f"CN-{contract_id_counter}"
                
                # Choose a contract subject based on category
                subjects = contract_subjects_by_cat.get(cat_name, ["عملیات اجرایی کارگاه"])
                contract_subject = random.choice(subjects)
                
                # Get materials matching this contractor's category
                cat_materials = [m for m in materials if cat_name in m.work_category.name]
                if not cat_materials:
                    continue
                
                # Pick a subset of 3 to 6 materials for this contract
                num_mats = min(len(cat_materials), random.randint(3, 6))
                selected_materials = random.sample(cat_materials, num_mats)
                
                # Assign a base start date for this contract (between 600 days ago and 60 days ago)
                contract_start_day = random_date_between(
                    datetime.date.today() - datetime.timedelta(days=600),
                    datetime.date.today() - datetime.timedelta(days=60)
                )

                for mat in selected_materials:
                    # Choose a scenario for this material under this contract
                    # 1: Ideal (35%), 2: Surplus (35%), 3: Deficit (15%), 4: Under Review (10%), 5: Pure Deficit/Anomaly (5%)
                    scenario = random.choices(
                        population=[1, 2, 3, 4, 5],
                        weights=[35, 35, 15, 10, 5],
                        k=1
                    )[0]

                    waste_pct = mat.waste_percentage

                    if scenario == 5:
                        # Pure Deficit/Anomaly: Approved quantity > 0 but Issued quantity = 0
                        # No OUT transactions generated!
                        approved_qty = Decimal(str(random.randint(50, 800)))
                        
                        # Generate approval
                        appr_date = jdatetime.date.fromgregorian(date=contract_start_day + datetime.timedelta(days=random.randint(10, 30)))
                        approvals_to_create.append(TechnicalOfficeApproval(
                            contractor=contractor_obj,
                            material=mat,
                            approved_quantity=approved_qty,
                            contract_number=contract_number,
                            contract_subject=contract_subject,
                            approval_date=appr_date
                        ))
                    else:
                        # Scenario 1, 2, 3, 4: Generate OUT transactions first
                        num_outs = random.randint(1, 3)
                        total_issued = Decimal('0')
                        
                        for o_idx in range(num_outs):
                            qty = Decimal(str(random.randint(100, 3000)))
                            total_issued += qty
                            
                            # OUT transaction date
                            out_date = jdatetime.date.fromgregorian(
                                date=contract_start_day + datetime.timedelta(days=o_idx * random.randint(5, 15))
                            )
                            
                            out_txns_to_create.append(WarehouseTransaction(
                                transaction_type='OUT',
                                material=mat,
                                quantity=qty,
                                contractor=contractor_obj,
                                contract_number=contract_number,
                                contract_subject=contract_subject,
                                date=out_date
                            ))
                        
                        # Now generate approval based on the scenario
                        if scenario == 1:
                            # Ideal: Balance is exactly 0
                            # Q_issued = Q_approved * (1 + waste_percentage/100) -> Q_approved = Q_issued / (1 + waste_percentage/100)
                            approved_qty = (total_issued / (Decimal('1') + (waste_pct / Decimal('100')))).quantize(Decimal('0.01'))
                            
                            appr_date = jdatetime.date.fromgregorian(date=contract_start_day + datetime.timedelta(days=45))
                            approvals_to_create.append(TechnicalOfficeApproval(
                                contractor=contractor_obj,
                                material=mat,
                                approved_quantity=approved_qty,
                                contract_number=contract_number,
                                contract_subject=contract_subject,
                                approval_date=appr_date
                            ))
                        elif scenario == 2:
                            # Surplus: Contractor has leftovers. Q_approved < Ideal
                            ideal_approved = total_issued / (Decimal('1') + (waste_pct / Decimal('100')))
                            approved_qty = (ideal_approved * Decimal(str(round(random.uniform(0.50, 0.85), 2)))).quantize(Decimal('0.01'))
                            
                            appr_date = jdatetime.date.fromgregorian(date=contract_start_day + datetime.timedelta(days=45))
                            approvals_to_create.append(TechnicalOfficeApproval(
                                contractor=contractor_obj,
                                material=mat,
                                approved_quantity=approved_qty,
                                contract_number=contract_number,
                                contract_subject=contract_subject,
                                approval_date=appr_date
                            ))
                        elif scenario == 3:
                            # Deficit: Contractor has deficit. Q_approved > Ideal
                            ideal_approved = total_issued / (Decimal('1') + (waste_pct / Decimal('100')))
                            approved_qty = (ideal_approved * Decimal(str(round(random.uniform(1.05, 1.25), 2)))).quantize(Decimal('0.01'))
                            
                            appr_date = jdatetime.date.fromgregorian(date=contract_start_day + datetime.timedelta(days=45))
                            approvals_to_create.append(TechnicalOfficeApproval(
                                contractor=contractor_obj,
                                material=mat,
                                approved_quantity=approved_qty,
                                contract_number=contract_number,
                                contract_subject=contract_subject,
                                approval_date=appr_date
                            ))
                        elif scenario == 4:
                            # Under Review: No approval is generated at all.
                            pass

        # Bulk create all OUT transactions and Approvals
        WarehouseTransaction.objects.bulk_create(out_txns_to_create)
        self.stdout.write(f"Created {len(out_txns_to_create)} WAREHOUSE OUT transactions.")

        TechnicalOfficeApproval.objects.bulk_create(approvals_to_create)
        self.stdout.write(f"Created {len(approvals_to_create)} Technical Office Approvals.")

        self.stdout.write('Calculating current_stock for all materials...')
        from django.db.models import Sum
        from decimal import Decimal
        for mat in MaterialItem.objects.all():
            total_in = WarehouseTransaction.objects.filter(material=mat, transaction_type='IN').aggregate(Sum('quantity'))['quantity__sum'] or Decimal('0')
            total_out = WarehouseTransaction.objects.filter(material=mat, transaction_type='OUT').aggregate(Sum('quantity'))['quantity__sum'] or Decimal('0')
            mat.current_stock = total_in - total_out
            mat.save()

        self.stdout.write(self.style.SUCCESS('Successfully seeded database with logically consistent, highly realistic test data!'))
