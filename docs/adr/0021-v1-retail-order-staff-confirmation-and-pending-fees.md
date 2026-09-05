# ADR 0021 — V1 Retail Order staff confirmation and pending-fee semantics

**Status:** Accepted by Owner at design-contract level; amended 2026-09-05 for ADR 0022 Product/SKU identity  
**Implementation gate:** `V1 WIREFRAME APPROVED / FROZEN`

## Context

V1 Retail commerce is guest-first and uses manual business confirmation rather than a payment gateway or realtime inventory/fulfilment engine.

The canonical lifecycle remains:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

with `CANCELLED` as a terminal branch where allowed.

Payment methods remain exactly:

- COD
- BANK_TRANSFER

At Guest Checkout submission, Product/SKU price can be known while shipping and installation fees may still be pending staff confirmation. Numeric `0` must not represent both “unknown/pending” and “confirmed free”.

ADR 0022 also clarifies catalogue selection identity: every sellable PDP selection resolves to a real canonical Product and exact sellable SKU. The historical `retailer_package` selector target is no longer current authority.

## Decision

### 1. Order creation is intake, not commercial confirmation

Guest Checkout creates a Retail Order with:

- source = RETAIL;
- status = NEW;
- payment_status = UNPAID.

Customer copy says the request/order was received and is waiting for staff confirmation. It must not claim commercial confirmation at NEW.

### 2. Cart and Order line identity

Before Order creation the server must resolve the customer's selected PDP state to authoritative canonical identities.

Each line must preserve an immutable historical snapshot of at least:

- Product ID/model identity;
- exact sellable SKU ID/code;
- human-readable selected option label(s) where useful, e.g. Màu = Đen mờ;
- quantity;
- authoritative unit commercial values used for the line;
- Product/SKU display identity/media snapshot required by the final Order UI.

The Dòng/Axis/Option tree is navigation/selection structure. The Order's sellable authority is the resolved Product/SKU snapshot, not a runtime Family/package object.

Client-supplied price/SKU claims are never authoritative.

### 3. Staff confirmation owns unresolved commercial facts

After submission staff may confirm:

- current Product/SKU sellability/availability context;
- shipping fee and timing;
- installation fee or not-applicable state;
- final commercial total;
- other approved manual fulfilment details within V1 scope.

Pending is not `0đ`.

The system must distinguish:

- pending/unknown;
- confirmed free (`0đ`);
- confirmed positive amount;
- not applicable where the field supports that distinction.

### 4. Lifecycle

Normal path:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

Staff contact does not itself confirm final commercial facts.

`CONFIRMED` means the approved commercial total and required fee state are fixed for that Order snapshot.

### 5. Bank Transfer

At NEW/CONTACTED:

- do not ask customer to transfer;
- do not show temporary subtotal as transfer amount;
- managed bank instructions are not yet actionable.

After CONFIRMED:

- final amount is fixed;
- managed bank details/instructions may be shown;
- payment may still be UNPAID;
- staff confirmation does not mark payment paid.

Payment status changes only from actual recorded payment transactions according to the canonical payment service.

### 6. COD

COD follows the same commercial-confirmation lifecycle. It does not bypass staff confirmation of pending fees/final total.

### 7. Historical immutability

Later changes to Product, SKU, Dòng/Axis/Option definitions, media, pricing or availability must not rewrite existing Order line history.

## Non-goals

This ADR does not add:

- payment gateway;
- realtime inventory engine;
- shipping-rate engine;
- procurement/warehouse/fulfilment platform;
- arbitrary configurator/BOM engine;
- runtime package construction.

## Implementation impact after global freeze

ADR 0022 requires the eventual Order intake service to resolve exact SKU identities from the selected Dòng path and to snapshot Product + SKU authoritatively.

Historical M1/M2 migrations remain immutable. Any schema/service amendments are additive/corrective after global freeze.

## Acceptance criteria

Implementation must prove:

1. Retail submission creates NEW/UNPAID.
2. exact Product/SKU is server-resolved and snapshotted.
3. pending shipping/install state is distinct from confirmed zero.
4. CONFIRMED fixes final commercial total.
5. Bank Transfer instructions are unavailable before CONFIRMED.
6. CONFIRMED Bank Order may remain UNPAID.
7. later catalogue Product/SKU/Dòng changes do not mutate Order history.
8. idempotent retry cannot create duplicate Orders.

## Gate

No implementation before the Owner says exactly:

**`V1 WIREFRAME APPROVED / FROZEN`**
