# LEO-493 Phase B rework checkpoint

- Scope: deterministic 24-product checkpoint only; remaining 216 products remain pending and are not silently promoted.
- Source commit: `296a950e0e41aa784d123dd5b46416ca82344dae`
- Policy hash: `9e93c0f06c5eb8307d528372070c50e868c7a62fd5cc9008492ae6bcead0fa88`
- Snapshot hash: `0d95b89d30332bd054c51446f32987c347eee47ea3d0e9761836dc57e29e87f7`
- Proposal hash: `1846c27dd51638d01731179a2420d574ee09e49e3536b0c0b3cdfebf9beb73c7`
- Package hash: `9896a6be16c879763491ee9f7a857c416103491cd8196d1e86360dde87048344`
- Selection: sort by immutable id; 20 lowest sanitary rows plus accepted overlap 61-1361-VN; 2 lowest other kitchen rows; exact tile 355SD/CMG-1B; dedupe raw SKU; sort final by id.
- Snapshot truth: 240 unique INAX products / 562 media refs; this checkpoint contains 24 products / 118 media refs.

## Editorial holdout

All 24 selected products have a separate MANUALLY_REVIEWED holdout status. The holdout is not derived from pending labels. 24 are first-pass reviewed without a material blocker; 0 retain explicit evidence-based review reasons. No universal 3-heading/3-paragraph skeleton is used: 9 narrative families, 24 opening keys and 21 closing keys are present.

## Media visual holdout

The 24 manually reviewed media refs were opened from existing Bunny references in the private local review. 24 labels are separate from 70 refs that remain conservatively pending visual review. Manual labels: {"KEEP_PRODUCT":23,"KEEP_TEMPORARY":1}. Baseline host/kind agreement is 23/24; this is a measured baseline comparison, not a claim of classifier precision on the pending set.

Every unreviewed Bunny asset is GIỮ TẠM unless it is a duplicate of a manually reviewed fingerprint. KEEP_PRODUCT is used only where the screenshot visibly showed a product packshot/render. The selected tile swatch was retained GIỮ TẠM because it was not a dedicated packshot. No Hita showroom was visually confirmed in this checkpoint; no removal is invented.

## Official-status evidence

LEO-492 sample checksum is `1a7095eac86b7cdb2f9034aa9cf6d3a949eb128a18be38baf5f7dae75dde8c68`: 1 ACTIVE_CURRENT, 1 strict variant conflict and 28 REVIEW. The result is NO-GO for blind extension. All checkpoint rows remain `UNRESOLVED_REVIEW`; no manufacturer-current claim, archive, delete or automatic status mutation is made.

## Counts

| Metric | Count |
| --- | ---: |
| Products | 24 |
| Media refs | 118 |
| Manually reviewed products | 24 |
| Manually reviewed media | 24 |
| Pending visual media | 70 |
| Explicitly blocked products | 0 |

### Media actions

| Action | Count |
| --- | ---: |
| KEEP_PRODUCT | 46 |
| KEEP_TEMPORARY | 72 |

### Categories

| Category | Count |
| --- | ---: |
| gach-op-lat | 1 |
| thiet-bi-bep | 3 |
| thiet-bi-ve-sinh | 20 |

## Safety and next action

- Committed public artifacts contain no live media URL, raw HTML or private snapshot rows.
- Private artifacts are ignored and contain only the minimum checkpoint inputs needed for offline review.
- Hita remains manual-only; no automatic Hita request, crawl, copy or rehost occurred.
- No production/database/product/media/CDN/DNS/deploy mutation occurred.
- Next action: Coordinator independently inspect this checkpoint and either accept the evidence pattern or return targeted rework in this same worker thread before the remaining products are generated.
