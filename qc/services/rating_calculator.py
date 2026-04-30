from datetime import date
from dateutil.relativedelta import relativedelta
from django.db.models import Count, Sum, Q, Avg
from qc.models import Factory, FactoryRating, SampleComment, Inspection, FinalInspection
import math

def calculate_percentile(scores, score):
    """Calculate percentile rank of a score in a list of scores."""
    if not scores:
        return 0.0
    less_than = sum(1 for s in scores if s < score)
    equal_to = sum(1 for s in scores if s == score)
    return (less_than + 0.5 * equal_to) / len(scores) * 100.0

def determine_grade(percentile):
    """
    Top 15% = A (85th percentile and above)
    Next 25% = B (60th to 84th percentile)
    Next 40% = C (20th to 59th percentile)
    Bottom 20% = D (Below 20th percentile)
    """
    if percentile >= 85.0:
        return 'A'
    elif percentile >= 60.0:
        return 'B'
    elif percentile >= 20.0:
        return 'C'
    else:
        return 'D'

def calculate_factory_ratings_for_month(target_date: date):
    """
    Calculates and updates FactoryRating records for a given month.
    target_date can be any date; the function will snap to the first of the month.
    """
    # Snap to first of month
    start_of_month = target_date.replace(day=1)
    # Calculate next month start for filtering
    next_month = start_of_month + relativedelta(months=1)
    previous_month = start_of_month - relativedelta(months=1)

    factories = Factory.objects.all()
    calculated_scores = []
    
    # 1. Process each factory and calculate raw metrics and base scores
    for factory in factories:
        # Development metrics (SampleComments linked via StyleMaster)
        dev_comments = SampleComment.objects.filter(
            style__factory=factory,
            created_at__gte=start_of_month,
            created_at__lt=next_month
        )
        total_dev_samples = dev_comments.count()
        total_dev_iterations = dev_comments.aggregate(total=Sum('sample_number'))['total'] or 0
        dev_iteration_ratio = (total_dev_iterations / total_dev_samples) if total_dev_samples > 0 else 0.0

        # Quality Inspections (Internal & Customer evaluations)
        evals = Inspection.objects.filter(
            factory=factory.name, # text field in Inspection model
            created_at__gte=start_of_month,
            created_at__lt=next_month
        )
        total_evals = evals.count()
        internal_pass = evals.filter(decision='Accepted').count()
        customer_pass = evals.filter(customer_decision='Accepted').count()
        
        internal_pass_rate = (internal_pass / total_evals * 100) if total_evals > 0 else 0.0
        # If no customer decision was made yet, we might just default to internal rate, but strictly:
        evals_with_customer_feedback = evals.exclude(customer_decision__isnull=True).count()
        customer_pass_rate = (customer_pass / evals_with_customer_feedback * 100) if evals_with_customer_feedback > 0 else 0.0
        
        # Base score is an average of the two pass rates. If no customer feedback, rely on internal.
        if evals_with_customer_feedback > 0:
            base_score = (internal_pass_rate + customer_pass_rate) / 2.0
        else:
            base_score = internal_pass_rate

        # Final Inspections (Production rework & FPY)
        final_inspections = FinalInspection.objects.filter(
            factory=factory.name,
            inspection_date__gte=start_of_month,
            inspection_date__lt=next_month
        )
        total_fi = final_inspections.count()
        # FPY: Passed on the 1st attempt
        first_pass_count = final_inspections.filter(inspection_attempt='1st', result='Pass').count()
        first_pass_yield = (first_pass_count / total_fi * 100) if total_fi > 0 else 0.0
        
        # Calculate Penalties
        penalty_score = 0.0
        
        # Dev Iteration Penalty
        # e.g., if average iterations > 1.5, penalize 10 points per extra iteration avg
        if dev_iteration_ratio > 1.5:
            penalty_score += (dev_iteration_ratio - 1.5) * 10
            
        # Production Rework Penalty
        # Penalty for 2nd/3rd attempts
        rework_fi = final_inspections.exclude(inspection_attempt='1st').count()
        rework_rate = (rework_fi / total_fi * 100) if total_fi > 0 else 0.0
        # e.g., 0.5 points deducted per 1% of rework rate
        penalty_score += rework_rate * 0.5

        # Improvement Bonus (Compare to previous month)
        improvement_bonus = 0.0
        prev_rating = FactoryRating.objects.filter(factory=factory, month=previous_month).first()
        trend = 'Stable'
        
        if prev_rating:
            # Did FPY improve?
            if first_pass_yield > prev_rating.first_pass_yield:
                improvement_bonus += 2.0
            # Did Dev iteration ratio improve (decrease)?
            if total_dev_samples > 0 and prev_rating.total_dev_samples > 0:
                if dev_iteration_ratio < prev_rating.dev_iteration_ratio:
                    improvement_bonus += 2.0
                    
            # Determine trend for display
            if (first_pass_yield > prev_rating.first_pass_yield) or (dev_iteration_ratio < prev_rating.dev_iteration_ratio and dev_iteration_ratio > 0):
                trend = 'Up'
            elif (first_pass_yield < prev_rating.first_pass_yield) or (dev_iteration_ratio > prev_rating.dev_iteration_ratio):
                trend = 'Down'

        # Final raw score calculation
        # Cap final score between 0 and 100
        final_score = max(0.0, min(100.0, base_score - penalty_score + improvement_bonus))

        # Only create a rating if there was actual activity for this factory
        # otherwise we might skew percentiles with 0-score inactive factories
        has_activity = (total_dev_samples > 0 or total_evals > 0 or total_fi > 0)
        
        if has_activity:
            rating_obj, created = FactoryRating.objects.update_or_create(
                factory=factory,
                month=start_of_month,
                defaults={
                    'total_dev_samples': total_dev_samples,
                    'total_dev_iterations': total_dev_iterations,
                    'dev_iteration_ratio': dev_iteration_ratio,
                    'total_final_inspections': total_fi,
                    'first_pass_count': first_pass_count,
                    'first_pass_yield': first_pass_yield,
                    'internal_pass_rate': internal_pass_rate,
                    'customer_pass_rate': customer_pass_rate,
                    'base_score': base_score,
                    'penalty_score': penalty_score,
                    'improvement_bonus': improvement_bonus,
                    'final_score': final_score,
                    'trend': trend,
                }
            )
            calculated_scores.append(rating_obj)

    # 2. Relative Grading
    # Extract all final scores to calculate percentiles
    all_final_scores = [r.final_score for r in calculated_scores]
    
    for rating in calculated_scores:
        percentile = calculate_percentile(all_final_scores, rating.final_score)
        grade = determine_grade(percentile)
        
        rating.percentile_rank = percentile
        rating.grade = grade
        rating.save(update_fields=['percentile_rank', 'grade'])

    return len(calculated_scores)
