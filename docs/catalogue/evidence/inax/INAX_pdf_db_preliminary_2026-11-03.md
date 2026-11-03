# Preliminary INAX PDF-to-project SKU count — 03 Nov 2026 ICT

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
