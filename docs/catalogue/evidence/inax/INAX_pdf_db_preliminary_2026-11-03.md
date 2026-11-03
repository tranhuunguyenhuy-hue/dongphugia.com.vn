# Preliminary INAX PDF-to-project SKU count — 03 Nov 2026 ICT

**Historical checkpoint, superseded for DB-row suffix counts by [`INAX_2024_2026_reconciliation_audit.md`](INAX_2024_2026_reconciliation_audit.md).** The broad `PDF code + /…` rule below admitted five legacy/component DB SKUs. The controlled `/BW1` or `/SG9` result is 636 associated / 1,745 unmatched DB rows. This file is retained for traceability.

**Scope:** read-only count against approved V1 Supabase project `bonxyxluzlxfkdetryoo`, database `postgres`, `dpg_app.products` joined to `dpg_app.brands` resolved by `brands.slug='inax'`. SQL checkpoint: **2026-11-03 02:12:27 UTC** (09:12:27 ICT). Principal: `postgres`; INAX rows and distinct DB SKU strings: **2,381** each. Aggregate fingerprint `md5(string_agg(id || ':' || sku || ':' || publication_status, ',' ORDER BY id))` = `3cfba37fb7e6c3e81b4c723c5ccdf6e8`. No private database rows were exported. The current Public snapshot identity is **UNKNOWN**.

## PDF code candidates matched to database

| Official bathroom PDF edition | Distinct PDF full-code candidates | Exact full SKU in DB | DB SKU with PDF code plus `/` suffix only | Neither form found |
|---|---:|---:|---:|---:|
| INAX 2024 | 712 | 248 | 353 | 111 |
| INAX 2025 | 697 | 243 | 345 | 109 |
| INAX 2026 | 657 | 236 | 339 | 82 |
| **Unique union of three editions** | **761** | **266** | **363** | **132** |

The union row deduplicates exact PDF code strings across years. Thus **266 PDF code strings are present as exactly equal INAX DB SKUs**. Another **363 PDF code strings have a possible DB variant with an added `/` suffix**; the suffix was not validated as an equivalent manufacturer variant. The two groups together are 629 code candidates with an exact-or-suffix relationship, **not 629 approved sellable products**. A DB SKU can relate to several PDF codes, and a PDF code can relate to several DB rows. Counts in the edition rows must not be summed to form the union.

## Database-row view

| INAX DB Product rows at checkpoint | Exact SKU equals any PDF code | Added `/` suffix candidate only | Neither form found |
|---:|---:|---:|---:|
| **2,381** | **266** | **375** | **1,740** |

The 375 suffix-only DB rows correspond to 363 PDF code strings because more than one database variant may share a PDF base code. None of the 1,740 rows is classified as discontinued or safe to hide/delete: these three bathroom PDFs do not exhaust official INAX category/supplement/online coverage, and the extraction retains technical or compatibility mentions as candidates.

## Higher-evidence subset

Across the three editions, 433 unique code strings have a reliably paired printed manufacturer price in at least one edition: 100 exact DB matches, 302 suffix-only candidates, 31 neither. Within the separate **107 visually checked 2026 codes**, 28 match DB exactly, 74 have a suffix-only candidate, and five have neither. Printed manufacturer price is unrelated to the DPG selling price.

## Matching and evidence boundaries

- Exact means byte-for-byte equality of the full PDF code and `dpg_app.products.sku` after restricting DB rows to the brand resolved by slug `inax`. No slash, plus, hash, color or combo part was discarded.
- Suffix candidate means the DB SKU starts with the entire PDF code followed immediately by `/` and at least one further character. This is a **review lead**, not an established variant match. Other aliases and replacement codes were not assessed.
- Neither means neither of these two string forms was found in this one DB checkpoint. It does not establish that a product is missing from the business or no longer sold.
- Source input files: [`2024-09/catalogue_skus.csv`](2024-09/catalogue_skus.csv) SHA-256 `b793bbf0d65fc80e18cab836f6aaf3fb3e81dc595d6a2808a458425f5d6bdc1b`; [`2025-09/catalogue_skus.csv`](2025-09/catalogue_skus.csv) `b0e485883702e3f5a9094b503cdee9a2e68b0e6f32cc78ea7f200c9d5fbc1287`; [`2026-04/catalogue_skus.csv`](2026-04/catalogue_skus.csv) `6b2084a0b5a32fe3b32ee32c6f4ec738744bded4fac974b4faf48eccc01b1d0f`. Per-edition PDF hashes, page counts and exceptions are in each `extraction_summary.json` and `catalogue_manifest.csv`.
- Method: load each edition's distinct `full_sku` into a temporary SQL `VALUES` relation **within one SELECT statement**; compare `EXISTS` for exact equality and for the full-code-plus-slash prefix. Compute edition and union aggregates separately. A second aggregate reverses the relation to count DB Product rows. No SQL DDL/DML, persistent temp table, DB export or Production mutation.

