# V1 Quote — Implementation Handoff

**Status:** Owner-review candidate; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Figma section:** `07 — QUOTE` (`917:2`)  
**Linear:** LEO-571 — Build Quote Cart, negotiated Quote and Quote-to-Order flow

> [!IMPORTANT]
> Do **not** implement this document yet. Coding starts only after 100% launch-critical Public + Admin wireframes are Owner-approved and the Owner explicitly says **`V1 WIREFRAME APPROVED / FROZEN`**.
>
> Quote Desktop + Mobile are structurally QA-clean and ready for Owner review, but are not approved/frozen yet.

## 1. Purpose

Durable V1 Quote contract:

**PDP → Quote Cart → Quote Request information → Review & Send → Quote Request `NEW` → Sales contact/negotiation → negotiated Quote → tokenized shareable Quote → optional authorized Quote→Order**.

Quote is intentionally separate from Retail Cart/Checkout. Do not merge the two states or reuse one cart as the other.

## 2. Authority

1. Owner's newest explicit decisions.
2. Final Owner-approved Figma Quote screens after review.
3. This handoff.
4. PDP/Family handoff for Product/colour/package identity.
5. Canonical V1 schema/services where not superseded.
6. Legacy Production only as reference.

## 3. Current Figma authority

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

All 12 current Quote frames have passed structural QA for missing fonts, root-boundary overflow and frame overlap.

## 4. Quote Cart contract

Quote Cart is a guest commercial-enquiry cart, not Retail Cart.

Each line preserves:

- canonical manufacturer Product or approved `retailer_package` target;
- exact selected sellable option/colour/SKU when applicable;
- **customer-editable quantity** using decrement/increment controls;
- remove-line action;
- optional reference price;
- one customer-facing package line for `retailer_package`;
- package quantity applied to the complete package.

Reference prices are context only and must be labelled/treated as **not the final commercial Quote**.

If a Product/package/configuration is no longer valid:

- the line enters Needs attention;
- request submission is blocked;
- customer must select a valid configuration or remove the line;
- no silent substitution/splitting.

Quote Cart must not:

- create an Order;
- share state silently with Retail Cart;
- promise displayed Product price as negotiated Quote price;
- add coupon/promotion logic.

## 5. Quote Request contract

Guest fields:

Required:

- customer name;
- phone.

Optional/contextual:

- email;
- project/construction name;
- need/short project description;
- note to Sales.

There is an explicit Review-before-submit state.

Review shows:

- contact data;
- project context;
- exact requested Product/colour/package lines + quantity;
- customer notes;
- reference-price disclaimer;
- statement that Sales will negotiate/issue the actual Quote.

Submission creates a **Quote Request, not a Retail Order**.

Submitted state communicates:

- request reference/code;
- `NEW` received state;
- customer/project summary;
- expectation that Sales will contact the customer.

Validation/retry must preserve entered data. Request creation must use pragmatic duplicate prevention/idempotency consistent with canonical service architecture so a network retry cannot unintentionally create duplicate requests.

## 6. Quote Request lifecycle

Keep request handling small. Current operational meaning must support at least:

- `NEW` — received, not handled;
- contacted/in-progress — Sales is discussing requirements;
- resolved/converted/cancelled terminal handling according to the canonical service model.

Do not invent CRM, assignment, scoring or automation scope.

## 7. Negotiated Quote aggregate

A negotiated Quote is a separate Sales-owned commercial aggregate derived from a Quote Request or created by authorized Sales.

Support:

- stable Quote ID/reference;
- customer/project snapshot;
- status/lifecycle;
- revision/version where needed by canonical services;
- issue/publish timestamp;
- optional validity/expiry;
- ordered Quote lines;
- exact Product/colour/package snapshots;
- negotiated line unit price;
- Quote-specific line discount/adjustment where authorized;
- terms/notes;
- final Quote total;
- immutable issued commercial snapshot.

Negotiated Quote pricing is Quote-specific. It must never mutate Product `price`, `sale_price` or `voucher_online_discount_amount`.

## 8. Shareable Quote

Public route:

`/bao-gia/{publicToken}`

Contract:

- tokenized/public-safe identifier;
- read-only;
- no account requirement;
- no customer editing;
- no implicit Order creation;
- show public-safe Quote reference/version/validity/customer-project summary/lines/prices/adjustments/total/terms;
- internal Sales notes never leak into public response;
- token may be revoked/rotated if supported by canonical architecture.

Do not expose an internal sequential Quote code as route authority.

## 9. Quote → Order

Quote→Order is an authorized Admin/Sales operation, not a Public CTA.

Conversion must:

- be explicit and idempotent;
- create exactly one resulting Order for one valid conversion intent;
- preserve the negotiated commercial snapshot;
- preserve exact Product/colour/package identity and package component snapshots;
- link Quote ↔ Order where practical;
- leave the original Quote Request unchanged;
- never silently re-price the accepted/issued Quote from current Retail pricing;
- recover the same Order on retry after a lost response.

If the Quote has changed since the valid issued/accepted version, conversion must require an explicit valid version/state rather than converting an ambiguous draft.

## 10. Public/Admin continuity

Public:

`D13/M13 Quote Cart → D14/M14 Request → D15/M15 Shareable Quote`

Admin page `02 — ADMIN — Operational Wireframes`:

- A17 Quote Request List (`31:835`).
- A18 Quote Request Detail / immutable (`31:843`).
- A19 Negotiated Quote editor (`31:853`).
- A20 tokenized Share Quote state (`31:869`).
- A21 idempotent Quote→Order (`31:879`).

Public request snapshots and Admin negotiation must remain traceable without mutating the original customer submission.

## 11. Responsive Public contract

Desktop and Mobile share one Quote data/state model.

Mobile may stack cards/actions but preserves:

- isolated Quote Cart;
- quantity/remove controls;
- needs-attention blocking;
- Review-before-submit;
- submitted request semantics;
- tokenized read-only Quote;
- exact monetary meaning.

## 12. Acceptance criteria after global freeze

Implementation must prove:

1. Quote Cart is isolated from Retail Cart.
2. Quantity edits/removal operate on Quote Cart lines only.
3. selected Product colour/sellable SKU survives into request/Quote snapshots.
4. `retailer_package` remains one customer line with immutable component snapshot semantics.
5. invalid configuration blocks request submission.
6. Quote Request does not create a Retail Order.
7. Review preserves/displays customer/project/line data.
8. request retry does not create unintended duplicates.
9. negotiated Quote prices do not mutate Product pricing.
10. shareable Quote is tokenized/read-only/public-safe.
11. Quote lifecycle/revisions are deterministic.
12. Quote→Order is idempotent and snapshot-preserving.
13. no login/CRM/coupon/customer-editor scope is introduced.

## 13. Codex sequence after global freeze

1. Read this handoff + final Figma + PDP/Family contract + canonical schema/service docs.
2. Audit current Quote Request/legacy Quote code read-only.
3. Report exact reusable code and schema/service/Public/Admin/test deltas.
4. Do not preserve legacy semantics automatically.
5. Coordinator/Owner approves material delta plan.
6. Implement domain/service/idempotency first.
7. Implement Public Quote Cart/Request/share page.
8. Implement Admin Quote Request/negotiated Quote/share/Quote→Order.
9. Add contract + E2E acceptance tests.
10. Do not broaden scope.
