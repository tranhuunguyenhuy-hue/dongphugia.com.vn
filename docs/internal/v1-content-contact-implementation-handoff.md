# V1 Content + Showroom + Support + Contact Request — Implementation Handoff

**Status:** Owner-review candidate; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Public section:** `08 — CONTENT / SHOWROOM / SUPPORT` (`920:2`)  
**Admin authority:** page `02 — ADMIN — Operational Wireframes` (`31:11`)  
**Linear:** LEO-573, LEO-581, LEO-572

> [!IMPORTANT]
> Do **not** implement until 100% launch-critical Public + Admin wireframes are Owner-approved and the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.
>
> The current Content/Showroom/Support Desktop + Mobile frames are structurally QA-clean and ready for Owner review, not approved/frozen yet.

## 1. Scope

This handoff covers:

- Content Hub `/cam-nang`;
- Guide detail `/cam-nang/huong-dan/{slug}`;
- Inspiration detail `/cam-nang/cam-hung/{slug}`;
- Buying Guide detail `/cam-nang/tu-van-mua/{slug}`;
- flexible Landing Page route owned by a Content record;
- Showroom / Contact `/showroom`;
- generic Support `/ho-tro/{slug}`;
- Public Contact Request intake;
- Admin Marketing Content/Campaign and Customer Care continuity.

It does not restore Blog-only CMS authority or create a generic page-builder/runtime-code system.

## 2. Current Figma authority

Desktop:

- `920:6` — D16 Content Hub.
- `920:53` — D17 Guide Detail.
- `920:80` — D18 Inspiration Detail.
- `920:107` — D19 Buying Guide Detail.
- `920:134` — D20 Landing Page.
- `920:168` — D21A Showroom / Contact.
- `920:194` — D21B Contact submitted.
- `920:208` — D22 Support Page.

Mobile:

- `920:227` — M16 Content Hub.
- `920:263` — M17 Guide Detail.
- `920:285` — M18 Inspiration Detail.
- `920:307` — M19 Buying Guide Detail.
- `920:329` — M20 Landing Page.
- `920:357` — M21A Showroom / Contact.
- `920:380` — M21B Contact submitted.
- `920:393` — M22 Support Page.

All 16 current frames have passed structural QA for missing fonts, root-boundary overflow and frame overlap.

Admin continuity:

- `31:889` — A22 Content List.
- `31:899` — A23 Content Editor.
- `933:2` — A24 Campaign List.
- `933:139` — A25 Campaign Editor.
- `934:2` — A29 Consultation Requests.

## 3. Canonical Content types

V1 types:

- `GUIDE`;
- `INSPIRATION`;
- `BUYING_GUIDE`;
- `LANDING_PAGE`.

Content Hub aggregates published editorial entries and presents the three editorial families Guide / Inspiration / Buying Guide. It is not a Product catalogue substitute.

Landing Page owns its route through the Content record/configuration. This does not authorize arbitrary legacy route inheritance.

## 4. Flexible block contract

Content uses ordered typed blocks with a closed/validated vocabulary. Reusable blocks may include:

- heading;
- paragraph/rich text within approved sanitation rules;
- media;
- callout;
- Product reference;
- Category reference;
- Brand reference;
- manually ordered Product-reference group;
- CTA;
- simple approved layout/grouping metadata.

Do not store executable code/arbitrary JSX/HTML page-builder logic in Content blocks.

## 5. Canonical references

Editorial content may reference canonical Product, Category and Brand records.

**Do not copy commerce truth into Content JSON.**

Product references obtain current public-safe canonical data at render time, including price/availability/media where appropriate.

Marketing may control presentation such as editorial heading/copy/media crop/CTA/order, but does not create independent SKU/price/category/availability truth.

## 6. Content publication

Authorized Marketing/Admin roles may publish directly according to fixed permissions.

Support at minimum:

- draft/published/archive or canonical equivalent;
- slug/route validation;
- publication readiness;
- timestamps;
- preview/draft editing;
- deterministic Public rendering.

No heavyweight editorial approval workflow is added in V1.

## 7. Content Hub and detail pages

`/cam-nang` supports:

- featured editorial item;
- navigation/browsing across Guide / Inspiration / Buying Guide;
- latest published entries;
- responsive cards;
- normal SEO/internal-linking hooks.

Detail pages share one reusable rendering shell while preserving type/route identity.

Required detail concepts:

- title;
- type;
- publication/update metadata;
- optional hero/media;
- ordered flexible blocks;
- canonical references;
- optional related Content;
- SEO metadata/internal linking according to the later SEO implementation contract.

## 8. Landing Page

Landing Page uses the same safe block architecture with more flexible editorial/SEO composition.

