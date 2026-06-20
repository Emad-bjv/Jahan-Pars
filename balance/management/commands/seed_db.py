import random
import uuid
import jdatetime
from decimal import Decimal
from faker import Faker

from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

from balance.models import (
    Contractor, 
    WorkCategory, 
    MaterialItem, 
    WarehouseTransaction, 
    TechnicalOfficeApproval
)

User = get_user_model()
fake = Faker('fa_IR')

class Command(BaseCommand):
    help = 'Massive Database Seeding for Stress Testing (Optimized with bulk_create)'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING("Starting massive database seeding..."))
        
        # Configuration
        BATCH_SIZE = 5000
        NUM_WORK_CATEGORIES = 20
        NUM_MATERIALS = 500
        NUM_CONTRACTORS = 200
        NUM_IN_TRANSACTIONS = 60000
        NUM_OUT_TRANSACTIONS = 50000
        NUM_APPROVALS = 30000

        # Optional: create test users if needed
        # We assume users already exist, or we can bypass user logic since WarehouseTransaction
        # doesn't strictly have a foreign key to user in this specific schema structure (based on models.py)
        # Wait, WarehouseTransaction in models.py doesn't have created_by. It only has created_at!
        # If AuditLog is tied to users, bulk_create bypassing save() will automatically ignore AuditLog creation.

        # 1. Work Categories
        self.stdout.write("1. Creating Work Categories...")
        cats = []
        for i in range(NUM_WORK_CATEGORIES):
            cats.append(WorkCategory(
                name=f"{fake.company()} - {uuid.uuid4().hex[:6]}",
                description=fake.text(max_nb_chars=100)
            ))
        WorkCategory.objects.bulk_create(cats, batch_size=BATCH_SIZE)
        work_categories = list(WorkCategory.objects.all())

        # 2. Materials
        self.stdout.write("2. Creating Materials...")
        units = ['KG', 'M', 'SQM', 'PCS']
        mats = []
        for i in range(NUM_MATERIALS):
            mats.append(MaterialItem(
                name=f"{fake.word()} {uuid.uuid4().hex[:4]}",
                work_category=random.choice(work_categories),
                unit=random.choice(units),
                current_stock=Decimal('0.00')
            ))
        MaterialItem.objects.bulk_create(mats, batch_size=BATCH_SIZE)
        materials = list(MaterialItem.objects.all())

        # 3. Contractors
        self.stdout.write("3. Creating Contractors...")
        conts = []
        for i in range(NUM_CONTRACTORS):
            conts.append(Contractor(
                first_name=fake.first_name(),
                last_name=f"{fake.last_name()} {uuid.uuid4().hex[:4]}"
            ))
        Contractor.objects.bulk_create(conts, batch_size=BATCH_SIZE)
        contractors = list(Contractor.objects.all())

        # Helper to generate random dates within the last 2 years
        def random_jdate():
            year = random.randint(1401, 1402)
            month = random.randint(1, 12)
            day = random.randint(1, 29)
            return jdatetime.date(year, month, day)

        # 4. IN Transactions
        self.stdout.write("4. Creating IN Transactions (bulk)...")
        in_txs = []
        material_in_totals = {m.id: Decimal('0.00') for m in materials}
        
        for _ in range(NUM_IN_TRANSACTIONS):
            mat = random.choice(materials)
            qty = Decimal(str(round(random.uniform(10.0, 500.0), 2)))
            material_in_totals[mat.id] += qty
            
            in_txs.append(WarehouseTransaction(
                transaction_type='IN',
                material=mat,
                quantity=qty,
                bill_of_lading=str(fake.random_int(min=10000, max=99999)),
                date=random_jdate(),
                created_at=jdatetime.datetime.now()
            ))
        
        for i in range(0, len(in_txs), BATCH_SIZE):
            WarehouseTransaction.objects.bulk_create(in_txs[i:i+BATCH_SIZE], batch_size=BATCH_SIZE)
            self.stdout.write(self.style.SUCCESS(f"  -> Created {min(i + BATCH_SIZE, len(in_txs))}/{len(in_txs)} IN transactions..."))

        # 5. OUT Transactions
        self.stdout.write("5. Creating OUT Transactions (bulk)...")
        out_txs = []
        material_out_totals = {m.id: Decimal('0.00') for m in materials}
        
        for _ in range(NUM_OUT_TRANSACTIONS):
            mat = random.choice(materials)
            max_out = material_in_totals[mat.id] - material_out_totals[mat.id]
            
            # Race condition / Negative stock protection:
            if max_out <= Decimal('1.00'):
                continue
            
            qty = Decimal(str(round(random.uniform(1.0, float(min(Decimal('100.00'), max_out))), 2)))
            material_out_totals[mat.id] += qty
            
            out_txs.append(WarehouseTransaction(
                transaction_type='OUT',
                material=mat,
                contractor=random.choice(contractors),
                quantity=qty,
                contract_number=f"CNTR-{fake.random_int(min=1000, max=9999)}",
                contract_subject=fake.job(),
                date=random_jdate(),
                created_at=jdatetime.datetime.now()
            ))

        for i in range(0, len(out_txs), BATCH_SIZE):
            WarehouseTransaction.objects.bulk_create(out_txs[i:i+BATCH_SIZE], batch_size=BATCH_SIZE)
            self.stdout.write(self.style.SUCCESS(f"  -> Created {min(i + BATCH_SIZE, len(out_txs))}/{len(out_txs)} OUT transactions..."))

        # 6. Update Material Stocks (Atomic & Bulk)
        self.stdout.write("6. Re-calculating and updating Material current_stock...")
        for mat in materials:
            mat.current_stock = material_in_totals[mat.id] - material_out_totals[mat.id]
        MaterialItem.objects.bulk_update(materials, ['current_stock'], batch_size=BATCH_SIZE)
        self.stdout.write(self.style.SUCCESS("  -> Material stocks updated!"))

        # 7. Approvals
        self.stdout.write("7. Creating Technical Office Approvals (bulk)...")
        apps = []
        for _ in range(NUM_APPROVALS):
            mat = random.choice(materials)
            qty = Decimal(str(round(random.uniform(1.0, 50.0), 2)))
            
            apps.append(TechnicalOfficeApproval(
                contractor=random.choice(contractors),
                material=mat,
                approved_quantity=qty,
                contract_number=f"CNTR-{fake.random_int(min=1000, max=9999)}",
                contract_subject=fake.job(),
                approval_date=random_jdate(),
                created_at=jdatetime.datetime.now()
            ))
            
        for i in range(0, len(apps), BATCH_SIZE):
            TechnicalOfficeApproval.objects.bulk_create(apps[i:i+BATCH_SIZE], batch_size=BATCH_SIZE)
            self.stdout.write(self.style.SUCCESS(f"  -> Created {min(i + BATCH_SIZE, len(apps))}/{len(apps)} Approvals..."))

        # 8. Rebuild precalculated global material balance table
        self.stdout.write("8. Re-building precalculated GlobalMaterialBalance table...")
        from balance.services import rebuild_all_global_balances
        rebuild_all_global_balances()
        self.stdout.write(self.style.SUCCESS("  -> GlobalMaterialBalance table populated!"))

        self.stdout.write(self.style.SUCCESS("Massive database seeding completed successfully!"))
