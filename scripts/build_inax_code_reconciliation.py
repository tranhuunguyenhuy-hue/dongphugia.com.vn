#!/usr/bin/env python3
"""Join official INAX edition codes to a bounded read-only DB match response.

The JSON input must contain only catalogue codes and their matching DB SKU strings;
it is kept outside the repository. No IDs, product rows or credentials are needed.
"""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path

BASE = Path('docs/catalogue/evidence/inax')
EDITIONS = ('2024-09', '2025-09', '2026-04')
EXPECTED_AMBIGUOUS = {
    'AC-939VN/BW1-legacy-10025',
    'L-284VFC/BW1+L-284VC/BW1',
    'L-285VFC/BW1+L-288VC/BW1',
    'L-297VFC/BW1+L-297VC/BW1',
    'S-17V/BW1-legacy-525',
}
FIELDS = ('official_sku', 'edition', 'source_catalogue_id', 'official_pdf_url',
          'pdf_sha256', 'pdf_pages', 'source_confidence', 'matched_db_skus',
          'match_status', 'ambiguous_db_skus', 'ambiguous_status')


def read(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--matches-json', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    matches = json.loads(args.matches_json.read_text(encoding='utf-8'))
    by_sku = {row['sku']: row for row in matches}
    assert len(matches) == len(by_sku) == 761
    visual = {row['sku_full'] for row in read(BASE / 'INAX_2026_products_verified.csv')
              if row['verification_status'] == 'CONFIRMED'}
    rows = []
    for edition in EDITIONS:
        manifest = read(BASE / edition / 'catalogue_manifest.csv')[0]
        for source in read(BASE / edition / 'catalogue_skus.csv'):
            sku = source['full_sku']
            match = by_sku[sku]
            exact = match['exact_db_skus']
            controlled = match['controlled_db_skus']
            ambiguous = match['broad_only_db_skus']
            # This is only the Owner-approved plain terminal color-suffix tier.
            assert all(x.upper().strip() in (sku.upper().strip() + '/BW1',
                                              sku.upper().strip() + '/SG9') for x in controlled)
            assert all(x.upper().strip() == sku.upper().strip() for x in exact)
            assert not set(exact + controlled) & set(ambiguous)
            status = 'EXACT' if exact else 'CONTROLLED_COLOR_VARIANT' if controlled else 'NO_MATCH'
            if sku in visual and edition == '2026-04':
                confidence = 'VISUAL_CARD_CHECKED'
            elif source['manufacturer_price_vnd']:
                confidence = 'SPATIAL_PRICE_PAIR_CANDIDATE_CODE'
            else:
                confidence = 'CODE_CANDIDATE_UNRESOLVED'
            rows.append(dict(official_sku=sku, edition=edition,
                             source_catalogue_id=source['source_catalogue_id'],
                             official_pdf_url=manifest['official_source_url'],
                             pdf_sha256=manifest['pdf_sha256'], pdf_pages=source['pdf_pages'],
                             source_confidence=confidence,
                             matched_db_skus=';'.join(exact + controlled),
                             match_status=status,
                             ambiguous_db_skus=';'.join(ambiguous),
                             ambiguous_status='AMBIGUOUS_COMPONENT_OR_LEGACY' if ambiguous else ''))
    assert len(rows) == 2066
    for edition, expected in {'2024-09': (248, 353, 111),
                              '2025-09': (243, 345, 109),
                              '2026-04': (236, 339, 82)}.items():
        counts = Counter(row['match_status'] for row in rows if row['edition'] == edition)
        assert tuple(counts[key] for key in ('EXACT', 'CONTROLLED_COLOR_VARIANT', 'NO_MATCH')) == expected
    assert {row['official_sku'] for row in rows} == set(by_sku)
    assert {sku for row in rows for sku in row['ambiguous_db_skus'].split(';') if sku} == EXPECTED_AMBIGUOUS
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, lineterminator='\r\n')
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({'rows': len(rows), 'unique_official_codes': len(by_sku),
                      'ambiguous_db_skus': 5}, ensure_ascii=False))


if __name__ == '__main__':
    main()
