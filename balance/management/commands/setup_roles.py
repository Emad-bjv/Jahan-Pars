from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from balance.models import Contractor, WorkCategory, MaterialItem, WarehouseTransaction, TechnicalOfficeApproval

class Command(BaseCommand):
    help = 'Sets up default groups and permissions for TECHNICAL and WAREHOUSE roles'

    def handle(self, *args, **kwargs):
        # Create Groups
        tech_group, _ = Group.objects.get_or_create(name='TECHNICAL_GROUP')
        wh_group, _ = Group.objects.get_or_create(name='WAREHOUSE_GROUP')

        # Get Content Types
        contractor_ct = ContentType.objects.get_for_model(Contractor)
        workcategory_ct = ContentType.objects.get_for_model(WorkCategory)
        material_ct = ContentType.objects.get_for_model(MaterialItem)
        transaction_ct = ContentType.objects.get_for_model(WarehouseTransaction)
        approval_ct = ContentType.objects.get_for_model(TechnicalOfficeApproval)

        # Get Permissions
        def get_perm(codename, ct):
            return Permission.objects.get(codename=codename, content_type=ct)

        # --- WAREHOUSE GROUP ---
        wh_permissions = [
            # Full access to Warehouse Transactions
            get_perm('add_warehousetransaction', transaction_ct),
            get_perm('change_warehousetransaction', transaction_ct),
            get_perm('delete_warehousetransaction', transaction_ct),
            get_perm('view_warehousetransaction', transaction_ct),
            
            # Read-only access to master data
            get_perm('view_contractor', contractor_ct),
            get_perm('view_workcategory', workcategory_ct),
            get_perm('view_materialitem', material_ct),
        ]
        wh_group.permissions.set(wh_permissions)

        # --- TECHNICAL GROUP ---
        tech_permissions = [
            # Full access to Technical Approvals
            get_perm('add_technicalofficeapproval', approval_ct),
            get_perm('change_technicalofficeapproval', approval_ct),
            get_perm('delete_technicalofficeapproval', approval_ct),
            get_perm('view_technicalofficeapproval', approval_ct),
            
            # Read-only access to master data and transactions
            get_perm('view_contractor', contractor_ct),
            get_perm('view_workcategory', workcategory_ct),
            get_perm('view_materialitem', material_ct),
            get_perm('view_warehousetransaction', transaction_ct),
        ]
        tech_group.permissions.set(tech_permissions)

        self.stdout.write(self.style.SUCCESS('Successfully initialized groups and permissions.'))
