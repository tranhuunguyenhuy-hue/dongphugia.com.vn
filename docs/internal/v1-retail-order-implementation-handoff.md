# V1 Retail Order — Implementation Handoff

**Status:** Owner-approved design contract for Cart + Checkout; Order Confirmation information contract approved but final desktop layout/flow polish is still open.  
**Date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Linear:** LEO-567 — Build retail Cart, guest Checkout and Order flow

> [!IMPORTANT]
> Do **not** implement this document yet. Coding starts only after the Owner explicitly says:
> **`V1 WIREFRAME APPROVED / FROZEN`**.
>
> Current Retail Order design is not globally frozen. Desktop Cart and Desktop Checkout are approved. Desktop Order Confirmation content/semantics are approved, but layout/flow still requires one final optimization pass. Mobile Retail Order has not been designed yet.

## 1. Purpose

This is the durable implementation handoff for the V1 Retail Order flow:

**PDP → Retail Cart → Guest Checkout → Review & Send → Order `NEW` → staff confirmation → `CONTACTED` → `CONFIRMED` → `PROCESSING` → `COMPLETED`**.

It exists so implementation does not infer behavior from legacy Production checkout UI, old schema assumptions, or the Quote flow.

V1 principles:

- no customer account required;
- no payment gateway;
- payment methods: `COD` and `BANK_TRANSFER` only;
- Retail Cart and Quote Cart are separate flows;
- the web creates a customer request/order accurately, but staff confirmation is required before the order is commercially final;
- Product/colour/package selections from the approved PDP Family System must survive into Cart and Order snapshots;
- online discount is auto-applied; there is no coupon/voucher engine.

## 2. Authority

For this scope:

1. Owner's newest explicit decisions.
2. Approved Figma Retail Order screens listed here.
3. This handoff.
4. ADR `0021-v1-retail-order-staff-confirmation-and-pending-fees.md`.
5. PDP/Family handoff and ADR 0017 for Product/colour/package identity.
6. Pricing ADR 0020.
7. Existing V1 schema/services where not superseded.
8. Legacy Production only as reference/evidence.

Conflict rule: newer Owner-approved design/contract supersedes older assumptions. Do not silently preserve a legacy field meaning when it conflicts with this document.

## 3. Current Figma status

Section: **`06 — RETAIL ORDER`** (`181:29`).

### 3.1 Desktop Cart — APPROVED

| Node | Screen | Contract |
| --- | --- | --- |
| `777:3` | D10A — Retail Cart / Populated / Normal | Normal cart with Product, colour and retailer package fixtures |
| `777:133` | D10B — Quantity / Pricing updated | Quantity changes update totals deterministically |
| `777:263` | D10C — Needs attention / Block checkout | Invalid/unavailable line blocks checkout until resolved |
| `777:397` | D10D — Empty Cart | Empty state |

### 3.2 Desktop Guest Checkout — APPROVED

| Node | Screen | Contract |
| --- | --- | --- |
| `800:2` | D11A — COD / Normal | Guest contact, shipping, COD, installation-support request, detailed waiting expectations |
| `800:120` | D11B — Bank Transfer | Bank-transfer choice without premature transfer instructions |
| `800:241` | D11C — Validation errors | Errors keep entered data and focus correction |
| `810:98` | D11D — Review before submit | Explicit review step before Order creation |
| `800:363` | D11E — Submitting | Submission locked/idempotent |
| `800:484` | D11F — Submission failure / Retry | Retry without losing data or duplicating Order |
| `812:2` | SPEC — D11 Checkout · Staff Confirmation Contract | Supporting contract |

### 3.3 Desktop Order Confirmation — CONTENT/SEMANTICS APPROVED; LAYOUT NOT FINAL

