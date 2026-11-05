#!/usr/bin/env python3
"""Build lossless edition CSVs from the frozen INAX raw index and PDF.

The raw occurrence index remains authoritative for token coverage. Geometry and
price candidates are annotations; only visually checked prices are promoted.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fitz

SOURCE_ID = 'INAX-VN-BATHROOM-2026-04'
EXPECTED = 'c9e6ccba1bb8f817b3bd09e0533e5002620172ec88b21b8461388ca63699da67'
URL = 'https://www.inax.com.vn/wp-content/uploads/2026/05/Cataogue_A5_Ver_042026.pdf'
OUT = Path('docs/catalogue/evidence/inax/2026-04')
ROOT = OUT.parent


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def write_csv(path, fields, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\r\n', extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', type=Path)
    parser.add_argument('--retrieved-at', default='2026-11-02 UTC')
    args = parser.parse_args()
    data = args.pdf.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != EXPECTED:
        raise SystemExit(f'Unexpected PDF SHA-256: {digest}')
    doc = fitz.open(stream=data, filetype='pdf')
    if len(doc) != 107:
        raise SystemExit(f'Expected 107 pages; got {len(doc)}')
    raw = read_csv(ROOT / 'INAX_2026_sanitary_sku_prices.csv')
    reviewed = read_csv(ROOT / 'INAX_2026_products_verified.csv')
    verified = {r['sku_full']: r for r in reviewed if r['verification_status'] == 'CONFIRMED'}
    by_page = defaultdict(list)
    for row in raw:
        by_page[int(row['pdf_page'])].append(row)
    raw_codes = {row['sku_original'] for row in raw}
    # The original regex excludes parentheses and a dotted suffix. Preserve its
    # 2,348 rows byte-for-byte, then add the separately visual-checked omissions.
    overlay_missing = [row for sku, row in verified.items() if sku not in raw_codes]
    for row in overlay_missing:
        by_page[int(row['pdf_page'])].append({
            'sku_original': row['sku_full'], 'pdf_page': row['pdf_page'],
            'printed_page': '', 'manufacturer_list_price': '',
            'product_name': row['manufacturer_product_name'], 'category': row['category'],
            'evidence_excerpt_or_label': 'Visual-checked exact code omitted by original regex',
            'review_reason': ''})
    occurrences = []
    coverage = []
    for page_no in range(1, 108):
        page = doc[page_no - 1]
        blocks = page.get_text('blocks')
        # search_for locates native text; repeated identical tokens consume successive rectangles.
        rectangles = {}
        consumed = Counter()
        candidate_count = paired_count = unresolved_count = 0
        for idx, raw_row in enumerate(by_page[page_no], 1):
            sku = raw_row['sku_original']
            if sku not in rectangles:
                rectangles[sku] = page.search_for(sku)
            hit_no = consumed[sku]
            consumed[sku] += 1
            rect = rectangles[sku][hit_no] if hit_no < len(rectangles[sku]) else None
            geometry = ','.join(f'{v:.1f}' for v in (rect.x0, rect.y0, rect.x1, rect.y1)) if rect else ''
            nearby_label = ''
            nearby_specs = ''
            if rect:
                labels = [b for b in blocks if 0 <= rect.y0 - b[3] <= 38 and abs(b[0] - rect.x0) <= 22
                          and len(b[4].strip()) <= 55 and 'Giá' not in b[4] and '\n' in b[4]]
                if labels:
                    nearby_label = min(labels, key=lambda b: rect.y0 - b[3])[4].strip()
                specs = [b for b in blocks if 0 <= b[1] - rect.y1 <= 45 and abs(b[0] - rect.x0) <= 22
                         and 'mm' in b[4] and 'Giá' not in b[4] and len(b[4].strip()) <= 90]
                if specs:
                    nearby_specs = min(specs, key=lambda b: b[1] - rect.y1)[4].strip()
            confirmed = verified.get(sku)
            same_page_confirmation = confirmed and str(page_no) == confirmed['pdf_page']
            spatial_price = ''
            spatial_literal = ''
            if rect and page_no < 80 and not any(c in sku for c in '()+#'):
                matching_blocks = [b for b in blocks if b[0] <= rect.x0 + rect.width/2 <= b[2]
                                   and b[1] <= rect.y0 + rect.height/2 <= b[3]]
                if len(matching_blocks) == 1:
                    lines = [line.strip() for line in matching_blocks[0][4].splitlines() if line.strip()]
                    if len(lines) == 2 and lines[0] == sku:
                        hit = re.fullmatch(r'Giá\s+((?:\d{1,3}(?:[.,]\d{3})+))\s*VNĐ', lines[1], re.I)
                        if hit:
                            spatial_price = hit.group(1).replace('.', '').replace(',', '')
                            spatial_literal = lines[1]
            if same_page_confirmation and confirmed['manufacturer_printed_price_vnd']:
                amount = confirmed['manufacturer_printed_price_vnd']
                price_text = spatial_literal
                confidence = 'VISUAL_CONFIRMED'
                reason = ''
                paired_count += 1
            elif spatial_price:
                amount = spatial_price
                price_text = spatial_literal
                confidence = 'SPATIAL_SAME_BLOCK'
                reason = ''
                paired_count += 1
            else:
                amount = ''
                price_text = ''
                confidence = 'UNRESOLVED'
                reason = raw_row['review_reason'] or 'PRICE_OR_CONTEXT_REQUIRES_REVIEW'
                unresolved_count += 1
            candidate_count += 1
            occurrences.append({
                'source_catalogue_id': SOURCE_ID, 'occurrence_id': f'{SOURCE_ID}-p{page_no:03d}-{idx:04d}',
                'brand': 'INAX', 'sku_source_text': sku, 'full_sku': sku,
                'pdf_page': page_no, 'printed_page': raw_row['printed_page'],
                'region_xyxy': geometry, 'evidence_excerpt': raw_row['evidence_excerpt_or_label'],
                'literal_price_text': price_text, 'paired_price_vnd': amount,
                'product_name': confirmed['manufacturer_product_name'] if confirmed else nearby_label,
                'category': confirmed['category'] if confirmed else raw_row['category'],
                'dimensions_or_specs': nearby_specs,
                'context_type': 'technical_or_compatibility_or_context' if page_no >= 80 else 'candidate_listing_or_context',
                'confidence': confidence, 'review_reason': reason,
            })
        coverage.append({'source_catalogue_id': SOURCE_ID, 'pdf_page': page_no,
                         'method': 'PyMuPDF native text + search_for coordinates; visual confirmation overlay',
                         'candidate_occurrences': candidate_count, 'paired_occurrences': paired_count,
                         'unresolved_occurrences': unresolved_count,
                         'coordinate_misses': sum(not r['region_xyxy'] for r in occurrences[-candidate_count:]) if candidate_count else 0,
                         'error': ''})
        # Durable bounded checkpoints, regenerated deterministically on rerun.
        if page_no in (35, 70, 107):
            write_csv(OUT / f'sku_occurrences_checkpoint_p{page_no:03d}.csv',
                      list(occurrences[0]), occurrences)
    grouped = defaultdict(list)
    for row in occurrences:
        grouped[row['full_sku']].append(row)
    skus = []
    exceptions = []
    for sku, items in sorted(grouped.items()):
        checked = verified.get(sku)
        prices = {r['paired_price_vnd'] for r in items if r['paired_price_vnd']}
        conflict = len(prices) > 1
        price = next(iter(prices)) if len(prices) == 1 else ''
        status = 'CONFLICT' if conflict else 'PRINTED_CONFIRMED' if price else 'UNRESOLVED'
        pages = ';'.join(str(x) for x in sorted({int(r['pdf_page']) for r in items}))
        listed = next((r for r in items if r['product_name']), items[0])
        skus.append({'source_catalogue_id': SOURCE_ID, 'brand': 'INAX', 'full_sku': sku,
                     'model': checked['model'] if checked else sku.split('/')[0].split('+')[0],
                     'variant_or_color': checked['variant'] if checked else '',
                     'product_name': checked['manufacturer_product_name'] if checked else listed['product_name'],
                     'series': '', 'category': checked['category'] if checked else listed['category'],
                     'dimensions_or_specs': listed['dimensions_or_specs'],
                     'item_kind': checked['product_kind'] if checked else 'uncertain',
                     'manufacturer_price_vnd': price, 'price_status': status,
                     'pdf_pages': pages, 'evidence_method': 'visual_card_and_native_text' if checked and price else 'spatial_same_block' if price else 'native_text_unresolved',
                     'occurrence_count': len(items)})
        if conflict or not price or '(' in sku or ')' in sku:
            exceptions.append({'source_catalogue_id': SOURCE_ID, 'full_sku': sku,
                               'reason': 'CONFLICTING_CONFIRMED_PRICES' if conflict else 'PARENTHETICAL_VARIANT_REVIEW' if '(' in sku or ')' in sku else 'PRICE_OR_ITEM_KIND_UNRESOLVED',
                               'pdf_pages': pages, 'occurrence_ids': ';'.join(r['occurrence_id'] for r in items),
                               'action': 'Review exact card/table cell or technical context before product decision'})
    for row in occurrences:
        if not row['region_xyxy']:
            exceptions.append({'source_catalogue_id': SOURCE_ID, 'full_sku': row['full_sku'],
                               'reason': 'NATIVE_TEXT_COORDINATE_MISSING', 'pdf_pages': str(row['pdf_page']),
                               'occurrence_ids': row['occurrence_id'],
                               'action': 'Inspect PDF page image; token may be split across text spans'})
    manifest = [{'source_catalogue_id': SOURCE_ID, 'brand': 'INAX', 'official_source_url': URL,
                 'title': 'Catalogue Phòng tắm INAX 2026', 'market': 'Vietnam', 'sector': 'bathroom',
                 'edition_or_revision': '04/2026', 'publication_or_effective_date_printed': '',
                 'pdf_sha256': digest, 'pdf_bytes': len(data), 'page_count': len(doc),
                 'retrieval_timestamp': args.retrieved_at,
                 'extraction_method_version': 'build_catalogue_edition_csv.py v1; PyMuPDF native text/coordinates + checked visual overlay'}]
    write_csv(OUT / 'catalogue_manifest.csv', list(manifest[0]), manifest)
    write_csv(OUT / 'sku_occurrences.csv', list(occurrences[0]), occurrences)
    write_csv(OUT / 'catalogue_skus.csv', list(skus[0]), skus)
    write_csv(OUT / 'extraction_exceptions.csv', list(exceptions[0]), exceptions)
    write_csv(OUT / 'page_coverage.csv', list(coverage[0]), coverage)
    assert len(raw) == 2348 and len(occurrences) == len(raw) + len(overlay_missing)
    assert all(any(o['pdf_page'] == int(r['pdf_page']) and o['sku_source_text'] == r['sku_original']
                   for o in occurrences) for r in raw)
    assert len(coverage) == 107 and {int(r['pdf_page']) for r in coverage} == set(range(1, 108))
    assert len(skus) == len(grouped) == len({(r['source_catalogue_id'], r['full_sku']) for r in skus})
    assert all(1 <= int(r['pdf_page']) <= 107 for r in occurrences)
    assert all(not r['paired_price_vnd'] or r['confidence'] in ('VISUAL_CONFIRMED', 'SPATIAL_SAME_BLOCK') for r in occurrences)
    summary = {'pdf_sha256': digest, 'pdf_pages': 107, 'raw_occurrences_preserved': len(raw),
               'visual_overlay_occurrences': len(overlay_missing), 'occurrences': len(occurrences),
               'distinct_sku_candidates': len(skus), 'confirmed_price_skus': sum(r['price_status']=='PRINTED_CONFIRMED' for r in skus),
               'unresolved_price_skus': sum(r['price_status']=='UNRESOLVED' for r in skus),
               'conflicting_price_skus': sum(r['price_status']=='CONFLICT' for r in skus),
               'exceptions': len(exceptions), 'failed_pages': sum(bool(r['error']) for r in coverage),
               'coordinate_misses': sum(int(r['coordinate_misses']) for r in coverage),
               'files_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.glob('*.csv')},
               'generated_at_utc': datetime.now(timezone.utc).isoformat()}
    (OUT / 'extraction_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
