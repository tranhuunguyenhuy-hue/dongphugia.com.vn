#!/usr/bin/env python3
"""Generic native-text manufacturer PDF to edition-specific evidence CSVs.

Conservative: all code-like tokens are kept; only exact two-line SKU/price
blocks receive a parsed price. Uncertain product identity remains flagged.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

import fitz

CODE = re.compile(r'(?<![A-Za-z0-9])([A-Z]{1,7}-[A-Z0-9.]+(?:[-/+#][A-Z0-9.]+)*(?:\s*\([A-Z0-9/]+\))?)(?![A-Za-z0-9])')
PRICE = re.compile(r'Giá\s+((?:\d{1,3}(?:[.,]\d{3})+))\s*VNĐ', re.I)


def write(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator='\r\n')
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', type=Path)
    parser.add_argument('output_dir', type=Path)
    parser.add_argument('--catalogue-id', required=True)
    parser.add_argument('--url', required=True)
    parser.add_argument('--title', required=True)
    parser.add_argument('--edition', required=True)
    parser.add_argument('--expected-sha256', required=True)
    parser.add_argument('--retrieved-at', required=True, help='UTC timestamp of acquired source bytes')
    args = parser.parse_args()
    raw = args.pdf.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != args.expected_sha256:
        raise SystemExit(f'PDF digest mismatch: {digest}')
    doc = fitz.open(stream=raw, filetype='pdf')
    occurrences, coverage = [], []
    for number, page in enumerate(doc, 1):
        blocks = page.get_text('blocks')
        page_text = page.get_text()
        page_rows = []
        for block in blocks:
            if len(block) < 5 or not isinstance(block[4], str):
                continue
            text = block[4]
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            for line in lines:
                for match in CODE.finditer(line):
                    sku = match.group(1)
                    exact_card = len(lines) == 2 and lines[0] == sku and PRICE.fullmatch(lines[1])
                    price_match = PRICE.fullmatch(lines[1]) if exact_card else None
                    price = price_match.group(1).replace('.', '').replace(',', '') if price_match else ''
                    literal = lines[1] if price else ''
                    method = 'SPATIAL_SAME_BLOCK' if price else 'UNRESOLVED'
                    # Table cells are separate text blocks: require an exact code
                    # cell, a single numeric cell to its right, same y-row, and
                    # a table header on the page. Never cross a second code cell.
                    if not price and len(lines) == 1 and lines[0] == sku and 'Mã sản phẩm' in page_text and 'Giá' in page_text:
                        candidates = []
                        for other in blocks:
                            if other is block or not isinstance(other[4], str):
                                continue
                            cell = other[4].strip()
                            if (20 <= other[0] - block[2] <= 155 and
                                abs((other[1] + other[3])/2 - (block[1] + block[3])/2) <= 2.5 and
                                re.fullmatch(r'\d{1,3}(?:[.,]\d{3})+', cell)):
                                intervening = any(b is not block and b is not other and
                                                  block[2] < b[0] < other[0] and
                                                  abs((b[1]+b[3])/2 - (block[1]+block[3])/2) <= 2.5 and
                                                  CODE.search(b[4]) for b in blocks if isinstance(b[4], str))
                                if not intervening:
                                    candidates.append(cell)
                        if len(candidates) == 1:
                            literal = candidates[0]
                            price = literal.replace('.', '').replace(',', '')
                            method = 'SPATIAL_TABLE_ROW'
                    region = ','.join(f'{value:.1f}' for value in block[:4])
                    page_rows.append({
                        'source_catalogue_id': args.catalogue_id,
                        'occurrence_id': f'{args.catalogue_id}-p{number:03d}-{len(page_rows)+1:04d}',
                        'brand': 'INAX', 'sku_source_text': sku, 'full_sku': sku,
                        'pdf_page': number, 'printed_page': '', 'region_xyxy': region,
                        'evidence_excerpt': text[:180].replace('\n', ' | '),
                        'literal_price_text': literal, 'paired_price_vnd': price,
                        'product_name': '', 'category': '', 'dimensions_or_specs': '',
                        'context_type': 'native_text_block_candidate',
                        'confidence': method,
                        'review_reason': '' if price else 'PRICE_OR_ITEM_KIND_UNRESOLVED'})
        occurrences.extend(page_rows)
        coverage.append({'source_catalogue_id': args.catalogue_id, 'pdf_page': number,
                         'method': 'PyMuPDF native text block/coordinates v1',
                         'candidate_occurrences': len(page_rows),
                         'paired_occurrences': sum(bool(row['paired_price_vnd']) for row in page_rows),
                         'unresolved_occurrences': sum(not row['paired_price_vnd'] for row in page_rows),
                         'coordinate_misses': 0, 'error': ''})
        if number % 35 == 0:
            write(args.output_dir / f'sku_occurrences_checkpoint_p{number:03d}.csv', occurrences)
    grouped = defaultdict(list)
    for row in occurrences:
        grouped[row['full_sku']].append(row)
    skus, exceptions = [], []
    for sku, items in sorted(grouped.items()):
        prices = sorted({row['paired_price_vnd'] for row in items if row['paired_price_vnd']})
        status = 'CONFLICT' if len(prices) > 1 else 'SPATIAL_PAIRED' if prices else 'UNRESOLVED'
        pages = ';'.join(str(page) for page in sorted({int(row['pdf_page']) for row in items}))
        skus.append({'source_catalogue_id': args.catalogue_id, 'brand': 'INAX', 'full_sku': sku,
                     'model': sku.split('/')[0].split('+')[0].split(' (')[0], 'variant_or_color': '',
                     'product_name': '', 'series': '', 'category': '', 'dimensions_or_specs': '',
                     'item_kind': 'uncertain', 'manufacturer_price_vnd': prices[0] if len(prices) == 1 else '',
                     'price_status': status, 'pdf_pages': pages,
                     'evidence_method': 'native_text_exact_two_line_block' if len(prices) == 1 else 'native_text_unresolved',
                     'occurrence_count': len(items)})
        if status != 'SPATIAL_PAIRED' or '(' in sku:
            exceptions.append({'source_catalogue_id': args.catalogue_id, 'full_sku': sku,
                               'reason': 'DIVERGENT_PRICES' if status == 'CONFLICT' else 'PARENTHETICAL_VARIANT_REVIEW' if '(' in sku else 'PRICE_OR_ITEM_KIND_UNRESOLVED',
                               'pdf_pages': pages, 'occurrence_ids': ';'.join(x['occurrence_id'] for x in items),
                               'action': 'Inspect exact card/table cell and item identity before product decision'})
    manifest = [{'source_catalogue_id': args.catalogue_id, 'brand': 'INAX', 'official_source_url': args.url,
                 'title': args.title, 'market': 'Vietnam', 'sector': 'bathroom',
                 'edition_or_revision': args.edition, 'publication_or_effective_date_printed': '',
                 'pdf_sha256': digest, 'pdf_bytes': len(raw), 'page_count': len(doc),
                 'retrieval_timestamp': args.retrieved_at,
                 'extraction_method_version': 'extract_manufacturer_edition.py v1; PyMuPDF native text blocks'}]
    assert len(coverage) == len(doc)
    assert len(skus) == len({(row['source_catalogue_id'], row['full_sku']) for row in skus})
    assert all(1 <= int(row['pdf_page']) <= len(doc) for row in occurrences)
    assert all(not row['paired_price_vnd'] or row['literal_price_text'] for row in occurrences)
    for name, rows in [('catalogue_manifest', manifest), ('sku_occurrences', occurrences),
                       ('catalogue_skus', skus), ('extraction_exceptions', exceptions),
                       ('page_coverage', coverage)]:
        if rows:
            write(args.output_dir / f'{name}.csv', rows)
    summary = {'source_catalogue_id': args.catalogue_id, 'pdf_sha256': digest,
               'pdf_pages': len(doc), 'occurrences': len(occurrences), 'distinct_sku_candidates': len(skus),
               'paired_price_skus': sum(x['price_status'] == 'SPATIAL_PAIRED' for x in skus),
               'unresolved_price_skus': sum(x['price_status'] == 'UNRESOLVED' for x in skus),
               'conflicting_price_skus': sum(x['price_status'] == 'CONFLICT' for x in skus),
               'exceptions': len(exceptions), 'failed_pages': 0,
               'files_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in args.output_dir.glob('*.csv')}}
    (args.output_dir / 'extraction_summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