| Node | Screen | Current meaning |
| --- | --- | --- |
| `818:2` | D12A — COD / NEW | Order received; waiting for staff confirmation |
| `818:157` | D12B — Bank Transfer / NEW | Order received; **do not transfer yet** |
| `818:315` | D12C — CONTACTED | Staff has contacted customer; commercial details still being confirmed |
| `818:470` | D12D — CONFIRMED | Shipping/final total have been confirmed |

Owner approved the information and lifecycle semantics on 2026-09-05, then requested a final optimization pass before Mobile.

**Open design work:**

- replace the current top horizontal 4-step progress pattern with a different, less repetitive pattern;
- reduce duplicate status communication between top progress, lifecycle tracker and status hero;
- optimize desktop layout/flow before marking D12 approved;
- add/validate a Bank Transfer `CONFIRMED` state where transfer instructions become available only after final total confirmation;
- then design the complete Mobile Retail Order flow.

Do not mark D12 or Mobile Retail Order as approved until Owner explicitly approves them.

## 4. Retail Cart contract

### 4.1 Cart is not Quote Cart

Retail Cart and Quote Cart remain separate.

Retail Cart must not contain a CTA that silently converts the cart into Quote Request. Quote flow has its own state and screens.

### 4.2 Cart line types

Cart must support approved PDP selections:

1. `manufacturer_product` configuration;
2. exact selected colour/sellable option where applicable;
3. `retailer_package` configuration.

#### Manufacturer Product

Snapshot at minimum:

- canonical Product ID;
- canonical Product name/model;
- selected sellable SKU/colour option, if any;
- display label/configuration where useful;
- quantity;
- authoritative pricing inputs at order creation.

#### Retailer package

A selected `retailer_package` appears as **one Cart line / one ordered configuration**, not as unrelated component lines in the customer Cart UI.

Example fixture:

`Bộ sen TBG10302 + DGH108ZR`

The line may show `Gồm 2 sản phẩm`, while the backend retains canonical package composition/component references.

Quantity applies to the complete package.

If a required package component becomes invalid/unavailable, the package line enters **Needs attention**. Checkout is blocked until the customer selects another valid configuration or removes the line. Do not silently replace/split package components.

### 4.3 Pricing

Canonical Product pricing:

- `price` = regular selling price;
- `sale_price` = optional lower promotional selling price;
- `voucher_online_discount_amount` = optional additional fixed online discount.

Current product price = `sale_price ?? price`.

Online discount is **automatically applied** to an online Retail Order. It is never a checkbox/claim interaction.

Cart summary should distinguish:

- product price before online discount;
- online discount;
- shipping fee state;
- current product subtotal/tạm tính.

Do not display a pending shipping fee as `0đ` or imply free shipping.

### 4.4 Availability / needs-attention

Indicative availability may be shown, but checkout must revalidate sellability/pricing before Order creation.

A Cart with unresolved line problems cannot proceed to Checkout.

## 5. Guest Checkout contract

### 5.1 No account

Checkout is guest-first. Do not introduce login/account requirements.

### 5.2 Customer/contact fields

Required:

- name;
- phone.

Optional:

- email;
- order note.

Phone should use suitable formatting/validation. Validation errors must preserve all user-entered data.

### 5.3 Shipping address

Approved information hierarchy:

- Tỉnh / Thành phố;
- Phường / Xã;
- detailed address.

Use searchable selectors where appropriate. Do not infer a final shipping fee merely from form entry if staff confirmation is still required.

### 5.4 Installation support

Checkout includes an optional customer intent:

**`Tôi cần nhân viên tư vấn lắp đặt`**.

This is not an automatic installation sale/fee. It means staff should confirm capability, scope and fee with the order.

The Order must persist this intent explicitly rather than relying on free-text notes.

### 5.5 Payment method

Supported V1 methods:

- `COD`;
- `BANK_TRANSFER`.

No online gateway.

#### COD

Customer pays according to the commercial total confirmed by staff. At Order creation payment status is `UNPAID`.

#### Bank Transfer

