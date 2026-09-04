# V1 Content + Showroom + Support + Contact Request — Implementation Handoff

**Status:** Complete implementation contract prepared from launch-critical wireframes; coding blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Figma section:** `08 — CONTENT / SHOWROOM / SUPPORT` (`920:2`)  
**Linear:** LEO-573, LEO-581

> [!IMPORTANT]
> Do not implement until the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`** after 100% launch-critical Public + Admin wireframes are approved.

## 1. Scope

This handoff covers:

- Content Hub `/cam-nang`;
- Guide detail;
- Inspiration detail;
- Buying Guide detail;
- flexible Landing Page;
- Showroom / Contact `/showroom`;
- generic Support `/ho-tro/{slug}`;
- Public Contact Request intake and Admin CSKH queue boundary.

It does not restore legacy Blog-only CMS authority.

## 2. Figma authority

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

## 3. Canonical Content types

V1 public/editorial types:

- `GUIDE`;
- `INSPIRATION`;
- `BUYING_GUIDE`;
- `LANDING_PAGE`.

Content Hub aggregates published editorial entries. It is not a Product catalogue substitute.

Landing Page owns its route through the content record/configuration. This does not authorize arbitrary legacy-route inheritance.

## 4. Flexible content block contract

Content entries use ordered typed blocks. Exact storage can follow the canonical V1 schema, but implementation must support reusable validated block types such as:

- heading;
- paragraph/rich text within approved sanitation rules;
- media;
- callout;
- Product reference;
- Category reference;
- Brand reference;
- manually ordered Product group/reference block;
- CTA;
- simple layout/grouping metadata where needed.

Block payload must use a closed/validated vocabulary. Do not accept arbitrary executable page-builder code.

## 5. Canonical data references

Editorial content may reference canonical:

- Product;
- Category;
- Brand.

Important rule: **do not copy commerce truth into content records**.

At render time, Product references obtain current public-safe data from canonical Product sources, including price/availability/media where appropriate.

Marketing may override editorial presentation fields such as:

- block heading;
- editorial copy;
- image/crop;
- CTA label/context;
- ordering.

Marketing must not create an independent copy of canonical SKU, Product price, category truth or stock truth inside content JSON.

## 6. Content publishing

Authorized Marketing/Admin roles may publish directly according to fixed role permissions.

Need at minimum:

- draft/published/archive or equivalent existing states;
- slug/route validation;
- publication readiness checks;
- timestamps;
- safe preview/draft editing;
- deterministic public rendering.

Do not build a heavyweight editorial approval workflow unless separately approved.

## 7. Campaign boundary

Campaign is part of Marketing merchandising but remains **separate from Content type and separate from Collection**.

Campaign supports:

- name;
- banner/media;
- manually ordered Product membership;
- Homepage placement;
- publish/archive state;
- optional start/end display timing if canonical design supports it.

Campaign is not:

- manufacturer Collection;
- pricing engine;
- coupon/voucher engine;
- promotion-rule engine;
- automatic recommendation system.

Homepage Campaign Product references use canonical Product data.

## 8. Content Hub behavior

`/cam-nang` should support:

- featured editorial item;
- browsing by the three editorial families Guide / Inspiration / Buying Guide;
- latest/relevant published content;
- standard SEO metadata;
- responsive cards.

No new taxonomy system is required beyond what is useful for Content V1.

## 9. Detail page behavior

All editorial detail pages share a reusable rendering shell while preserving type-specific route family and label.

Requirements:

- title;
- type;
- publication/update metadata;
- hero/media optional;
- ordered flexible blocks;
- canonical Product/Category/Brand references;
- related content optional;
- SEO metadata / structured internal linking where defined by SEO implementation.

## 10. Landing Page behavior

Landing Page uses the same safe block architecture but allows a more campaign/SEO-oriented layout.

It may include:

- editorial hero;
- media;
- category/brand/Product references;
- manually ordered Product groups;
- Contact Request CTA;
- other approved reusable blocks.

Landing Page must not embed commerce business logic in content JSON.

## 11. Showroom / Contact

Public route `/showroom` includes canonical configured business information such as:

- address;
- opening hours;
- hotline/Zalo/contact methods;
- map/directions link;
- consultation form.

Showroom operational details should come from managed configuration/content, not duplicated hard-coded strings across components.

## 12. Contact Request domain

Contact Request is a dedicated domain distinct from Quote Request.

Public intake:

Required:

- customer name;
- phone.

Optional:

- message / consultation need.

System-generated:

- source page/entry point;
- created timestamp;
- safe request metadata needed for abuse/rate-limit controls.

Guest create-only. No customer account dependency.

Initial status:

- `NEW`.

Admin CSKH statuses:

- `NEW`;
- `CONTACTED`;
- `CLOSED`.

Keep the queue operationally small.

Explicit exclusions:

- CRM;
- assignment engine;
- lead scoring;
- automated campaigns;
- notification center;
- customer profiles.

## 13. Contact Request submission UX

After successful submission, public UI shows:

- request reference if intended by service/public response;
- received state;
- expectation that CSKH will contact customer;
- no Quote or Order implication.

Network retry should be safe. If idempotency is not already available for Contact Request create, implementation should use a pragmatic duplicate-prevention boundary consistent with existing service architecture.

## 14. Support Page

Generic route:

`/ho-tro/{slug}`

It covers simple support/legal/commerce information such as:

- shipping policy;
- payment information;
- warranty;
- returns;
- buying guidance.

This page type is content/static information only. It does not create:

- service-commerce;
- appointment booking;
- logistics engine;
- ticketing platform.

## 15. Responsive contract

Desktop/Mobile share one content/data contract.

Mobile may simplify layout and table-of-content presentation but must preserve:

- type identity;
- block ordering;
- canonical reference semantics;
- CTA meaning;
- Contact Request fields/status expectation.

## 16. Acceptance criteria

Post-freeze implementation must prove:

1. all four Content types render through validated flexible blocks;
2. canonical Product/Category/Brand references do not copy business truth;
3. Product references reflect canonical public commerce data;
4. unpublished content is not publicly exposed;
5. Landing routes are controlled and collision-safe;
6. Campaign remains separate from Collection and pricing rules;
7. Contact Request is separate from Quote Request;
8. Contact Request captures name/phone/source/timestamp;
9. Admin can filter/update `NEW / CONTACTED / CLOSED`;
10. no CRM/assignment/scoring scope appears;
11. Showroom details are managed, not duplicated magic strings;
12. Support page is generic and does not create service commerce;
13. Desktop/Mobile use the same content/state model.

## 17. Codex implementation sequence after freeze

1. Read final Figma + this handoff + canonical schema/content docs.
2. Audit existing content/blog/contact code read-only against the contract.
3. Identify reusable pieces vs legacy Blog-only assumptions.
4. Propose exact schema/service/API/UI deltas.
5. Owner approves deltas.
6. Implement validated Content domain + rendering first.
7. Implement Marketing Content editor and publishing.
8. Implement Campaign merchandising.
9. Implement Showroom/Support and managed configuration bindings.
10. Implement Contact Request public intake + Admin CSKH queue.
11. Add contract/E2E tests.
