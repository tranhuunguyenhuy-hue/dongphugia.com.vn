# ADR 0021 — V1 Retail Order staff confirmation and pending-fee semantics

**Status:** Accepted by Owner at design-contract level; implementation blocked until global wireframe freeze  
**Date:** 2026-09-05

## Context

V1 Retail commerce is guest-first and uses manual business confirmation rather than a payment gateway or realtime inventory/fulfilment engine.

The existing canonical schema already has:

- order lifecycle `NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED` with cancellation branches;
- payment methods `COD | BANK_TRANSFER`;
- payment status including `UNPAID`;
- customer/address snapshots;
- numeric shipping/discount/total fields.

Approved wireframes clarified a business distinction not fully represented by the original schema: at Guest Checkout submission, product pricing can be known while shipping and installation fees may still be **pending staff confirmation**. A numeric `0` must not mean both “unknown/pending” and “confirmed free”.

The approved PDP Family System also introduced selected colour sellable options and `retailer_package` configurations that must survive into Retail Cart and immutable Order snapshots.

## Decision

### 1. Order creation is intake, not commercial confirmation

Guest Checkout creates a Retail Order in:

- `source = RETAIL`;
- `status = NEW`;
- `payment_status = UNPAID`.

Customer-facing copy must say the Order/request has been **received** and is **waiting for staff confirmation**. It must not claim the transaction is confirmed at `NEW`.

### 2. Staff confirmation owns unresolved commercial facts

Staff may confirm after submission:

- sellability/stock context;
- retailer-package validity;
- shipping fee/timing;
- installation capability/fee when requested;
- final payable amount;
- bank-transfer instructions when applicable.

`CONTACTED` means staff has engaged the customer but commercial confirmation is not complete. `CONFIRMED` means the parties have agreed the relevant commercial details and the Order can proceed to fulfilment.

### 3. Pending fees are first-class state

Shipping and installation need explicit pending/confirmed semantics.

Do not encode a pending fee as numeric zero.

Implementation may use an enum/state column plus nullable amount or an equivalent normalized model, but must distinguish:

- pending/unknown;
- confirmed zero/free;
- confirmed positive amount.

### 4. Bank transfer is deferred until confirmation

At `NEW` (and while final total is still unresolved):

- do not require payment;
- do not tell the customer to transfer the temporary subtotal;
- do not present a temporary amount as the final transfer amount.

Bank account/instruction data must be managed configuration, not hard-coded UI content. Transfer instructions become customer-actionable only when the final commercial total is confirmed according to the approved flow.

### 5. Retail selections are snapshotted exactly

Order lines must preserve the exact customer selection from the approved PDP/Cart system:

- canonical manufacturer Product;
- selected colour/sellable SKU when present;
- or `retailer_package` identity;
- immutable component snapshot for a retailer package;
- quantity and authoritative pricing/discount inputs.

A retailer package is one customer-facing Cart/Order line even though its component snapshot contains multiple canonical Products.

### 6. Online discount is automatic

`voucher_online_discount_amount` remains the only approved Product-level online incentive in this flow. It is automatically applied and snapshotted. No coupon/claim/stacking engine is introduced.

### 7. Installation support is explicit customer intent

Checkout may capture `installation_support_requested` (or equivalent explicit field). This intent must not be hidden only inside free-text notes. If installation fee participates in the confirmed total, it receives explicit pending/confirmed amount semantics.

### 8. Retry must be idempotent

Guest Checkout submission must remain idempotent. A retry after a lost response cannot create a second Order for the same accepted submission.

### 9. Scope boundaries

This ADR does not approve:

- a customer account/profile;
- a payment gateway;
- realtime inventory;
- a customer order-history dashboard;
- exposing Orders by guessable order number alone;
- merging Retail Cart with Quote Cart.

A future guest order-status revisit surface, if needed, requires an explicit secure-access design.

## Consequences

The current `orders.shipping_fee not null default 0` / always-numeric total assumption requires an additive amendment before the approved UX can be implemented without semantic ambiguity.

Order-line structures also require the approved PDP/Family amendments so colour/sellable options and retailer packages can be snapshotted deterministically.

The detailed design/implementation handoff is:

`docs/internal/v1-retail-order-implementation-handoff.md`

## Implementation gate

No schema or application implementation from this ADR may start until the Owner explicitly says:

**`V1 WIREFRAME APPROVED / FROZEN`**

At that point, prepare a concise schema/service implementation brief for Owner approval before changing migrations or runtime code.
