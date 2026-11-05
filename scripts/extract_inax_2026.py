#!/usr/bin/env python3
"""Conservative, page-complete INAX PDF evidence extraction; requires PyMuPDF."""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import fitz

URL = "https://www.inax.com.vn/wp-content/uploads/2026/05/Cataogue_A5_Ver_042026.pdf"
EXPECTED = "c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67"
FIELDS = "brand market catalogue_title edition pdf_url pdf_sha256 pdf_page printed_page sku_original model variant configuration_type product_name category manufacturer_list_price currency price_note evidence_excerpt_or_label verification_status review_reason".split()
CODE = re.compile(r"(?<![A-Za-z0-9])(?:[A-Z]{1,7}-[A-Z0-9]+(?:[-/+#][A-Z0-9]+)*)(?![A-Za-z0-9])")
PRICE = re.compile(r"(?:Giá\s*)?([0-9]{1,3}(?:[.,][0-9]{3}){2})\s*VNĐ", re.I)
GROUPS = [("Bồn cầu", ("BÀN CẦU", "BỒN CẦU")), ("Lavabo", ("CHẬU RỬA", "LAVABO")), ("Sen & vòi", ("VÒI", "SEN")), ("Bồn tắm", ("BỒN TẮM",)), ("Bồn tiểu", ("TIỂU NAM", "BỒN TIỂU"))]

def extract(pdf):
    data = pdf.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED:
        raise SystemExit(f"PDF SHA-256 mismatch: {digest}")
    doc = fitz.open(stream=data, filetype="pdf")
    if len(doc) != 107:
        raise SystemExit(f"Expected 107 pages; got {len(doc)}")
    rows, pages = [], []
    for index, page in enumerate(doc):
        lines = [re.sub(r"\s+", " ", x).strip() for x in page.get_text(sort=False).splitlines()]
        lines = [x for x in lines if x]
        printed = "/".join(x for x in lines[:4] if re.fullmatch(r"\d{1,3}", x))
        found = 0
        for pos, line in enumerate(lines):
            for match in CODE.finditer(line):
                sku = match.group()
                # False positives in prose, diagrams, and tables remain visible for review.
                preceding = " ".join(lines[max(0, pos-3):pos])
                following = " ".join(lines[pos+1:pos+4])
                near = " ".join(lines[max(0,pos-2):pos+5])
                prices = PRICE.findall(" ".join(lines[pos+1:pos+3]))
                safe_price = prices[0].replace(".", "").replace(",", "") if len(prices) == 1 and pos+1 < len(lines) and lines[pos+1].startswith("Giá") else ""
                category = next((name for name, words in GROUPS if any(word in preceding.upper() for word in words)), "")
                status = "REVIEW"
                reasons = []
                if not safe_price:
                    reasons.append("NO_PRICE_OR_UNSAFE_PRICE_ASSOCIATION")
                if not category:
                    reasons.append("CATEGORY_OR_CONTEXT_UNVERIFIED")
                if line != sku:
                    reasons.append("INLINE_OR_TABLE_CODE")
                if "/" in sku or "+" in sku or "#" in sku:
                    reasons.append("VARIANT_OR_COMPOSITE_REVIEW")
                if not reasons:
                    status = "TEXT_PAIRED_REVIEWED_BY_RULE"
                rows.append(dict(zip(FIELDS, ["INAX", "Vietnam", "Catalogue Phòng tắm INAX 2026", "04/2026", URL, digest, index+1, printed, sku, sku.split("/")[0].split("+")[0], sku.split("/")[-1] if "/" in sku else "", "composite" if "+" in sku else "variant" if "/" in sku or "#" in sku else "single_or_component_unverified", preceding[-100:], category, safe_price, "VND" if safe_price else "", "Manufacturer printed list price; association provisional" if safe_price else "", near[:220], status, ";".join(reasons)])))
                found += 1
        pages.append({"pdf_page": index+1, "printed_page": printed, "text_chars": len(" ".join(lines)), "code_occurrences": found, "price_occurrences": len(PRICE.findall(" ".join(lines)))})
    return rows, pages, digest, len(data)

def main():
    p=argparse.ArgumentParser(); p.add_argument("pdf", type=Path); p.add_argument("output", type=Path); args=p.parse_args()
    rows,pages,digest,size=extract(args.pdf)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open("w",encoding="utf-8-sig",newline="") as f:
        w=csv.DictWriter(f,fieldnames=FIELDS,lineterminator="\r\n"); w.writeheader(); w.writerows(rows)
    summary={"pdf_sha256":digest,"pdf_bytes":size,"pdf_pages":107,"csv_sha256":hashlib.sha256(args.output.read_bytes()).hexdigest(),"rows":len(rows),"unique_full_codes":len({r['sku_original'] for r in rows}),"rows_with_price":sum(bool(r['manufacturer_list_price']) for r in rows),"rows_needing_manual_review":sum(r['verification_status']=='REVIEW' for r in rows),"pages_examined":len(pages),"pages_with_sku":sum(x['code_occurrences']>0 for x in pages),"pages_with_price":sum(x['price_occurrences']>0 for x in pages),"pages_without_listing":sum(x['code_occurrences']==0 for x in pages),"pages_needing_manual_review":sum(any(r['pdf_page']==x['pdf_page'] and r['verification_status']=='REVIEW' for r in rows) for x in pages),"group_counts":dict(Counter(r['category'] or 'UNKNOWN' for r in rows)),"pages":pages}
    args.output.with_suffix('.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k!='pages'},ensure_ascii=False))

if __name__=='__main__': main()
