#!/usr/bin/env python3
"""Transcribed unambiguous SKU/price cards from rendered PDF pages 43–45."""
import csv
import hashlib
from pathlib import Path

path = Path('docs/catalogue/evidence/inax/INAX_2026_products_verified.csv')
rows = list(csv.DictReader(path.open(encoding='utf-8-sig', newline='')))
fields = list(rows[0])
by_sku = {r['sku_full']: r for r in rows}
cards = [
    (43, 'AL-642V', 6170000), (43, 'AL-638V', 5250000), (43, 'AL-299V', 3970000),
    (44, 'AL-369V', 3300000), (44, 'AL-465V', 3500000), (44, 'L-465V', 3150000),
    (44, 'AL-445V', 2940000), (44, 'L-445V', 2590000), (44, 'AL-295V', 2550000),
    (44, 'L-295V', 2270000), (44, 'AL-333V', 3050000), (44, 'L-333V', 2680000),
    (44, 'AL-286V (FC)', 2200000),
    (45, 'AL-2298V', 2840000), (45, 'L-2298V', 2540000),
    (45, 'AL-2216V', 2160000), (45, 'L-2216V', 1800000),
    (45, 'AL-2293V', 2030000), (45, 'L-2293V', 1690000),
    (45, 'L-298VC', 1350000), (45, 'L-288VC', 910000),
]
for page, sku, price in cards:
    row = by_sku.get(sku)
    if row is None:
        row = dict.fromkeys(fields, '')
        rows.append(row)
        by_sku[sku] = row
    if row['verification_status'] == 'CONFIRMED' and row['manufacturer_printed_price_vnd'] != str(price):
        raise SystemExit(f'Price conflict: {sku}')
    row.update(brand='INAX', market='Vietnam', edition='04/2026', sku_full=sku,
               model=sku.split(' (')[0], pdf_page=str(page),
               pdf_sha256='c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67',
               manufacturer_product_name='Chân chậu rửa' if sku in ('L-298VC','L-288VC') else 'Chậu rửa',
               product_kind='component' if sku in ('L-298VC','L-288VC') else 'sellable_product',
               category='Lavabo', manufacturer_printed_price_vnd=str(price),
               price_status='PRINTED_CONFIRMED', verification_status='CONFIRMED',
               evidence_locator=f'Full-resolution visual product card, PDF page {page}')
with path.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\r\n')
    writer.writeheader()
    writer.writerows(rows)
print('confirmed', sum(r['verification_status']=='CONFIRMED' for r in rows))
print('review', sum(r['verification_status']=='REVIEW' for r in rows))
print('sha256', hashlib.sha256(path.read_bytes()).hexdigest())
