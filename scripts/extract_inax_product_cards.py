#!/usr/bin/env python3
"""Extract SKU/price card candidates from visually identified listing pages; all require visual QA."""
import csv,hashlib,re
from pathlib import Path
import fitz
PDF=Path('/tmp/dpg-cp1-pdfs/inax-2026.pdf')
assert hashlib.sha256(PDF.read_bytes()).hexdigest()=='c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67'
PAGES=[7,8,10,12,13,14,16,19,20,23,25,26,27,32,33,35,36,37,38,39,42,44,45,46,53,54,55,56,57,58,59,60,61,62,64,65,66,67,68,69,71,72,74,75,76,77,78,79]
CODE=re.compile(r'^[A-Z]{1,7}-[A-Z0-9]+(?:[-/+#][A-Z0-9]+)*(?:\s*\([^)]*\))?$')
PRICE=re.compile(r'^Giá\s+([0-9]{1,3}(?:[.,][0-9]{3}){2})',re.I)
doc=fitz.open(PDF)
out=Path('docs/catalogue/evidence/inax/INAX_2026_card_candidates.csv')
fields=['pdf_page','sku_full','manufacturer_printed_price_vnd','price_status','verification_status','review_reason']
with out.open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields,lineterminator='\r\n');w.writeheader()
 for n in PAGES:
  lines=[x.strip() for x in doc[n-1].get_text().splitlines() if x.strip()]
  for i,sku in enumerate(lines[:-1]):
   m=PRICE.match(lines[i+1])
   if CODE.match(sku) and m:
    w.writerow(dict(pdf_page=n,sku_full=sku,manufacturer_printed_price_vnd=m.group(1).replace('.','').replace(',',''),price_status='PAIR_CANDIDATE',verification_status='REVIEW',review_reason='Native-text adjacency on visually identified listing page; card and price need full-resolution QA'))
print(out)
