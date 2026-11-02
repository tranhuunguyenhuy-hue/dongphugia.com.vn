# Sanitary catalogue cleanup and V1 pricing

Status: approved product direction; CP0 documentation pending merge. This plan does not authorize an unreviewed database deletion or Production release. Track execution in one GitHub Issue with CP0–CP5.

## Outcome and boundary

On the Cloudflare/Supabase V1 stack, make the sanitary catalogue searchable and filterable with five customer-facing groups: Bồn cầu, Lavabo, Sen & vòi, Bồn tắm, Bồn tiểu. Types, installation styles, technology, material, and dimensions become attributes rather than further navigation levels. Preserve behavior of the other three sectors. DNS, AWS retirement, physical media deletion, and online checkout are out of scope.

Keep an existing SKU only when its manufacturer/model/SKU, verified source, launch year 2024 or later, correct image and group, required category attributes, and Dong Phu Gia regular selling price are confirmed. Remove small installation/decorative accessories. Washlets and complete product sets remain eligible. The required attribute matrix is derived from official manufacturer PDF catalogues, preferring Vietnam-market editions. Record URL, edition, market, PDF checksum and page. A PDF publication year is not proof of a model's launch year. Unknown facts are blocked, not guessed.

Each retained SKU keeps a separate listing card, URL, image, and price. Product Family links existing variants only; it does not generate SKUs or absorb package/BOM relations. Preserve the MS885 Product/Family contract and explicitly reconcile any approved change to its accepted membership before modifying its guard.

The two public prices are `price` (regular Dong Phu Gia selling price, required and positive) and optional `sale_price` (positive and below `price`). Keep `voucher_online_discount_amount` as an internal per-SKU online voucher: one fixed discount per distinct SKU per order, regardless of quantity. Voucher must be positive and below the current unit price. Do not promote voucher as usable until checkout exists. Public keeps phone/Zalo contact calls to action. Legacy price fields remain compatibility-only and cannot choose canonical values by maximum/minimum. Price work in this programme applies to sanitary products only.

## One decision manifest

CP1 produces one versioned, checksummed manifest based on a read-only reconciliation of legacy database, V1 database, and Public snapshot. Record for each affected SKU: source IDs and versions, KEEP/DELETE_CANDIDATE/BLOCKED, evidence and reason, year proof, PDF page, image, five-group mapping, attributes, Family/BOM relations, approved regular/promotion/voucher amounts, URL mapping, and order/quote/collection/content references. Sensitive rows and backups stay outside GitHub. GitHub receives sanitized counts, schema, checksum, and authorized evidence references.

Do not place a BLOCKED SKU in a deletion batch. Publish only retained products that meet every gate. An absent catalogue entry alone does not establish a pre-2024 launch or discontinuation. The Owner approves one consolidated manifest containing counts and impact before implementation is bound to it.

## Checkpoints

| Gate | Work | Acceptance evidence |
| --- | --- | --- |
| CP0 | Merge this decision document; create one tracking Issue with CP0–CP5. | Linked document, Issue, commit; no unresolved product decision. |
| CP1 | Verify live target and snapshot identity, collect official PDFs, reconcile products, categories, prices, variants, references, and URLs once. | Owner-approved sanitized manifest, source checksums, counts and BLOCKED exceptions. |
| CP2 | In one implementation PR add migration and checksum-bound dry-run/apply tooling; five groups, attributes/filters, search API and route, variant links, two-price projection, V1 snapshot, SEO URL handling and focused tests. | Dry-run matches approved manifest, applicable lint/typecheck/tests and required CI pass; independent data/rollback review; PM-approved merge. |
| CP3 | Restore backup into isolation, rehearse migration and deletion, build exact Preview snapshot, test desktop/mobile search → filter → listing → PDP → variant → phone/Zalo, rehearse rollback. | One Owner-reviewed bundle: exact candidate/manifest, before/after counts, restore/rollback and Preview results. |
| CP4 | Revalidate Production target and CP3 approval, create fresh backup, freeze catalogue writes, apply approved batch and switch validated snapshot, then verify and thaw. | Exact candidate live, counts and history preserved, URL 200/301/410 and price/image/variant checks pass. |
| CP5 | Observe search, price, image and route failures for seven days; record fixes and handoff. | No blocking issue, rollback location and final report recorded; close Issue. |

At each checkpoint record result, evidence tied to commit/data checksum, PASS or BLOCKED, and next action. Recheck only changed inputs. A missing proof for one SKU blocks that SKU, not independent work.

## Implementation and release constraints

- Existing IDs and independent Product/PDP leaves remain stable. A Product belongs to at most one Family. A one-member Family shows no selector; removed variants have no live links. Package/BOM and order snapshots are reviewed before deletion.
- Search matches SKU, model, name and brand, prioritizing exact SKU/model. Until other sectors are supported, label its scope as sanitary. Filters use OR within one attribute and AND across attributes; changing filters resets pagination. The current price (sale when present) controls price filtering and sorting.
- The Public Worker must explicitly permit the new read-only search API and route. Version the DTO and snapshot; the current `price: null` projection is not suitable for published sanitary prices. Keep other sectors compatible.
- Redirect retained products with changed URLs directly by 301. Return 410 for a deleted product without a verified equivalent; never redirect en masse to the homepage. Update sitemap, canonical, internal and Family links, and bound indexable filter URLs.
- Apply tooling refuses a target/version/checksum drift and supports safe retry. Before permanent deletion, make a fresh backup and demonstrate isolated restore. Keep media bytes. Preserve order/quote history and block unresolved references. Never serve an old snapshot containing deleted SKUs after database mutation.
- Source changes follow task branch → PR → required CI → PM merge approval. Production and destructive data mutation need the exact approved manifest/candidate, recovery proof, and explicit Production approval under the repository workflow. DNS is a separate gate.

## Final acceptance

Five sanitary navigation groups; every published sanitary SKU has approved source/year/attributes/image/price; deletion equals the approved manifest; variants, prices and URLs agree across listing/search/PDP; desktop/mobile flows work; order/quote history and three other sectors remain intact; isolated restore and rollback pass; CP0–CP5 evidence lives in GitHub.
