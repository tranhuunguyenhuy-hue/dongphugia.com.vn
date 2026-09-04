# V1 Admin Operations — Implementation Handoff

**Status:** Complete implementation contract prepared from launch-critical responsive wireframes; coding blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Figma section:** `10 — ADMIN RESPONSIVE` (`921:2`)  
**Linear:** LEO-572, LEO-581, LEO-571, LEO-573

> [!IMPORTANT]
> Do not implement until all launch-critical Public + Admin wireframes are Owner-approved and the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Purpose

This is the durable implementation handoff for `admin.dongphugia.vn`.

V1 Admin is an operational control plane for catalogue, Sales, Marketing and staff access. It is not a generalized ERP/CRM/workflow platform.

## 2. Figma authority

Desktop operational screens:

- `921:6` — A01 Admin Login.
- `921:19` — A02 Dashboard.
- `921:85` — A10 Product List.
- `921:153` — A11 Product Editor.
- `921:230` — A12 Catalogue / Category / Brand / Family.
- `921:280` — A20 Orders List.
- `921:350` — A21 Order Detail / Operations.
- `921:419` — A22 Quote Requests / Quotes.
- `921:489` — A23 Negotiated Quote Editor / Quote→Order.
- `921:567` — A29 Consultation Requests.
- `921:632` — A30 Content List.
- `921:704` — A31 Content Editor.
- `921:769` — A32 Campaign List.
- `921:832` — A33 Campaign Editor.
- `921:890` — A40 Users & Fixed Roles.
- `921:949` — A41 Managed Configuration.

Responsive/mobile operational coverage:

- `921:1000` — AM01 Login.
- `921:1013` — AM02 Dashboard.
- `921:1036` — AM10 Product List.
- `921:1057` — AM11 Product Editor.
- `927:2` — AM12 Catalogue / Family.
- `921:1088` — AM20 Orders.
- `921:1105` — AM21 Order Detail.
- `921:1124` — AM22 Quotes.
- `927:18` — AM22B Quote Request Detail.
- `921:1141` — AM23 Quote Editor.
- `921:1168` — AM29 Consultation Requests.
- `921:1185` — AM30 Content.
- `927:33` — AM31 Content Editor.
- `921:1206` — AM32 Campaigns.
- `927:62` — AM33 Campaign Editor.
- `921:1223` — AM40 Users & Roles.
- `927:87` — AM40B Invite/Edit User Roles.
- `921:1244` — AM41 Configuration.

## 3. Application boundary

Admin host:

`admin.dongphugia.vn`

Public and Admin applications remain separate application surfaces even where they share services/data.

Admin must not inherit legacy Admin UI as authority.

## 4. Authentication / roles

No staff self-signup.

Use existing canonical Supabase Auth/RLS/service-boundary architecture.

V1 uses fixed roles, assignable in combination:

- `Product`;
- `Sales`;
- `Marketing`;
- `Admin`.

Do not create a custom role builder in V1.

High-level role responsibility:

### Product

- Product/catalogue CRUD within permissions;
- Product price/availability/media/spec/docs;
- Category/Brand/Family curation;
- publish-quality operations;
- direct publish where authorized.

### Sales

- Retail Orders;
- Order status/payment/commercial confirmation operations;
- Quote Requests;
- negotiated Quotes;
- Quote publishing/sharing;
- Quote→Order.

### Marketing

- Guide/Inspiration/Buying Guide/Landing;
- Campaign merchandising;
- direct content/Campaign publishing where authorized.

### Admin

- users and fixed-role assignment;
- managed configuration;
- broad operational access according to canonical RLS/service rules.

## 5. Dashboard

Dashboard remains intentionally simple.

Useful launch-critical summaries:

- Orders needing attention, especially `NEW`;
- new Quote Requests;
- Contact Requests / CSKH queue;
- Products needing publish-quality attention;
- shortcuts/recent operational items.

Do not build a full BI/analytics platform under this scope.

## 6. Product / Catalogue operations

Admin must respect the approved PDP/Family handoff.

Product editor manages canonical manufacturer Product truth including:

- Product identity/model;
- Brand;
- primary Category;
- SKU / sellable options;
- price / sale price / online discount;
- availability;
- media;
- technical documents;
- specs/attributes;
- publication/readiness state.

Exact colour/sellable option records may override SKU, price/availability/media as defined by the PDP Family contract.

Family admin manages:

**Family → optional Configuration Group → Configuration → optional Colour**

Configuration target kinds:

- `manufacturer_product`;
- `retailer_package`.

`retailer_package` composition references canonical Product/component IDs.

No Collection management exists in V1.

No Wishlist admin exists in V1.

## 7. Publish-quality behavior

Product editor/list should expose actionable readiness rather than silently publishing incomplete data.

At minimum enforce/indicate required canonical fields based on current V1 schema and Product contracts.

Authorized roles may publish directly; no heavyweight approval workflow is required.

## 8. Orders operations

Orders list supports operational filtering by lifecycle/payment status.

Order detail must preserve the Retail Order contract:

