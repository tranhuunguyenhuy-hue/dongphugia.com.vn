#!/usr/bin/env python3
"""Visual transcription of INAX 2026 PDF pages 37–39 (1-based)."""
import csv
import hashlib
from pathlib import Path

path = Path('docs/catalogue/evidence/inax/INAX_2026_products_verified.csv')
rows = list(csv.DictReader(path.open(encoding='utf-8-sig', newline='')))
fields = list(rows[0])
by_sku = {row['sku_full']: row for row in rows}
cards = [
    (37, 'C-306VAN', 3600000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-306VA', 3340000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-306VPTN', 4020000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-306VPT', 3790000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-108VAN', 3010000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-108VA', 2800000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-117VAN', 2730000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (37, 'C-117VA', 2560000, 'Bàn cầu hai khối', 'Bồn cầu'),
    (38, 'AC-952VN', 17560000, 'Bàn cầu treo tường', 'Bồn cầu'),
    (38, 'AC-22PVN', 15220000, 'Bàn cầu treo tường', 'Bồn cầu'),
    (38, 'AC-23PVN', 12730000, 'Bàn cầu treo tường', 'Bồn cầu'),
    (39, 'L-C11A3-AS', 79430000, 'Chậu rửa Jet Bowl', 'Lavabo'),
    (39, 'LF-21PA', 2420000, 'Bẫy chữ P đồng bộ Jet Bowl', 'Lavabo'),
    (39, 'ECL-CNZ00353B30010', 8590000, 'Nguồn điện đồng bộ Jet Bowl', 'Lavabo'),
]
for page, sku, price, name, category in cards:
    row = by_sku.get(sku)
    if row is None:
        row = dict.fromkeys(fields, '')
        rows.append(row)
        by_sku[sku] = row
    if row['verification_status'] == 'CONFIRMED' and row['manufacturer_printed_price_vnd'] != str(price):
        raise SystemExit(f'Price conflict: {sku}')
    row.update(brand='INAX', market='Vietnam', edition='04/2026', sku_full=sku,
               model=sku.split('/')[0].split('+')[0], pdf_page=str(page),
               pdf_sha256='c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67',
               manufacturer_product_name=name,
               product_kind='component' if sku in ('LF-21PA', 'ECL-CNZ00353B30010') else 'sellable_product',
               category=category, manufacturer_printed_price_vnd=str(price),
               price_status='PRINTED_CONFIRMED', verification_status='CONFIRMED',
               evidence_locator=f'Full-resolution visual product card, PDF page {page}')
with path.open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\r\n')
    writer.writeheader()
    writer.writerows(rows)
print('confirmed', sum(row['verification_status']=='CONFIRMED' for row in rows))
print('review', sum(row['verification_status']=='REVIEW' for row in rows))
print('sha256', hashlib.sha256(path.read_bytes()).hexdigest())
