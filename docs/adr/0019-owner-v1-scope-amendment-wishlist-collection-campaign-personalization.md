---
status: accepted
date: 2026-09-03
owner_decision: true
---

# Owner V1 scope amendment: remove Wishlist and Collection; add Campaign and browser-local personalization

This ADR records the Owner-approved V1 scope amendment made on 2026-09-03.
It is the current repository authority for the affected scope and supersedes
only the conflicting Wishlist/Collection portions of ADR 0016, ADR 0017, ADR
0018, `CONTEXT.md`, and the V1.0 schema/service assumptions. All unrelated
Product, Family, Brand, Category, Search, commerce, Content, Auth, media, and
release decisions remain unchanged.

The canonical product-scope authority is the Linear **V1 Product Charter V1.1**
and the 2026-09-03 amendment on **LEO-556**.

## 1. Wishlist is out of V1

Do not implement or expose:

- `/yeu-thich`;
- Wishlist navigation, PDP/Product-card CTA, populated/empty states, sync, or
  persistence;
- Wishlist Admin support or customer-account behavior.

Existing Figma or legacy Wishlist screens are reference/obsolete only and must
not count toward V1 acceptance.

## 2. Collection is out of V1

V1 will not attempt to normalize manufacturer Collection/Series concepts across
brands because brand-specific semantics are inconsistent and do not justify the
scope/accuracy cost for the current launch.

Do not use Collection as a current V1 capability in:

- Public routes or navigation;
- Homepage/catalogue discovery;
- Search or filters;
- PDP or Content canonical references;
- SEO/internal-linking authority;
- Admin Marketing/Product workflows;
- deterministic import/curation.

The V1.0 database already contains `dpg_v1.collections` and
`dpg_v1.collection_products`, and V1.0 authorization contains
`marketing.collection.*`. These objects are **dormant compatibility/history**.
Do not repurpose, populate, expose, rename, or destructively remove them during
the current scope correction. A later cleanup may remove them behind a separate
reviewed migration.

Historical manufacturer series/collection labels may remain raw/reference or
provenance evidence, but they are not a canonical V1 Product classification.

## 3. Campaign is a separate Marketing domain and is in V1

A **Campaign** is a Dong Phu Gia Marketing merchandising campaign used primarily
on the Homepage to improve product discovery and campaign visibility.

Minimum V1 semantics:

- Marketing-owned title/internal identity;
- banner/media;
- manually selected Product membership;
- explicit Product order;
- Homepage placement/order;
- draft/published/archived lifecycle as required by the approved Admin UX.

One Product may appear in multiple Campaigns. Campaign membership does not
change Brand, Category, Family, Product identity, price, availability, or other
canonical catalogue facts.

Campaign is **not Collection** and must not reuse Collection tables, services,
capability names, routes, or semantics. Implementation must use an additive
Campaign schema/service change when LEO-566/LEO-572 require it.

Campaign is also **not a promotion/pricing engine**. V1 Campaign does not add:

- coupons or vouchers;
- automatic discounts;
- campaign-specific pricing authority;
- customer eligibility/rules;
- Buy-X-Get-Y or other promotion-rule evaluation.

Public prices continue to come from canonical Product pricing.

## 4. Homepage browser-local personalization is in V1

Homepage may show a **“Sản phẩm bạn đã quan tâm”** section when the current
browser has useful local history.

Allowed V1 signals:

- recently viewed Product IDs;
- recent search terms/signals needed to improve the local Homepage suggestion.

Constraints:

- browser-local only;
- no required customer account;
- no server-side behavioral/customer profile;
- no cross-device sync;
- no recommendation AI requirement;
- no privileged or canonical business data stored in browser history.

If no useful local history exists, the personalized section is omitted.

## 5. Homepage scope after this amendment

The intended mobile-first Homepage may contain:

1. Hero / primary entry content.
2. Search and core navigation access.
3. **Khám phá cùng Đông Phú Gia**:
   - four canonical sector/category cards;
   - Campaign banner carousel.
4. Optional browser-local **Sản phẩm bạn đã quan tâm** section.
5. Published Campaign sections, each with banner/media and an ordered Product
   listing.
6. Content / showroom / support surfaces as approved in Figma.

Collection and Wishlist must not be reintroduced into this composition.

## 6. Admin scope after this amendment

Marketing Admin manages:

- Guide / Inspiration / Buying Guide / Landing content;
- Campaign merchandising.

There is no V1 Collection or Wishlist management UI.

The future implementation should add explicit `marketing.campaign.*`
capabilities rather than reinterpret the already-deployed
`marketing.collection.*` capability family. Existing Collection permissions
remain dormant until cleanup.

## 7. Roadmap impact

Affected active/future work:

- **LEO-566 / M3:** remove Wishlist and Collection; implement revised Homepage,
  Campaign merchandising surfaces, and browser-local recent-interest
  personalization.
- **LEO-572 / M5:** replace Collection management with Campaign management.
- **LEO-579/580:** Figma must remove Wishlist/Collection from current V1 flows
  and represent the revised Homepage/navigation behavior.

Completed M1/M2 work is **not reopened**. Historical migrations are not
rewritten and no destructive database cleanup is authorized by this ADR.
Campaign implementation, when needed, is additive and must preserve existing
Product/Family/Brand/Category/commerce invariants.

## 8. Supersession map

The following earlier statements are no longer V1 authority:

- ADR 0016: Collection as a canonical manually curated V1 Product group and
  Collection import/membership invariants.
- ADR 0017: Collection public rendering/cache/purge behavior and Wishlist as a
  browser-local Public page/state.
- ADR 0018: Collection Admin management and `marketing.collection.*` as an
  active V1 Marketing capability.
- `CONTEXT.md`: Collection as an active canonical V1 catalogue term.

Everything else in those documents remains in force unless separately amended.
