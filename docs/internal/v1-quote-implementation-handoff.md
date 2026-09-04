# V1 Quote — Implementation Handoff

**Status:** Complete implementation contract prepared from launch-critical wireframes; final coding remains blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Figma section:** `07 — QUOTE` (`917:2`)  
**Linear:** LEO-571 — Build Quote Cart, negotiated Quote and Quote-to-Order flow

> [!IMPORTANT]
> Do **not** implement this document yet. Coding starts only after 100% launch-critical Public + Admin wireframes are Owner-approved and the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Purpose

This document is the durable implementation handoff for the V1 Quote flow:

**PDP → Quote Cart → Quote Request → Review & Send → Request `NEW` → Sales contact/negotiation → Quote draft → Quote issued/shareable → optional Quote→Order**.

The Quote flow is deliberately separate from Retail Cart/Checkout. Codex must not merge the two flows for convenience.

## 2. Authority

Authority order:

1. Owner's newest explicit decisions.
2. Approved/final Figma Quote screens after Owner review.
3. This handoff.
4. Canonical V1 schema/service contracts where not superseded.
5. Retail Order handoff only for shared Product/colour/package snapshot semantics.
6. Legacy Production only as reference, never authority.

## 3. Figma authority

Section `07 — QUOTE`.

Desktop:

- `917:6` — D13A Quote Cart / Normal.
- `917:44` — D13B Quote Cart / Needs attention.
- `917:373` — D14A Quote Request / Information.
- `917:411` — D14B Quote Request / Review before submit.
- `917:442` — D14C Quote Request / Submitted.
- `917:174` — D15 Shareable Quote / Read only.

Mobile:

- `917:214` — M13A Quote Cart / Normal.
- `917:249` — M13B Quote Cart / Needs attention.
- `917:289` — M14A Quote Request / Information.
- `917:314` — M14B Quote Request / Review.
- `917:335` — M14C Quote Request / Submitted.
- `917:347` — M15 Shareable Quote / Read only.

## 4. Quote Cart contract

Quote Cart is a guest commercial-enquiry cart, not Retail Cart.

Required line semantics:

- canonical manufacturer Product or approved `retailer_package` target;
- exact selected sellable option/colour when applicable;
- quantity;
- optional customer-facing reference price;
- package remains one customer-facing line;
- package quantity applies to the full package;
- invalid/unavailable package/configuration blocks Quote Request until resolved or removed;
- no silent package substitution or splitting.

Reference prices shown in Quote Cart are **not** a final commercial Quote. They are context only.

Quote Cart must not:

- create an Order;
- reuse Retail Cart state silently;
- promise that displayed Product prices are the negotiated Quote prices;
- apply a generic coupon engine.

## 5. Quote Request contract

Guest fields:

Required:

- customer name;
- phone.

Optional / contextual:

- email;
- project/construction name;
- need/short project description;
- note to Sales.

Before submission there is an explicit Review state.

Review must show:

- customer/contact data;
- project context;
- requested Product/package lines + quantity;
- customer notes;
- explicit statement that Quote Cart prices are reference only and Sales may negotiate line pricing/discounts before issuing a Quote.

Submission result creates a **Quote Request**, not a Retail Order.

Submitted state shows:

- request reference/code;
- request status `NEW`;
- project/customer summary;
- expectation that Sales will contact the customer.

## 6. Quote Request lifecycle

Keep the lifecycle small. Exact enum naming may reuse canonical schema, but customer/operations meaning must support at least:

- `NEW` — request received, not yet handled;
- contacted/in-progress state — Sales is discussing requirements;
- resolved/converted/cancelled terminal handling as supported by canonical service model.

Do not introduce CRM, lead scoring, assignment automation or notification-platform scope.

## 7. Negotiated Quote model

A negotiated Quote is a separate commercial aggregate derived from a Quote Request or created by authorized Sales.

Each Quote must support:

- stable Quote ID/reference;
- customer/project snapshot;
- status/lifecycle;
- version/revision concept where needed;
- issue/publish timestamp;
- validity/expiry date optional;
- ordered Quote lines;
- negotiated line unit price;
- line/customer-facing discount or adjustment where authorized;
- notes/terms;
- final Quote total;
- immutable commercial snapshots when issued.

The Quote editor must allow Sales to change **Quote line commercial terms** without mutating canonical Product pricing.

Canonical Product `price`, `sale_price`, and online discount remain Product/Retail truth. Negotiated Quote prices are Quote-specific snapshots.

## 8. Shareable Quote

Public route family:

`/bao-gia/{publicToken}`

Contract:

- read-only;
- tokenized/public-safe identifier;
- never expose Quote by guessable sequential ID alone;
- show Quote reference, version, validity, customer/project summary where appropriate, line items, negotiated price, adjustments, total and terms;
- no customer editing;
- no account requirement;
- no implicit Order creation.

Token rotation/revocation should remain possible if existing architecture supports it. Do not embed sensitive internal Sales notes in the public response.

## 9. Quote → Order

Quote→Order is an authorized Sales/Admin operation, not a public CTA.

When eligible:

- conversion must be idempotent;
- one conversion attempt must not create duplicate Orders;
- preserve issued/accepted negotiated commercial snapshots;
- preserve exact Product/colour/package identity and package component snapshots;
- resulting Order should reference its source Quote where practical;
- subsequent Product price changes must not mutate the converted Order;
- conversion must not silently re-price the accepted Quote using current Retail pricing.

If Quote has changed since customer acceptance/issue state, service must require an explicit valid version/state rather than converting an ambiguous draft.

## 10. Responsive contract

Desktop and Mobile share exactly one data/state model.

Mobile may stack lines/cards and actions, but must preserve:

- Quote Cart vs Retail Cart separation;
- needs-attention blocking;
- explicit review-before-submit;
- submitted request semantics;
- read-only shareable Quote;
- exact monetary meaning.

## 11. Implementation acceptance criteria

Post-freeze tests must prove at minimum:

1. Quote Cart is isolated from Retail Cart state.
2. Product colour/sellable option survives into request/Quote snapshots.
3. `retailer_package` is one customer line with component snapshot semantics.
4. invalid configuration blocks request submission.
5. Quote Request does not create Retail Order.
6. Review state preserves and displays submitted data.
7. request retry cannot create unintended duplicate records.
8. negotiated line prices do not mutate Product pricing.
9. shareable Quote is tokenized and read-only.
10. public Quote exposes only public-safe fields.
11. Quote revisions/status transitions are deterministic.
12. Quote→Order is idempotent and preserves negotiated snapshots.
13. no login, CRM, coupon engine or customer Quote editor is introduced.

## 12. Codex implementation sequence after global freeze

1. Read this handoff + final Figma nodes + canonical schema docs.
2. Audit existing Quote Request/legacy Quote code read-only against this contract.
3. Report only concrete deltas: schema, service, API, public UI, Admin UI, tests.
4. Propose additive schema/service changes; do not preserve legacy meanings automatically.
5. Owner approves the delta plan.
6. Implement domain/service/idempotency first.
7. Implement Public Quote Cart/Request/share page.
8. Implement Admin Quote Request + Quote editor + Quote→Order.
9. Add contract tests and end-to-end acceptance.
10. Do not widen scope to CRM/automation/account portal.
