#!/usr/bin/env python3
"""Refresh legacy visual ledger counts from the checked product CSV."""
import csv
from collections import Counter
from pathlib import Path

base = Path('docs/catalogue/evidence/inax')
ledger = base / 'INAX_2026_page_audit.csv'
products = list(csv.DictReader((base / 'INAX_2026_products_verified.csv').open(encoding='utf-8-sig', newline='')))
rows = list(csv.DictReader(ledger.open(encoding='utf-8-sig', newline='')))
counts = Counter(int(r['pdf_page']) for r in products if r['verification_status'] == 'CONFIRMED')
for row in rows:
    page = int(row['pdf_page'])
    row['product_cards_verified'] = str(counts[page])
    if counts[page]:
        row['detail_status'] = 'PARTIAL_CARD_QA'
        row['evidence_notes'] = f'{counts[page]} distinct primary-page SKUs visually checked with prices; full page product completeness not asserted'
assert len(rows) == 107 and sum(int(r['product_cards_verified']) for r in rows) == 107
with ledger.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\r\n')
    writer.writeheader()
    writer.writerows(rows)
