# LEO-493 Phase B ground truth and first-pass report

Offline proposal-only package for the canonical 240-product snapshot. This report intentionally contains no raw HTML, live media URL, secret, private row or PII.

## Binding

- Policy contract: v3.1
- policyHash: `9e93c0f06c5eb8307d528372070c50e868c7a62fd5cc9008492ae6bcead0fa88`
- snapshotHash: `0d95b89d30332bd054c51446f32987c347eee47ea3d0e9761836dc57e29e87f7`
- proposalHash: `bbe29e457d126e991043b45102f3327f24b19597084789efd9f965906a039570`
- packageHash: `36d10c5b389de5b75e07b260f9a455780f143c772634fb98f8e599444a446c03`
- source commit used for generation: `269198c3a39b9f48179cf16b6a478833cbcfec99`
- products/media: **240 / 562**

## Ground-truth holdout

The holdout is deterministic and stratified by accepted regression coverage plus the lowest-id Phase-B records. The 1 accepted-regression records overlapping the 240-row snapshot are coordinator/PM-accepted human labels; the remaining 23 selected records are explicitly pending human label and are not treated as accepted. The full accepted pilot set is retained as 20 hash-bound references; 19 are outside this INAX-only snapshot and are not regenerated in this package.

## Editorial first pass

| Result | Count |
|---|---:|
| HUMAN_REVIEW | 115 |
| PASS | 125 |

Products with any explicit blocker/review reason: **209**. Sparse source, unclear media and non-inline-safe embedded media remain visible review reasons; no reason is silently converted into approval.

## Media decisions

| Action | Count |
|---|---:|
| KEEP_PRODUCT | 561 |
| KEEP_TECHNICAL | 1 |

Confirmed showroom/store/display removals are the only XOÁ action. Unknown non-showroom media remain GIỮ TẠM with residual-risk evidence. No replacement placeholder or new description asset is generated.

## Split by category and risk

### Category

| Category | Products |
|---|---:|
| gach-op-lat | 2 |
| thiet-bi-bep | 14 |
| thiet-bi-ve-sinh | 224 |

### Media risk

| Risk | Products |
|---|---:|
| BUNNY_ONLY | 240 |

## Safety and next action

- Existing embedded assets are retained in After when policy permits; confirmed showroom assets never appear in After.
- Accepted 20-product prose uses the stored accepted HTML unchanged after deterministic cleanup.
- No automatic Hita request/crawl/copy/rehost occurs; Bunny preview is private-dashboard only and Hita is manual one-asset view.
- This is a proposal package only. **Next action: independent coordinator review of the 240-product package and holdout before any later content phase.**
