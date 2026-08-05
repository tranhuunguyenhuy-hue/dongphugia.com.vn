# LEO-493 Phase C v3.2 — Active product inventory and gating

- Source commit at generation: `b8b586fbc79ebf7ad9e453191920c93e94a4dd40`
- Policy hash: `9e93c0f06c5eb8307d528372070c50e868c7a62fd5cc9008492ae6bcead0fa88`
- Snapshot hash: `97cd93da438bbf3db826b0dd679b412ab1afefcbe772220c972b935c25acd665`
- Manifest checksum: `1a5a3a730c92e82d42e9fa61f07bf59e3b567397982b8df064c486ff9c0d610f`
- Binding: `INVENTORY_ONLY_NO_PROPOSAL` — no scaled prose generated in Phase C inventory turn.
- Scope: every active `products.is_active = true` row from the canonical production runtime, read-only; no production write.

## Gate result

- REWRITE_IMPORTANT: **905** — complete approved family, visible Before >=500 characters, and at least one embedded description image.
- CONTENT_REVIEW_CANDIDATE: **286** — one evidence gate, ambiguous identity/family, or identity blocker.
- KEEP_EXISTING_CONTENT: **4780** — accessories/spares/components, outside approved families, or sparse source.

Strict cohort recommendation: keep the gate unchanged. The eligible rewrite cohort is 905 of 5971; do not relax the >=500 + embedded-image rule to reach a target scale. Coordinator acceptance is required before any content generation.

### Gate

| Giá trị | Số lượng |
|---|---:|
| CONTENT_REVIEW_CANDIDATE | 286 |
| KEEP_EXISTING_CONTENT | 4780 |
| REWRITE_IMPORTANT | 905 |

### Important family

| Giá trị | Số lượng |
|---|---:|
| AMBIGUOUS | 80 |
| BATHTUB | 305 |
| LAVABO | 830 |
| OUTSIDE_APPROVED_FAMILY | 3813 |
| TOILET | 838 |
| TOILET_SEAT | 34 |
| URINAL | 71 |

### Brand

| Giá trị | Số lượng |
|---|---:|
| 65prl | 2 |
| american-standard | 16 |
| ariston | 18 |
| ascolano | 3 |
| atmor | 529 |
| baltimore | 2 |
| boost | 3 |
| boost-balance | 9 |
| boost-mineral | 1 |
| boost-natural | 11 |
| caesar | 48 |
| cotto | 2 |
| coway | 8 |
| crea-la | 3 |
| dai-thanh | 20 |
| dgaudy | 1 |
| dimore | 2 |
| duravit | 10 |
| elica | 43 |
| ferroli | 24 |
| fun | 3 |
| fusion | 1 |
| grohe | 23 |
| hansgrohe | 1 |
| helsinki | 1 |
| inax | 1773 |
| intense | 3 |
| intrecci | 3 |
| invictus | 1 |
| jardin | 2 |
| kaff | 84 |
| kalon | 1 |
| karofi | 21 |
| kech | 8 |
| kluger | 54 |
| log | 1 |
| marvel-gala | 4 |
| marvel-x | 3 |
| mimesis | 5 |
| mitsubishi-cleansui | 21 |
| moen | 608 |
| motley | 6 |
| mowoen | 45 |
| nanoco | 9 |
| onix | 3 |
| onyce | 5 |
| panasonic | 24 |
| papier | 5 |
| philips | 9 |
| rheem | 3 |
| samsung | 10 |
| tele-di-marmo-lumia | 4 |
| tele-di-marmo-onyx | 3 |
| toshiba | 3 |
| toto | 2073 |
| unilever-pureit | 14 |
| varana | 4 |
| varana-stone | 6 |
| vein-stone | 2 |
| viglacera | 367 |

### Category

| Giá trị | Số lượng |
|---|---:|
| gach-op-lat | 165 |
| thiet-bi-bep | 277 |
| thiet-bi-ve-sinh | 5344 |
| vat-lieu-nuoc | 185 |

### Description length bucket

| Giá trị | Số lượng |
|---|---:|
| 0 | 1 |
| 1_199 | 735 |
| 1000_PLUS | 1694 |
| 200_299 | 966 |
| 300_499 | 877 |
| 500_999 | 1698 |

### Embedded description image count

| Giá trị | Số lượng |
|---|---:|
| 0 | 3022 |
| 1 | 1785 |
| 2 | 977 |
| 3 | 112 |
| 4 | 15 |
| 5 | 11 |
| 6 | 6 |
| 7 | 12 |
| 8 | 10 |
| 9 | 9 |
| 10 | 5 |
| 11 | 3 |
| 12 | 2 |
| 13 | 1 |
| 15 | 1 |

### Media risk

| Giá trị | Số lượng |
|---|---:|
| BUNNY_ONLY | 5946 |
| HITA_HOSTED | 4 |
| MIXED | 20 |
| NO_MEDIA | 1 |

## Policy and safety notes

- Accessory/component exclusions are applied to explicit terms for accessories, mounting/installation parts, plumbing parts, hardware, replacement parts, bases, supports, drains, valves, handles, hoses, screws, seals, brackets and related low-value components.
- A product is not rewritten merely because its name contains `bồn cầu` or `lavabo`; it must be a complete approved-family product and satisfy both source-evidence gates.
- Missing or duplicate raw SKU is a blocker row and is never guessed. Snapshot blocker counts are preserved in the private input and manifest.
- Accepted Phase-B media checkpoint artifacts are unchanged. This artifact reports inventory/gating only and performs no media relabeling or production mutation.
- Public artifact contains no raw HTML, live media URL, secret, connection value or PII. Private file is ignored and contains only minimum inventory metadata for later proposal work.