This is the narrow preliminary count requested by the Owner, not the deferred W4 row-level reconciliation, current Public projection validation, product-retirement manifest or CP2 authorization.

## Follow-up: where the 1,740 nonmatching DB rows came from

Read-only provenance and shape audit at **2026-11-03 02:27 UTC** rechecked the same 2,381 INAX rows and unchanged aggregate fingerprint above. **All 2,381 `products.source_url` hosts are `hita.com.vn`**, including all 1,740 in the neither-form group. Every one of the 1,740 has at least one `product_source_mappings` row pointing to Hita. The overlapping mapping sources for this group are `hita-normalized-inax` (1,729 mapping rows, 1,726 distinct Products; first/last observed between 01 and 07 Jul 2026 UTC) and `hita` (1,578 mappings/Products, observed 05 Jun 2026 UTC). These are **recorded ingestion/source mappings**, not manufacturer confirmation or a model's launch/discontinuation date. Mapping counts overlap and must not be added.

| DB category among 1,740 with neither string form | Rows | Active rows | Public rows | Rows containing `/` | Rows containing `+` |
|---|---:|---:|---:|---:|---:|
| `thiet-bi-ve-sinh` | 1,466 | 1,036 | 1,466 | 289 | 28 |
| `gach-op-lat` | 209 | 54 | 209 | 197 | 0 |
| `thiet-bi-bep` | 65 | 49 | 65 | 1 | 0 |
| **Total** | **1,740** | **1,139** | **1,740** | **487** | **28** |

**Established reasons for the comparison gap:** the three compared PDFs are bathroom editions; the separate tile catalogues and kitchen/other supplements on [INAX's official catalogue index](https://www.inax.com.vn/vi/catalogues/) were not part of this PDF code union. This directly explains why a bathroom-PDF-only comparison cannot certify the 209 tile rows or 65 kitchen rows. Their absence from these PDFs is not evidence that the products are unofficial or discontinued. The 1,466 sanitary rows require further source and item-level review. Among them, 714 DB SKUs start with `A-`, while the three extracted PDF code sets contain only 23 distinct `A-` strings. The DB names in that 714-row group include 126 mentioning `van`, 42 `ống`, 37 `vòi` and 29 `lõi`/`ruột` (overlapping keyword counts), consistent with a substantial parts/accessories review workload. Their official status remains unverified.

**String and extraction diagnostics:** zero of the 1,740 neither-form rows match a PDF code after case/outer-space normalization, and zero after additionally stripping punctuation from both sides. Simple spelling punctuation is therefore not an evidenced explanation for these 1,740. Seventy-seven DB SKUs contain a PDF code as an internal substring (66 sanitary, 11 kitchen); this may be a combo/component relationship, but cannot be promoted to a product match. Among the 1,466 sanitary rows, 283 DB SKU strings do not begin with the extractor's expected `1–7 uppercase letters + hyphen` form, including 233 starting with a digit. The current regex can miss such code forms **if they occur in the PDF**; the figures alone do not prove that those exact DB SKUs appear in any PDF. The 289 slash-bearing and 28 plus-bearing sanitary rows need full variant/kit evidence.

**Likely remaining causes, not yet quantified as verdicts:** Hita-listed variants, components or kits absent from these three general bathroom editions; products shown in official category/project/accessory/online catalogues not yet extracted; historic or retailer-specific identifiers; or missed native-text/image/table codes. The data does **not** establish which of these applies to each DB Product. Before any row-level decision, acquire relevant official tile, kitchen, accessory and supplement PDFs plus current manufacturer product pages; improve extraction coverage for numeric/mixed-prefix codes; then review exact model/variant/combo evidence and the current Public snapshot. Keep all 1,740 as `UNKNOWN / NEEDS REVIEW` meanwhile. No DB or Production write was performed.
