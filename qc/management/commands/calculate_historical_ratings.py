from django.core.management.base import BaseCommand
from qc.services.rating_calculator import calculate_factory_ratings_for_month
from datetime import date
from dateutil.relativedelta import relativedelta
from qc.models import FactoryRating

class Command(BaseCommand):
    help = 'Calculates historical factory ratings for the past N months.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--months',
            type=int,
            default=6,
            help='Number of past months to calculate ratings for (default: 6)'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing ratings before calculation'
        )

    def handle(self, *args, **options):
        months_back = options['months']
        
        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing all existing factory ratings...'))
            FactoryRating.objects.all().delete()

        current_date = date.today()
        
        # Calculate from oldest to newest so improvement bonuses can be calculated sequentially
        for i in range(months_back, -1, -1):
            target_date = current_date - relativedelta(months=i)
            target_month = target_date.replace(day=1)
            
            self.stdout.write(f'Calculating ratings for {target_month.strftime("%Y-%m")}...')
            count = calculate_factory_ratings_for_month(target_month)
            self.stdout.write(self.style.SUCCESS(f'Successfully generated {count} ratings for {target_month.strftime("%Y-%m")}.'))

        self.stdout.write(self.style.SUCCESS('Finished calculating historical ratings.'))
