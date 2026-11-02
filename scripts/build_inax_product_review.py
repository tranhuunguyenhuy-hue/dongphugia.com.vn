#!/usr/bin/env python3
"""Merge page-card candidates into product-level REVIEW rows without promoting unverified facts."""
import csv,hashlib,collections
from pathlib import Path
base=Path('docs/catalogue/evidence/inax')
fields='brand market edition manufacturer_product_name sku_full model variant product_kind category pdf_page additional_pages manufacturer_printed_price_vnd price_status verification_status evidence_locator pdf_sha256'.split()
original=list(csv.DictReader((base/'INAX_2026_products_verified.csv').open(encoding='utf-8-sig')))
confirmed={x['sku_full']:x for x in original if x['verification_status']=='CONFIRMED'}
candidates=list(csv.DictReader((base/'INAX_2026_card_candidates.csv').open(encoding='utf-8-sig')))
by=collections.defaultdict(list)
for c in candidates:by[c['sku_full']].append(c)
rows=list(confirmed.values())
for sku,items in by.items():
 if sku in confirmed:
  x=confirmed[sku]; pages=sorted(set(int(v['pdf_page']) for v in items)-{int(x['pdf_page'])});x['additional_pages']=';'.join(map(str,pages));continue
 pages=sorted(set(int(v['pdf_page']) for v in items));prices={v['manufacturer_printed_price_vnd'] for v in items};page=pages[0]
 # A single text-adjacent number remains provisional until card visual QA.
 category='Bồn cầu' if 32<=page<=38 else 'Lavabo' if 39<=page<=46 else 'Sen & vòi' if 53<=page<=69 else 'Bồn tắm' if 71<=page<=72 else 'Bồn tiểu' if 74<=page<=75 else ''
 rows.append(dict(brand='INAX',market='Vietnam',edition='04/2026',manufacturer_product_name='',sku_full=sku,model=sku.split('/')[0].split('+')[0],variant='',product_kind='REVIEW',category=category,pdf_page=page,additional_pages=';'.join(map(str,pages[1:])),manufacturer_printed_price_vnd='',price_status='PRICE_REVIEW' if prices else 'NOT_PUBLISHED_UNVERIFIED',verification_status='REVIEW',evidence_locator='Card candidate; native-text code then Giá on PDF page '+str(page),pdf_sha256='c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67'))
rows.sort(key=lambda x:(int(x['pdf_page']),x['sku_full']))
out=base/'INAX_2026_products_verified.csv'
with out.open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields,lineterminator='\r\n');w.writeheader();w.writerows(rows)
print('rows',len(rows),'confirmed',len(confirmed),'review',len(rows)-len(confirmed),'sha256',hashlib.sha256(out.read_bytes()).hexdigest())
