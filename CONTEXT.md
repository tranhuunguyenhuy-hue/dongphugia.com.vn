# Dongphugia — project context and domain vocabulary

Read this **on demand**, not at the start of every Codex task. This is a
compressed navigation/context file; the original detailed definitions are
preserved in [the full glossary](docs/agents/domain-glossary-full.md).
Use the full glossary only if a changed business concept needs its exact rules.

## Purpose and boundaries

Dongphugia is a Vietnamese building-materials catalogue and request-based
commerce website. Restore public functionality and ship small independent
fixes to `https://www.dongphugia.vn` quickly.

Public app: browse categories, products, search, editorial pages and guest
requests. Staff Admin: separate authenticated application for catalogue,
content and sales operations. Do not treat a staff-confirmed order request
as paid, accepted or fulfilled. The current delivery target and provider must
be verified from live state, not inferred from migration/legacy documents.

## Essential vocabulary

| Term | Meaning / invariant |
| --- | --- |
| Public Product | A product that passed publication, category, image, content, price and availability requirements. |
| Public Price | Positive Dongphugia retail price; manufacturer MSRP or quote price cannot replace it. |
| Product Family | Explicit grouping of **existing** independent Products/PDPs, not new SKU combinations or bundles. |
| Variant Member | One existing Product in a Family; selecting it navigates to its own PDP, price and URL. |
| Configuration Group | Optional grouping of Family members by an approved distinction; not generated variants. |
| Package/BOM | Included-item assembly, **not** a Product Family or variant selector. |
| Category / Brand / Collection | Primary taxonomy / manufacturer / manually curated products; these are distinct. |
| Availability | `InStock`, `PreOrder`, `QuoteOnly`, `Discontinued`; do not infer from missing prices. |
| Quote Request / Quote | Customer request / subsequent staff-negotiated offer; not the same as retail Cart or Order. |
| Order Item Snapshot | Immutable identity and monetary facts kept with each order line despite catalogue edits. |
| Blog Post / Managed Media | Canonical editorial content / owned and verified media. |
| Publishing Agent | Authorized machine identity publishing via the controlled Publishing API. |
| Staff Role / Capability | Fixed staff responsibilities and granted actions; authorization is server-side. |

## Ongoing work: live source of truth

- Phase 2 scope: [Issue #270](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/270):
  cart/order requests, Admin CMS, product-family variants and footer parity.
- Commerce candidate: [PR #272](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/272)
  (status must be rechecked before relying on it).
- Fast-delivery process changes:
  [PR #282](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/pull/282)
  (status must be rechecked).
- Bunny CDN, database recovery, and public cutover have independent histories.
  Do not assume a backup, Preview build, merged PR or historical AWS/Supabase
  snapshot proves current Production readiness.

GitHub issues/PRs provide current task state; executable code and the actual
provider control plane establish runtime facts. Update this summary only when
project direction changes, not after every commit.