- source;
- lifecycle;
- payment state;
- customer/delivery snapshots;
- selected Product/colour/package snapshots;
- installation-support intent;
- product subtotal/discount;
- shipping/install pending vs confirmed state;
- final commercial total after confirmation.

Sales actions must follow allowed lifecycle transitions, not arbitrary status mutation.

Bank Transfer instructions are exposed to customer only after the Retail contract permits it.

Admin may manage payment state manually according to V1 service rules; no payment gateway is introduced.

## 9. Quotes operations

Admin handles both Quote Requests and negotiated Quotes.

Quote Request detail shows:

- customer/project data;
- requested lines/quantity;
- request lifecycle;
- create/open negotiated Quote action.

Negotiated Quote editor supports:

- Quote-specific line pricing;
- Quote-specific discounts/adjustments;
- notes/terms;
- revisions/version semantics;
- issue/publish;
- validity;
- public token/link;
- Quote→Order.

Do not mutate Product prices when Sales edits Quote prices.

Quote→Order must be idempotent and preserve negotiated snapshots.

## 10. Contact Request / CSKH

Admin module `Yêu cầu tư vấn` uses a dedicated Contact Request domain.

Statuses:

- `NEW`;
- `CONTACTED`;
- `CLOSED`.

Display:

- customer name;
- phone;
- message/need;
- source page;
- created timestamp;
- status.

Actions:

- mark contacted;
- close.

Explicitly no:

- CRM;
- automated assignment;
- scoring;
- notification center;
- marketing automation.

## 11. Marketing Content

Content list/editor manages:

- Guide;
- Inspiration;
- Buying Guide;
- Landing Page.

Editor uses validated ordered flexible blocks from the Content handoff.

Canonical Product/Category/Brand references remain references, not copied commerce truth.

## 12. Campaign

Campaign editor manages:

- name;
- banner/media;
- manually selected ordered Products;
- Homepage placement;
- draft/publish/archive;
- timing only if supported by the canonical campaign contract.

Campaign is not Collection and not a pricing-rule engine.

Admin must not expose dormant legacy Collection schema/permissions in V1 UI.

## 13. Users & fixed roles

Admin can invite/create staff using supported Auth tooling and assign one or more fixed roles.

Do not expose:

- public signup;
- arbitrary permission matrix builder;
- custom role creation;
- organization/team management beyond V1 need.

Changes must remain protected by existing Auth/RLS/service boundaries.

## 14. Managed configuration

A small configuration surface may hold operational values required by approved UI, such as:

- bank-transfer bank name/account holder/account number/instructions;
- Showroom address/hours/contact links;
- hotline/Zalo/navigation links;
- support essentials configuration where not modeled as content.

Do not hard-code these values into Public components.

Configuration changes require Admin permission and normal auditability available in current platform boundaries.

## 15. Responsive Admin contract

Admin must remain usable on smaller screens for core operations.

Responsive layouts can stack cards/forms and collapse navigation, but mobile must not change permissions, data semantics or lifecycle rules.

Desktop remains the primary high-density operational workspace; mobile coverage supports practical operational access rather than a different feature set.

## 16. Explicit Admin exclusions

V1 Admin does not include:

- Wishlist;
- Collection;
- custom roles;
- CRM;
- procurement/suppliers;
- warehouse/fulfilment engine;
- appointment booking;
- notification center;
- generic automation builder;
- advanced DAM;
- advanced BI;
- coupon/promotion engine.

## 17. Acceptance criteria

Post-freeze implementation must prove at minimum:

1. Admin host requires authentication.
2. fixed-role permissions are enforced server-side, not only hidden in UI.
3. Product editor writes canonical Product truth and approved sellable options.
4. Family admin supports manufacturer Product + retailer package targets without Collection.
5. publish-quality errors prevent/flag invalid publication according to canonical rules.
6. Orders use deterministic lifecycle transitions and pending-vs-confirmed fee semantics.
7. Quote prices are Quote-specific and Quote→Order preserves snapshots idempotently.
8. Contact Request queue uses `NEW / CONTACTED / CLOSED` and remains distinct from Quote Request.
9. Content editor uses validated blocks and canonical references.
10. Campaign is merchandising only and has no pricing rules.
11. users can receive multiple fixed roles; no custom-role builder exists.
12. bank/Showroom configuration is managed rather than hard-coded.
13. RLS/service permissions protect all writes.
14. responsive Admin preserves the same operational semantics.

## 18. Codex implementation sequence after global freeze

1. Read this handoff and every domain handoff it references.
2. Audit current Admin/Auth/service code read-only.
3. Map existing routes/components/services to approved Admin modules.
4. Report exact gaps and legacy screens that must be replaced/retired.
5. Propose additive schema/service changes only where required.
6. Owner approves implementation plan.
7. Implement shared Admin shell/Auth/permission guards.
8. Implement Catalogue/Product/Family.
9. Implement Orders and Retail commercial confirmation.
10. Implement Quote Request/Quote/Quote→Order.
11. Implement Contact Request queue.
12. Implement Content/Campaign.
13. Implement Users/Roles/Configuration.
14. Add responsive behavior and E2E/permission tests.
15. Do not expand into excluded platform capabilities.
