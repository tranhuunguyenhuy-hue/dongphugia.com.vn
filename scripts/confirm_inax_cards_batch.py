#!/usr/bin/env python3
"""Hand-transcribed full-resolution visual checks on five specified PDF pages."""
import csv,hashlib
from pathlib import Path
base=Path('docs/catalogue/evidence/inax');path=base/'INAX_2026_products_verified.csv'
rows=list(csv.DictReader(path.open(encoding='utf-8-sig'))); fields=list(rows[0]); by={r['sku_full']:r for r in rows}
# (PDF page, exact card code, printed VND integer, manufacturer label, buyer group, kind)
cards=[
(42,'AL-692V',7300000,'Chậu rửa đặt bàn','Lavabo','sellable_product'),
(42,'AL-662V',6300000,'Chậu rửa đặt bàn','Lavabo','sellable_product'),
(42,'AL-682V',6400000,'Chậu rửa đặt bàn','Lavabo','sellable_product'),
(42,'AL-622V',5800000,'Chậu rửa đặt bàn','Lavabo','sellable_product'),
(42,'AL-S620V',14050000,'Chậu rửa đặt bàn Cerafine','Lavabo','sellable_product'),
(42,'AL-S610V',14110000,'Chậu rửa đặt bàn Cerafine','Lavabo','sellable_product'),
(35,'AC-900VRN',11450000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-902VN',11340000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-959VAN-2',8690000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-959VAN',8690000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-989VN',7910000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-912VN',10900000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-939VN',8900000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'C-969-S15VN',7080000,'Bàn cầu một khối kèm nắp rửa cơ','Bồn cầu','sellable_product'),
(35,'AC-969VN-2',6680000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(35,'AC-969VN',6680000,'Bàn cầu một khối','Bồn cầu','sellable_product'),
(55,'BFV-655T-SPA',42920000,'Sen cây nhiệt tự động','Sen & vòi','sellable_product'),
(55,'BFV-655T',37980000,'Sen cây nhiệt tự động','Sen & vòi','sellable_product'),
(55,'BFV-639T',16000000,'Sen cây nhiệt tự động','Sen & vòi','sellable_product'),
(55,'BFV-6015S',17880000,'Sen cây nhiệt tự động','Sen & vòi','sellable_product'),
(55,'BFV-619T',14000000,'Sen cây nhiệt tự động','Sen & vòi','sellable_product'),
(71,'BF-1760V',63550000,'Bồn tắm đặt sàn','Bồn tắm','sellable_product'),
(71,'BF-1757V',52490000,'Bồn tắm đặt sàn','Bồn tắm','sellable_product'),
(71,'BF-1858V',54110000,'Bồn tắm đặt sàn','Bồn tắm','sellable_product'),
(71,'BF-1656V',46880000,'Bồn tắm đặt sàn','Bồn tắm','sellable_product'),
(74,'U-440V',2320000,'Bồn tiểu','Bồn tiểu','sellable_product'),
(74,'U-117V',2070000,'Bồn tiểu','Bồn tiểu','sellable_product'),
(74,'U-116V',990000,'Bồn tiểu','Bồn tiểu','sellable_product'),
(74,'P-1',1530000,'Vách tiểu','Bồn tiểu','component'),
(74,'OKUV-120S(A)',8200000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'OKUV-120S(B)',7980000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'OKUV-120S(B)-0.5AC',7520000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'OKUV-120S(B)-0.5DC',7520000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'OKUV-30SM-0.5',5990000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'OKUV-30SM',6130000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'OKU-AT131SD',17430000,'Van xả cảm ứng','Bồn tiểu','component'),
(74,'UF-3VS',3240000,'Van xả kiểu ấn','Bồn tiểu','component'),
(74,'UF-4VS',3380000,'Van xả kiểu ấn','Bồn tiểu','component'),
(74,'UF-7V',1640000,'Van xả kiểu ấn','Bồn tiểu','component'),
(74,'UF-8V',1640000,'Van xả kiểu ấn','Bồn tiểu','component'),
(74,'UF-105',550000,'Cút nối giữa ống cấp nước và bồn tiểu','Bồn tiểu','component'),
]
for n,sku,price,name,category,kind in cards:
 if sku not in by:
  r=dict.fromkeys(fields,'');r.update(brand='INAX',market='Vietnam',edition='04/2026',sku_full=sku,model=sku.split('/')[0].split('+')[0],pdf_page=str(n),pdf_sha256='c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67');rows.append(r);by[sku]=r
 r=by[sku]
 if r['verification_status']=='CONFIRMED' and r['manufacturer_printed_price_vnd']!=str(price):raise SystemExit('price conflict '+sku)
 r.update(manufacturer_product_name=name,product_kind=kind,category=category,manufacturer_printed_price_vnd=str(price),price_status='PRINTED_CONFIRMED',verification_status='CONFIRMED',evidence_locator=f'Full-resolution visual product card, PDF page {n}')
with path.open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields,lineterminator='\r\n');w.writeheader();w.writerows(rows)
print('confirmed',sum(r['verification_status']=='CONFIRMED' for r in rows),'review',sum(r['verification_status']=='REVIEW' for r in rows),'sha256',hashlib.sha256(path.read_bytes()).hexdigest())
