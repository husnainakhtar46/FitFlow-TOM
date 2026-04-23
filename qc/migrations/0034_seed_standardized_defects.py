# qc/migrations/0034_seed_standardized_defects.py
"""
Data migration to seed the StandardizedDefect lookup table
with defects extracted from the Mag Quality Check manual.
This runs automatically on every deployment via `migrate`.
"""
from django.db import migrations


SEED_DATA = [
    # ---- Fabric ----
    ('Fabric', 'Fabric Holes', 'Major'),
    ('Fabric', 'Yarn Slubs', 'Minor'),
    ('Fabric', 'Shading/Barriness', 'Major'),
    ('Fabric', 'Broken Picks', 'Minor'),
    ('Fabric', 'Fabric Stains', 'Major'),
    ('Fabric', 'Crease Marks', 'Minor'),
    # ---- Workmanship (Sewing) ----
    ('Workmanship', 'Broken Stitch', 'Major'),
    ('Workmanship', 'Open Seam/Seam Slippage', 'Critical'),
    ('Workmanship', 'Uneven Hem', 'Minor'),
    ('Workmanship', 'Incorrect SPI (Stitches Per Inch)', 'Minor'),
    ('Workmanship', 'Skip Stitch', 'Major'),
    ('Workmanship', 'Uncut Thread Ends', 'Minor'),
    # ---- Measurement (Fit) ----
    ('Measurement', 'Chest Tolerance Failed', 'Major'),
    ('Measurement', 'Waist Tolerance Failed', 'Major'),
    ('Measurement', 'Overall Length Short', 'Major'),
    ('Measurement', 'Sleeve Length Long', 'Minor'),
    # ---- Wash/Finish ----
    ('Wash/Finish', 'Poor Handfeel', 'Minor'),
    ('Wash/Finish', 'Patchy Wash Effect', 'Major'),
    ('Wash/Finish', 'Oily Stains', 'Major'),
    ('Wash/Finish', 'Shade Variation (Batch to Batch)', 'Critical'),
    # ---- Accessories/Trims ----
    ('Accessories/Trims', 'Missing Button', 'Major'),
    ('Accessories/Trims', 'Broken Zipper', 'Critical'),
    ('Accessories/Trims', 'Label Misplacement', 'Minor'),
    ('Accessories/Trims', 'Hangtag Incorrect', 'Minor'),
]


def seed_defects(apps, schema_editor):
    StandardizedDefect = apps.get_model('qc', 'StandardizedDefect')
    for category, defect_name, severity in SEED_DATA:
        StandardizedDefect.objects.get_or_create(
            category=category,
            defect_name=defect_name,
            defaults={'severity': severity},
        )


def remove_defects(apps, schema_editor):
    StandardizedDefect = apps.get_model('qc', 'StandardizedDefect')
    for category, defect_name, _ in SEED_DATA:
        StandardizedDefect.objects.filter(
            category=category,
            defect_name=defect_name,
        ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('qc', '0033_standardized_defects'),
    ]

    operations = [
        migrations.RunPython(seed_defects, remove_defects),
    ]
