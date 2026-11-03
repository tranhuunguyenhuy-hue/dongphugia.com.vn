# INAX 2024–2026 PDF ↔ V1 SKU audit — preliminary, read-only

**Checkpoint:** 03 Nov 2026 02:45:02 UTC (09:45:02 ICT), approved Supabase project `bonxyxluzlxfkdetryoo`, database `postgres`, brand resolved by `dpg_app.brands.slug='inax'`. There are **2,381 INAX Product rows / 2,381 distinct full DB SKUs**, with aggregate fingerprint `3cfba37fb7e6c3e81b4c723c5ccdf6e8`. SQL was SELECT-only. Current Public snapshot identity remains **UNKNOWN**. This audit supersedes the earlier arbitrary-slash-suffix DB-row count in `INAX_pdf_db_preliminary_2026-11-03.md`; that file remains for traceability.

**Inputs:** the official INAX bathroom PDF `catalogue_skus.csv` Git blobs at PR #258: 2024 SHA-256 `b793bbf0d65fc80e18cab836f6aaf3fb3e81dc595d6a2808a458425f5d6bdc1b`, 2025 `b0e485883702e3f5a9094b503cdee9a2e68b0e6f32cc78ea7f200c9d5fbc1287`, 2026 `6b2084a0b5a32fe3b32ee32c6f4ec738744bded4fac974b4faf48eccc01b1d0f`. These contain code **candidates**, including technical and compatibility mentions. The companion [`INAX_2024_2026_code_reconciliation.csv`](INAX_2024_2026_code_reconciliation.csv) has one row per code per edition (2,066 rows; 761 distinct codes), official source URL, PDF SHA/page(s), source confidence, matched DB SKU strings and a separate ambiguous-review column. It contains no database IDs or unrelated rows.

## Controlled match counts

Rule: compare full strings with `UPPER(TRIM(...))`. The *only* additional color tier is DB SKU equal to full PDF code plus terminal `/BW1` or `/SG9`. No arbitrary slash suffix, fuzzy alias or component/kit collapse is accepted.

| PDF edition | Distinct code candidates | Exact codes | Additional controlled color codes | Matched codes | No match |
|---|---:|---:|---:|---:|---:|
| 2024 | 712 | 248 | 353 | 601 | 111 |
| 2025 | 697 | 243 | 345 | 588 | 109 |
| 2026 | 657 | 236 | 339 | 575 | 82 |
| **Unique union** | **761** | **266** | **363** | **629** | **132** |

Reverse DB-row view: **266 exact + 370 controlled-color = 636/2,381 associated DB Products**, leaving **1,745 with no match by these rules**. Of the 636, sanitary has 619, kitchen 17, tile zero. The 629 PDF codes and 636 DB rows differ because some PDF codes map to multiple valid terminal-color strings. Edition rows repeat codes across years and must not be summed. A match is a string/evidence relationship, **not final sellable-product equivalence**.

## Correction of five overbroad suffix matches

The earlier report admitted any `PDF code + /…` DB SKU and counted **375** suffix DB rows, **641** associated rows and **1,740** unmatched. Restricting to terminal `/BW1` or `/SG9` removes the five DB rows below: **370** suffix rows, **636** associated and **1,745** unmatched. Both methods yield 629 distinct matched PDF codes because each affected base code also has a separate controlled match. The five rows remain in the CSV `ambiguous_db_skus` column with `AMBIGUOUS_COMPONENT_OR_LEGACY`; they are excluded from `matched_db_skus` and from the 636.

| PDF code | Ambiguous DB SKU | Reason |
|---|---|---|
| `AC-939VN` | `AC-939VN/BW1-legacy-10025` | Explicit legacy marker |
| `L-284VFC` | `L-284VFC/BW1+L-284VC/BW1` | Two-component basin kit |
| `L-285VFC` | `L-285VFC/BW1+L-288VC/BW1` | Two-component basin kit |
| `L-297VFC` | `L-297VFC/BW1+L-297VC/BW1` | Two-component basin kit |
| `S-17V` | `S-17V/BW1-legacy-525` | Explicit legacy marker |

The five relevant PDF code rows, their edition years and page numbers remain in the reconciliation CSV. The 2026 visually checked subset has **82 `sellable_product` codes**: 78 associated with a DB string by the controlled rules, and four without one: `AC-G216VN/BKG`, `AL-286V (FC)`, `AL-662V`, `AL-692V`. The parenthetical `AL-286V (FC)` needs exact identity review; these four are not automatic add candidates.

## Provenance and source gaps for the 1,745 unmatched DB Products

All 2,381 INAX Products have `source_system='hita'` and a `source_url` host `hita.com.vn`; **2,379/2,381** have a `product_source_mappings` row. These fields establish recorded retailer-source provenance, not current manufacturer status. The earlier statement that every *broad-rule* unmatched Product had a mapping does not imply all 2,381 do.

| Unmatched cohort | DB rows | Evidence lead | Current source verdict |
|---|---:|---|---|
| Sanitary `product_type` prefix `phu-kien` | **1,356** | [Official 2021 accessory catalogue page](https://www.inax.com.vn/vi/catalogues/catalogue-phu-kien-2021/); [Hita component example `AC-1035B/BW1`](https://hita.com.vn/than-bon-cau-khong-phu-kien-khong-nap-ngoi-inax-ac-1035bbw1-18270.html) links a retailer-hosted “23–24” accessory document. Neither proves 2026 SKU availability. | `SOURCE_UNVERIFIED` per SKU |
| Other/unclassified sanitary | **115** | [Official INAX product/category index](https://www.inax.com.vn/vi/san-pham/) and older/project/supplement catalogues; exact variant, finished good and combo pages remain unbound. | `SOURCE_UNVERIFIED` per SKU |
| Architectural tile | **209** | [Official 2026 tile catalogue page](https://www.inax.com.vn/vi/catalogues/2026_catalogue_gach-kien-truc-inax/) and 2024/2025 tile editions on the manufacturer index; tile PDF bytes/SKUs have not been compared here. | `SOURCE_UNVERIFIED` per SKU |
| Kitchen | **65** | The [official INAX product index](https://www.inax.com.vn/vi/san-pham/) lists kitchen faucets; these three PDFs are bathroom editions and do not establish coverage of the 65. | `SOURCE_UNVERIFIED` per SKU |

The four cohorts sum to 1,745. No code's absence from the compared PDF CSVs proves discontinuation, false brand attribution or safe retirement. The Hita page is **retailer evidence only**; its linked 23–24 file is not authenticated as a manufacturer PDF. Do not adopt a Hita price or overwrite DPG price.

**Next gate:** obtain and checksum applicable official accessory, tile, kitchen and additional bathroom sources; improve exact SKU/variant/kit evidence and bind a current Public snapshot. Full row-level W4, hide/delete, price changes, merge, Production and CP2 remain outside this read-only audit.