It may include:

- hero/media;
- editorial content;
- Product/Category/Brand references;
- manually ordered Product groups;
- approved CTA including consultation/contact entry points.

It must not embed Product pricing/business logic into Content blocks.

## 9. Campaign boundary

Campaign is a separate Marketing merchandising domain, not a Content type and not Collection.

Current V1 Campaign scope, reflected in Admin A24/A25:

- internal Campaign identity;
- banner/media;
- manually selected ordered canonical Products;
- Homepage placement;
- `Draft / Published / Archived` state;
- Homepage preview/publish/archive.

Current wireframes do **not** introduce a Campaign scheduling engine or standalone Public Campaign route.

Campaign is explicitly not:

- manufacturer Collection;
- coupon/voucher engine;
- promotion/pricing-rules engine;
- automatic recommendation system.

Homepage Campaign Product cards always read canonical Product commerce truth.

## 10. Showroom / Contact

Public `/showroom` presents business information and a direct consultation path.

Public concepts:

- showroom identity/address;
- opening hours;
- supported contact methods;
- directions/map action;
- consultation form.

Operational business information must come from an intentional managed source/content configuration, not duplicated magic strings across many Public components. Do not create an appointment-booking engine.

## 11. Contact Request domain

Contact Request is a dedicated domain distinct from Quote Request.

Public intake:

Required:

- customer name;
- phone.

Optional:

- message / consultation need.

System-generated:

- source page / entry point;
- created timestamp;
- safe request metadata needed for validation/rate limiting.

Guest create-only; no customer account dependency.

Initial state: `NEW`.

Admin Customer Care lifecycle:

`NEW → CONTACTED → CLOSED`

A29 exposes only the small operational actions needed to inspect and update that queue.

Explicitly no:

- CRM;
- assignment engine;
- lead scoring;
- notification center;
- marketing automation;
- customer profile/account dependency.

## 12. Contact Request submission UX

Successful submission communicates:

- request received;
- expectation that CSKH will contact the customer;
- no Quote or Order implication.

If the service returns a public-safe reference it may be shown; otherwise the UI does not invent one.

Validation/retry preserves entered data. Creation should use pragmatic duplicate-prevention/idempotency consistent with existing service architecture.

## 13. Support Page

Generic route:

`/ho-tro/{slug}`

Covers simple static/content information such as:

- shipping information/policy;
- payment information;
- warranty;
- returns;
- buying/support guidance.

This page type does not create service commerce, appointment booking, logistics workflow or a ticketing platform.

## 14. Public/Admin continuity

Public Content is operated by Admin A22/A23 using the same four Content types and canonical references.

Public Campaign placements are operated by A24/A25 and consume canonical Product data.

Public consultation forms create Contact Requests consumed by A29. A29 does not consume Quote Requests.

These are separate domains even when they share customer contact information.

## 15. Responsive Public contract

Desktop and Mobile share one Content/Contact data model.

Mobile may simplify layout but preserves:

- Content type identity;
- block ordering;
- canonical-reference semantics;
- CTA meaning;
- Contact Request fields/source/status expectation;
- Showroom business-information meaning.

## 16. Acceptance criteria after global freeze

Implementation must prove:

1. all four Content types render through validated ordered flexible blocks;
2. Product/Category/Brand references do not copy business truth;
3. referenced Product cards reflect canonical Public commerce data;
4. unpublished Content is not publicly exposed;
5. Landing routes are collision-safe and controlled;
6. Campaign is Homepage merchandising only, separate from Collection and pricing rules;
7. Campaign does not override Product prices;
8. Contact Request is separate from Quote Request;
9. Contact Request captures required name/phone plus source/timestamp;
10. Admin can inspect/update `NEW / CONTACTED / CLOSED` only within the small CSKH workflow;
11. no CRM/assignment/scoring scope appears;
12. Showroom information is intentionally managed rather than duplicated across components;
13. Support remains a generic content/static page;
14. Desktop/Mobile share the same domain semantics.

## 17. Codex sequence after global freeze

1. Read final Figma + this handoff + master index + canonical schema/content docs.
2. Audit existing content/blog/contact code read-only.
3. Identify reusable pieces vs stale Blog-only assumptions.
4. Report exact schema/service/API/Public/Admin/test deltas.
5. Coordinator/Owner approves material deltas.
6. Implement validated Content domain/rendering.
7. Implement Marketing Content editor/publishing.
8. Implement Campaign merchandising.
9. Implement Showroom/Support binding to intentional managed data/content.
10. Implement Contact Request intake + A29 Customer Care queue.
11. Add contract/E2E tests.
12. Do not widen scope.
