# V1 Retail Order — Implementation Handoff

**Status:** Owner-approved Desktop + Mobile design contract; amended for ADR 0022; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Section:** `06 — RETAIL ORDER` (`181:29`)  
**Architecture:** ADR 0021 + ADR 0022

> [!IMPORTANT]
> Retail Order design is approved, but implementation still requires the exact global Owner gate **`V1 WIREFRAME APPROVED / FROZEN`**.

## 1. Canonical flow

`PDP → Retail Cart → Guest Checkout → Review & Send → Order NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` is an allowed terminal branch according to canonical service rules.

Retail Cart is separate from Quote Cart.

## 2. Product/SKU selection identity

Every sellable PDP state under ADR 0022 resolves to:

- one real canonical Product;
- one exact sellable SKU where the Product has SKU options.

Dòng/Trục/Lựa chọn is the navigation mechanism used to reach that identity. Retail commerce must not persist a Family-specific runtime package target.

When adding to Retail Cart, server authority must resolve and validate the exact Product/SKU. Never trust client-supplied price or SKU claims.

Cart and immutable Order line snapshots preserve at minimum:

- Product identity/model;
- exact SKU identity/code;
- selected option labels useful to the customer, e.g. Màu;
- quantity;
- authoritative unit price/discount state used by the transaction;
- display/media snapshot required by the approved UI.

Product-changing Dòng choices already navigate to the appropriate canonical PDP before add-to-cart. SKU-only choices remain on one PDP.

## 3. Cart states

Desktop authority:

- `777:3`, `777:133`, `777:263`, `777:397`.

Mobile authority:

- `902:2`, `902:95`, `902:188`, `902:286`.

Cart must detect a line that can no longer be resolved/sold and enter the approved Needs Attention state. Invalid state blocks checkout until resolved or removed.

Quantity and remove actions are explicit.

## 4. Guest Checkout

Desktop authority:

- `800:2`, `800:120`, `800:241`, `810:98`, `800:363`, `800:484`, `812:2`.

Mobile authority:

- `906:2`, `906:107`, `906:215`, `906:323`, `906:402`, `906:467`.

No mandatory customer account.

Payment methods:

- COD
- Bank Transfer

Review occurs before final submission.

## 5. Order creation

Submission creates:

- source = RETAIL;
- status = NEW;
- payment_status = UNPAID.

The confirmation experience means **received**, not commercially confirmed.

Staff later confirms unresolved commercial facts.

## 6. Pending fees and final total

At NEW, shipping/installation fees may be pending.

Pending must not be represented as confirmed `0đ`.

Staff confirmation determines the approved final commercial total before transition to CONFIRMED.

## 7. Bank Transfer

At NEW/CONTACTED:

- do not instruct transfer;
- do not use a temporary subtotal as transfer amount;
- managed bank instructions remain hidden/non-actionable.

After CONFIRMED:

- final total is fixed;
- managed bank instructions may become actionable;
- Order may remain UNPAID;
- confirming the Order does not mark payment paid.

## 8. Confirmation states

Desktop authority:

- `818:2` — NEW COD
- `818:157` — NEW Bank
- `818:315` — CONTACTED
- `818:470` — CONFIRMED COD
- `863:2` — CONFIRMED Bank

Mobile authority:

- `908:2`, `908:91`, `908:183`, `908:272`, `908:366`.

## 9. Historical snapshot invariants

Later changes to:

- Product;
- SKU;
- Dòng/Axis/Option structure;
- Product/SKU price;
- availability;
- media;

must not rewrite existing Order line history.

## 10. Idempotency

Order creation must be idempotent. A retry after uncertain client/network response must return the same Order rather than create a duplicate.

## 11. Explicit exclusions

No:

- mandatory account;
- payment gateway;
- realtime inventory engine;
- shipping-rate engine;
- fulfilment/warehouse platform;
- arbitrary bundle/configurator engine;
- runtime Product-combination creation.

## 12. Acceptance after global freeze

Prove:

1. exact selected Product/SKU is authoritatively resolved;
2. SKU-only choice survives Cart and Order snapshot;
3. Needs Attention blocks unresolved invalid lines;
4. NEW/UNPAID is created once;
5. pending fee is different from confirmed zero;
6. staff confirmation fixes final total;
7. Bank instructions appear only after CONFIRMED;
8. CONFIRMED Bank may remain UNPAID;
9. lifecycle is exact;
10. later catalogue changes cannot rewrite Order history;
11. retries are idempotent.

## 13. Gate

No implementation until the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
