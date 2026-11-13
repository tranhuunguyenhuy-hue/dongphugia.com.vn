# V1 — current state / evidence boundary

**Last read-only Cloudflare verification: 2026-11-13.** This file records observations, **not** a claim that recovery is complete. Revalidate before applying any Production changes.

## Decision and milestone state

- [Master #306](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/306) — approved V1 reset / sole authority.
- [M1 #307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307): **ACTIVE, NOT YET ACCEPTED**. Hosted DB completeness and Production DB-backed Public routes: **UNKNOWN / not demonstrated**.
- [M2 #308](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/308): **QUEUED**. One fixed named Worker Preview `staging` INSIDE Production Worker chosen, but no deployed URL/functional parity verified yet.
- [M3 #309](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/309): **QUEUED**. Owner permits full legacy Admin+Hyperdrive+real Auth on the SAME fixed Preview, isolated TEST DB. Hosted end-to-end not verified.
- [M4 #310](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/310): **QUEUED**. No current Admin Production deploy verified.
- [M5 #311](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/311): **QUEUED**.

## Provider observations

| Item | Last observed | Limitations |
| --- | --- | --- |
| Cloudflare primary account | `d54f3402b9d112ab64d6135e0e3f1fb1` | V1 only; do not use V2 account |
| Fixed Preview `staging` INSIDE `dongphugia-v1-public-production` | Approved new M2/M3 destination; current deployed URL unknown/not proven | Explicit Preview bindings/secrets, isolated test DB/Hyperdrive and real auth required |
| Old separate Worker `dpg-staging` (obsolete) | Earlier version `f0cabc41-f024-46cc-8978-510c3d8c1216` | Leave untouched; no M2/M3 deployment there |\n| Production Worker | `dongphugia-v1-public-production`; version `7d0194d7-b007-4fb0-9fd9-d365ca9de834` deployed 2026-11-04 15:05 UTC | Public snapshot, not verified live PostgreSQL |
| Public domains | `www.dongphugia.vn`, `dongphugia.vn` → Worker Production deployment | Fixed Preview has independent URL after first successful deployment, no new custom domain |
| Worker bindings | Both `nodejs_compat` and assets; **no Hyperdrive binding**, no listed Worker secrets | Does not prove external DB cannot be used by other paths; actual code path must be inspected |
| Supabase V1 candidate | `bonxyxluzlxfkdetryoo`, schema proposed `dpg_app` | Hosted schema/rows, auth and source-of-truth **not reverified** |
| Recovery source | PR #300 legacy Admin Products/Blog; PR #301 local Workerd; PR #304 local scoped DB role | Local proof only, no hosted production DB import or Admin acceptance |
| Local recovery count | about **17,752 Products, 10 Blog posts** in a documented local restoration | Reconcile actual source and hosted target; never treat as already in Supabase |

## Next real work

Agent assigned to M1 must: verify actual target/source; capture backup and restore proof; reconcile hosted product/blog inventory; implement live read-only Product+Blog Public path with cached DB reads; keep snapshot rollback; verify actual Production URL and counts. **No Phase 2 work. M1 first; one fixed Preview reserved for M2/M3.**

After M1 succeeds, update this file with deployed SHA, measured DB counts, source/freshness evidence, acceptance URL, rollback and remaining issues. Keep UNKNOWNs visible rather than inventing success.


## Archived identity — never confuse with V1 Production

Historical LEO-539 isolated, synthetic-only Supabase test project: `tlmgudfhsyzayiazuugf`, name `dongphugia-runtime`, Singapore `ap-southeast-1`. This is **historical evidence, not the selected Production target**; it is kept here solely to preserve security-boundary provenance and avoid accidental use in M1. The active candidate V1 project requires fresh verification as described above.
