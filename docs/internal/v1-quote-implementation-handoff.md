# V1 Quote — Implementation Handoff

**Status:** Owner-review candidate; amended for ADR 0022; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Section:** `07 — QUOTE` (`917:2`)  
**Linear:** LEO-571

> [!IMPORTANT]
> No implementation before 100% launch-critical Public + Admin wireframes are Owner-approved and the Owner says exactly **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Canonical flow

`PDP → Quote Cart → Request Information → Review & Send → immutable Quote Request NEW → Sales negotiation → negotiated Quote → tokenized read-only share → optional idempotent Quote→Order`

Quote Cart remains separate from Retail Cart.

Quote Request does not create an Order.

## 2. Product/SKU selection identity

ADR 0022 replaces historical Family package/configuration identity.

Every sellable PDP selection must resolve to:

- a real canonical Product;
- an exact sellable SKU where applicable.

Dòng/Trục/Lựa chọn is navigation to that identity, not a separately quoted runtime package object.

Quote Cart/Request must preserve the exact selected Product/SKU snapshot plus human-readable selected option labels where useful.

Examples:

- MS885 selection resolves to the chosen Product/model and exact SKU;
- TBG10302 `Bộ tay sen 108ZR → Màu Chrome` resolves to the approved real Product + Chrome SKU.

Do not reconstruct a sellable line from legacy component strings at Quote time.

## 3. Quote Cart

Desktop:

- `917:6` — D13A Normal
- `917:44` — D13B Needs Attention

Mobile:

- `917:214` — M13A Normal
- `917:249` — M13B Needs Attention

Each line has explicit quantity controls and remove action.

A line that no longer resolves to a valid Product/SKU enters Needs Attention. Submission is blocked until resolved or removed.

## 4. Quote Request submission

Desktop:

- `917:373` — D14A Information
- `917:411` — D14B Review
- `917:442` — D14C Submitted

Mobile:

- `917:289`, `917:314`, `917:335`.

The submitted Quote Request is immutable customer evidence.

Preserve at minimum:

- customer/project context;
- requested quantity;
- customer note;
- Product identity/model snapshot;
- exact selected SKU snapshot;
- selected option labels useful for display;
- authoritative reference commerce snapshot where required by the approved contract.

## 5. Sales-negotiated Quote

Sales does not edit the original Quote Request.

Negotiated Quote owns its commercial terms:

- quoted line price/adjustments;
- quantities;
- Quote notes/terms;
- validity/state;
- public share state.

Changing quoted price must never mutate canonical Product/SKU pricing.

## 6. Shareable Quote

Public route:

`/bao-gia/{publicToken}`

Desktop:

- `917:174` — D15

Mobile:

- `917:347` — M15

Rules:

- opaque public-safe token;
- read-only customer projection;
- no Admin-only note leakage;
- internal Quote code is not route authority.

## 7. Quote → Order

Conversion is explicit, authorized and idempotent.

It must:

- revalidate conversion eligibility;
- create exactly one resulting Order;
- snapshot the negotiated commercial terms;
- preserve exact Product/SKU identity;
- link Quote ↔ Order;
- leave the original Quote Request unchanged;
- return the same Order when safely retried.

## 8. Product/Dòng changes after submission

Later catalogue changes to Product, SKU or Dòng/Axis/Option definitions do not rewrite:

- Quote Request history;
- negotiated Quote history;
- converted Order history.

Historical documents retain the identity/labels captured at their transaction time.

## 9. Explicit exclusions

No:

- merge with Retail Cart;
- automatic Order creation from Quote Request;
- customer editing of public Quote;
- generic configurator/BOM engine;
- runtime construction of arbitrary Product combinations;
- Product-price mutation from negotiated Quote;
- non-idempotent Quote→Order retry.

## 10. Acceptance after global freeze

Prove:

1. Quote Cart and Retail Cart are separate;
2. exact selected Product/SKU survives Quote Cart and immutable Request;
3. Needs Attention blocks invalid Product/SKU lines;
4. Request snapshot cannot be rewritten by Sales;
5. negotiated Quote pricing is Quote-specific;
6. share route is tokenized/read-only;
7. Quote→Order preserves exact Product/SKU and negotiated terms;
8. conversion is idempotent;
9. later Product/SKU/Dòng changes cannot mutate historical snapshots.

## 11. Gate

No implementation until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
