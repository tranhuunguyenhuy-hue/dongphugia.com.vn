# TOTO General 2024 — native-text checkpoint

Official source: https://vn.toto.com/contents/wp-content/uploads/2023/11/TOTO-GEN_2024.pdf

The local source is 145,815,301 bytes, 225 PDF pages, SHA-256
`9a94011d053473c7ec62daa1b53351b983461fc61fb8dd1abccd689047f07f2c`.
The PDF itself is not committed. Reproduce with:

```sh
python3 scripts/catalogue/extract_toto_2024.py /path/to/TOTO-GEN_2024.pdf docs/catalogue/evidence/toto/2024-general
```

`sku_occurrences.csv` records every native-text code candidate with physical PDF
page, printed spread label when found, and nearby source text.
`catalogue_skus.csv` groups exact code strings across pages. Neither is a
visually verified list of products. Candidate strings include specifications,
diagram references, accessories, and combination codes. Do not import them into
a database or treat the distinct-code count as a product count.

`page_coverage.csv` reports 224 pages with native text and flags PDF page 151
for visual/OCR review. `extraction_exceptions.csv` records that exception.
The extractor found no explicit VND/price keywords in native text; every price
remains unresolved. Product names, categories, variants, manufacturer prices,
and association between codes and product cards require page-by-page visual QA.
The reported verified-product and verified-price counts are therefore zero.

This checkpoint is source evidence for Issue #204 only. No Production or
database data was read or changed.