At `NEW` / before commercial confirmation:

- show `Chưa cần chuyển khoản`;
- do not tell customer to transfer the current temporary subtotal;
- do not expose a transfer amount as final;
- do not require transfer to create the Order.

Bank details/instructions become relevant only after staff confirms stock/fees/final total. They must come from managed configuration, never hard-coded into UI/business logic.

### 5.6 Review before submit

V1 deliberately has a Review step. Do not collapse it just to reduce clicks.

Before Order creation the customer can review:

- contact;
- delivery address;
- installation-support intent;
- payment method;
- note;
- ordered Product/colour/package snapshots;
- price/discount currently recorded;
- fees that are still pending;
- what staff will confirm after submission.

Only the Review state has the final **Gửi đơn hàng** action.

### 5.7 Submission / retry

Submission must be idempotent.

If the Order was created but the client lost the response, retrying must return/recover the same Order, not create a duplicate.

Submitting state blocks duplicate submit actions while preserving form state. Failure state retains customer inputs and permits retry.

## 6. Staff-confirmation business contract

### 6.1 Order lifecycle

Existing V1 lifecycle is retained:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` remains an allowed terminal branch according to the existing service transition contract.

Customer-facing meaning:

- `NEW`: request/order received; **not yet commercially confirmed**;
- `CONTACTED`: staff has contacted customer and is resolving pending details;
- `CONFIRMED`: parties have agreed on stock/fees/final commercial total;
- `PROCESSING`: confirmed order is being fulfilled;
- `COMPLETED`: fulfilled;
- `CANCELLED`: stopped/cancelled.

### 6.2 Order creation state

Guest Checkout creates a Retail Order in:

- `source = RETAIL`;
- `status = NEW`;
- `payment_status = UNPAID`.

The confirmation screen must say **Đơn hàng đã được tiếp nhận**, not imply that the sale is already confirmed.

### 6.3 What staff confirms

Depending on the order, staff may need to confirm:

- actual sellability/stock context;
- package composition validity;
- delivery fee;
- delivery timing;
- installation capability/fee if requested;
- final payable amount;
- bank-transfer instructions when that method was selected.

## 7. Amount semantics

The current schema assumes numeric `shipping_fee` and `total`, but the approved UX distinguishes **pending** from **confirmed** fees.

Do not encode `pending shipping` as `shipping_fee = 0` because zero is a valid final fee (free shipping) and is semantically different from unknown/pending.

Required model behavior:

- Product price snapshots and online discount are recorded at Order creation.
- Shipping/installation may be `PENDING_CONFIRMATION`.
- A customer-facing `tạm tính sản phẩm` is not the final payable total.
- `CONFIRMED` state may show the final confirmed shipping/install fee(s) and final total.

Exact column names may be finalized in the post-freeze implementation brief, but the pending-vs-confirmed distinction is mandatory.

## 8. Required schema/data amendments after global freeze

Current V1 Orders already have lifecycle/payment enums and basic customer/amount snapshots. The approved Retail UX requires additive amendments.

### 8.1 Selected sellable option snapshot

Order line snapshots must preserve the exact sellable option selected on PDP/Cart, including colour SKU where applicable.

Do not snapshot only the base Product SKU when the customer bought a colour-specific option.

Recommended snapshot fields/concepts:

- canonical Product ID;
- selected sellable-option ID nullable;
- SKU snapshot;
- option/colour label snapshot;
- Product/configuration label snapshot.

### 8.2 Retailer package snapshot

Order lines must be able to represent a `retailer_package` as one customer line while preserving package identity and component snapshots.

Required concepts:

- target kind (`manufacturer_product | retailer_package` or equivalent line kind);
- retailer package ID/key snapshot;
- package label snapshot;
- immutable package-component snapshot at Order creation;
- quantity applies to package.

Historical Order contents must not change when package curation changes later.

### 8.3 Shipping confirmation state

Add an explicit shipping-fee state such as:

- `PENDING_CONFIRMATION`;
- `CONFIRMED`.

A nullable fee plus explicit state or equivalent model is acceptable. `0` alone is not.

### 8.4 Installation support / fee

Persist customer intent:

- `installation_support_requested boolean` (or equivalent).

If installation fee becomes part of confirmed Order totals, add explicit confirmation/amount semantics rather than hiding it in `public_note`.

Recommended concepts:

- installation status: `NOT_REQUESTED | PENDING_CONFIRMATION | CONFIRMED`;
- installation fee nullable until confirmed.

### 8.5 Final total confirmation

The model must distinguish:

- product/subtotal known at intake;
- pending fee state;
- commercially final total after confirmation.

Do not expose a temporary amount as an irrevocable/final payable amount.

### 8.6 Bank transfer instructions

Bank account/instruction data is managed configuration and can be exposed to the customer only when the business rules allow transfer (normally after final total confirmation).

Do not store bank details as hard-coded component strings.

### 8.7 Idempotency

Keep/extend the existing request-hash/idempotency service boundary for Guest Checkout so network retry cannot duplicate an Order.

## 9. Order Confirmation / customer status surface

### 9.1 Approved semantics

D12 content covers:

- `NEW` COD;
- `NEW` Bank Transfer;
- `CONTACTED`;
- `CONFIRMED`.

Information approved by Owner:

- order number;
- current status;
- lifecycle meaning;
- recipient/address/payment/install-support snapshots;
- ordered lines and pricing status;
- next expected staff/customer actions.

### 9.2 Still open before final D12 approval

- final desktop layout optimization;
- replacement for the current top horizontal progress pattern;
- remove redundant status repetition;
- Bank Transfer `CONFIRMED` state showing confirmed total + managed transfer instructions;
- decide exact presentation for revisit/status tracking.

### 9.3 No account dashboard implied

D12 `CONTACTED` / `CONFIRMED` fixtures demonstrate state semantics. They do **not** automatically approve a customer account or order-history dashboard.

If V1 needs a public revisit/status page, define a secure guest-access mechanism separately (e.g. order reference plus a safe access token/verification method). Do not expose an Order by guessable order number alone.

## 10. Mobile Retail Order

Not designed yet at the time of this handoff.

After D12 desktop layout is approved, Mobile should reuse the same information model and contracts for:

- D10 Cart states;
- D11 Checkout + review/submitting/error states;
- D12 confirmation/status states.

Do not simplify away information solely to reduce mobile steps. Preserve the explicit review and staff-confirmation expectations.

## 11. Acceptance criteria for later implementation

At minimum, post-freeze implementation tests must prove:

1. manufacturer Product + selected colour SKU survives PDP → Cart → Order snapshot;
2. retailer package remains one customer line and freezes component snapshot;
3. invalid package/component blocks checkout before Order creation;
4. quantity/pricing recalculates deterministically;
5. online discount is auto-applied and snapshotted;
6. shipping `pending` cannot be confused with confirmed free shipping;
7. installation-support intent persists;
8. guest checkout creates `RETAIL / NEW / UNPAID`;
9. bank transfer does not require transfer before confirmation;
10. final total is displayed as confirmed only after staff confirmation;
11. retry is idempotent;
12. Retail Cart never silently becomes Quote Cart;
13. no customer account/payment gateway is introduced;
14. legacy Cart/Checkout/variant/package fields are not runtime authority.

## 12. Implementation gate

Before any Codex implementation:

- Owner must say exact global phrase `V1 WIREFRAME APPROVED / FROZEN`;
- D12 desktop layout/flow must be approved;
- Mobile Retail Order must be approved;
- Retail handoff/spec must be synchronized with final Figma nodes;
- schema amendments must receive a concise implementation brief and Owner approval before migration/code work.

Until then: read-only audit, documentation and Figma work only.
