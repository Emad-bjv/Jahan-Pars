from django.core.management.base import BaseCommand
from balance.services import rebuild_all_global_balances


class Command(BaseCommand):
    help = 'Rebuild the GlobalMaterialBalance precalculated table from scratch'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting rebuild of GlobalMaterialBalance table..."))
        rebuild_all_global_balances()
        self.stdout.write(self.style.SUCCESS("Successfully rebuilt GlobalMaterialBalance table!"))
