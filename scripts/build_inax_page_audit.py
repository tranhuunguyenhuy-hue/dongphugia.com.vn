#!/usr/bin/env python3
"""Page-layout audit transcribed from rendered 107-page contact sheets."""
import csv
from pathlib import Path
out=Path('docs/catalogue/evidence/inax/INAX_2026_page_audit.csv')
product=set([7,8,10,12,13,14,16,19,20,23,25,26,27,32,33,35,36,37,38,39,42,44,45,46,53,54,55,56,57,58,59,60,61,62,64,65,66,67,68,69,71,72,74,75,76,77,78,79])
table={24,25,26,27}
compat=set(range(80,84))
technical=set(range(84,106))
marketing=set([2,3,4,6,9,11,15,17,18,21,22,28,29,30,31,34,40,41,43,47,48,49,50,51,52,63,70,73,106,107])
with out.open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f,lineterminator='\r\n');w.writerow(['pdf_page','page_type','layout_visually_checked','product_cards_verified','unresolved_items','detail_status','evidence_notes'])
 for n in range(1,108):
  if n==1: kind='COVER'
  elif n==5: kind='CONTENTS'
  elif n in technical: kind='TECHNICAL_DRAWING'
  elif n in compat: kind='COMPATIBILITY'
  elif n in table: kind='MIXED_PRODUCT_PRICELIST_TABLE'
  elif n in product: kind='PRODUCT_CARD'
  elif n in marketing: kind='MARKETING_OR_PRODUCT_CONTEXT'
  else: kind='OTHER'
  # Contact sheets establish layout only; detailed SKU/price checks remain open.
  verified={7:3,35:10,36:1,42:6,55:5,71:4,74:16}.get(n,0)
  status='PARTIAL_PRODUCT_QA' if verified else 'DETAIL_QA_PENDING' if kind in ('PRODUCT_CARD','MIXED_PRODUCT_PRICELIST_TABLE') else 'LAYOUT_CLASSIFIED'
  note='Visual layout classification from rendered PDF page; full-resolution product/price audit pending' if status!='LAYOUT_CLASSIFIED' else 'Visual layout classified; code mentions here are not independently verified sellable listings'
  w.writerow([n,kind,'YES',verified,'UNKNOWN' if status!='LAYOUT_CLASSIFIED' else '0',status,note])
