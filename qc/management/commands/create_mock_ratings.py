from django.core.management.base import BaseCommand
from qc.models import Factory, FactoryRating
from django.utils import timezone
from datetime import date
from dateutil.relativedelta import relativedelta

class Command(BaseCommand):
    help = 'Injects mock factory rating data into the database'

    def handle(self, *args, **options):
        # Clear existing ratings first
        FactoryRating.objects.all().delete()
        
        # We want to create data for the current month and previous month
        current_date = timezone.now().date().replace(day=1)
        prev_month = current_date - relativedelta(months=1)

        f1, _ = Factory.objects.get_or_create(name='Ar Apparel', defaults={'address': 'Dhaka'})
        f2, _ = Factory.objects.get_or_create(name='Ombre Apparel', defaults={'address': 'Jakarta'})
        f3, _ = Factory.objects.get_or_create(name='Kasim Textiles', defaults={'address': 'Hanoi'})

        # Ar Apparel (A Grade)
        FactoryRating.objects.get_or_create(
            factory=f1, month=prev_month,
            defaults={'total_dev_samples': 10, 'total_dev_iterations': 12, 'dev_iteration_ratio': 1.2,
                      'total_final_inspections': 5, 'first_pass_count': 4, 'first_pass_yield': 80,
                      'internal_pass_rate': 90, 'customer_pass_rate': 85, 'base_score': 87.5,
                      'penalty_score': 0, 'improvement_bonus': 0, 'final_score': 87.5,
                      'percentile_rank': 95, 'grade': 'A', 'trend': 'Stable'}
        )
        FactoryRating.objects.get_or_create(
            factory=f1, month=current_date,
            defaults={'total_dev_samples': 15, 'total_dev_iterations': 16, 'dev_iteration_ratio': 1.06,
                      'total_final_inspections': 8, 'first_pass_count': 7, 'first_pass_yield': 87.5,
                      'internal_pass_rate': 95, 'customer_pass_rate': 90, 'base_score': 92.5,
                      'penalty_score': 0, 'improvement_bonus': 2.0, 'final_score': 94.5,
                      'percentile_rank': 98, 'grade': 'A', 'trend': 'Up'}
        )

        # Ombre Apparel (C Grade)
        FactoryRating.objects.get_or_create(
            factory=f2, month=prev_month,
            defaults={'total_dev_samples': 20, 'total_dev_iterations': 30, 'dev_iteration_ratio': 1.5,
                      'total_final_inspections': 10, 'first_pass_count': 6, 'first_pass_yield': 60,
                      'internal_pass_rate': 70, 'customer_pass_rate': 65, 'base_score': 67.5,
                      'penalty_score': 5, 'improvement_bonus': 0, 'final_score': 62.5,
                      'percentile_rank': 45, 'grade': 'C', 'trend': 'Stable'}
        )
        FactoryRating.objects.get_or_create(
            factory=f2, month=current_date,
            defaults={'total_dev_samples': 22, 'total_dev_iterations': 35, 'dev_iteration_ratio': 1.59,
                      'total_final_inspections': 12, 'first_pass_count': 7, 'first_pass_yield': 58.3,
                      'internal_pass_rate': 68, 'customer_pass_rate': 60, 'base_score': 64,
                      'penalty_score': 8, 'improvement_bonus': 0, 'final_score': 56,
                      'percentile_rank': 30, 'grade': 'C', 'trend': 'Down'}
        )

        # Kasim Textiles (B Grade)
        FactoryRating.objects.get_or_create(
            factory=f3, month=prev_month,
            defaults={'total_dev_samples': 12, 'total_dev_iterations': 16, 'dev_iteration_ratio': 1.33,
                      'total_final_inspections': 7, 'first_pass_count': 5, 'first_pass_yield': 71.4,
                      'internal_pass_rate': 80, 'customer_pass_rate': 75, 'base_score': 77.5,
                      'penalty_score': 2, 'improvement_bonus': 0, 'final_score': 75.5,
                      'percentile_rank': 75, 'grade': 'B', 'trend': 'Stable'}
        )
        FactoryRating.objects.get_or_create(
            factory=f3, month=current_date,
            defaults={'total_dev_samples': 14, 'total_dev_iterations': 17, 'dev_iteration_ratio': 1.21,
                      'total_final_inspections': 9, 'first_pass_count': 7, 'first_pass_yield': 77.7,
                      'internal_pass_rate': 85, 'customer_pass_rate': 80, 'base_score': 82.5,
                      'penalty_score': 0, 'improvement_bonus': 2.0, 'final_score': 84.5,
                      'percentile_rank': 80, 'grade': 'B', 'trend': 'Up'}
        )

        self.stdout.write(self.style.SUCCESS('Successfully injected mock factory ratings!'))
