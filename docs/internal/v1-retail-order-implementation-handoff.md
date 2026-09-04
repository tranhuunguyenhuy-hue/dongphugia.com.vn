# V1 Retail Order — Implementation Handoff

**Status:** Owner-approved Desktop + Mobile design contract; implementation blocked until global wireframe freeze  
**Owner approval date:** 2026-09-05  
**Audience:** Codex, maintainers, Product/Technical Owner  
**Figma:** `Dong Phu Gia V1 — LEO-579 Mobile Wireframes` (`LbiwIXMaip9LJ5jIauMNof`)  
**Figma section:** `06 — RETAIL ORDER` (`181:29`)  
**Linear:** LEO-567 — Build retail Cart, guest Checkout and Order flow

> [!IMPORTANT]
> Do **not** implement this document yet. Coding starts only after the Owner explicitly says:
> **`V1 WIREFRAME APPROVED / FROZEN`**.
>
> The Retail Order slice itself is fully Owner-approved on Desktop and Mobile. That slice approval does **not** override the global implementation gate.

## 1. Purpose

This is the durable implementation handoff for the approved V1 Retail Order experience:

**PDP → Retail Cart → Guest Checkout → Review & Send → Order `NEW` → staff confirmation → `CONTACTED` → `CONFIRMED` → `PROCESSING` → `COMPLETED`**.

It exists so Codex does not infer behavior from legacy Production checkout UI, stale schema assumptions, old variant/package data, or the Quote flow.

Core V1 principles:

- no customer account required;
- no payment gateway;
- payment methods are `COD` and `BANK_TRANSFER` only;
- Retail Cart and Quote Cart are separate flows;
- staff confirmation is required before an Order is commercially final;
- Product/colour/package selections from the approved PDP Family System survive into Cart and immutable Order snapshots;
- online discount is auto-applied; there is no coupon/voucher engine;
- Desktop and Mobile share one business contract. Mobile is a responsive presentation of the same state machine, not a separate commerce flow.

## 2. Authority and conflict rules

For Retail Order scope, authority order is:

1. Owner's newest explicit decisions.
2. Approved Figma Retail Order screens listed in this document.
3. This implementation handoff.
4. ADR `docs/adr/0021-v1-retail-order-staff-confirmation-and-pending-fees.md`.
5. PDP/Family handoff + ADR 0017 for Product/colour/package identity.
6. Pricing ADR 0020.
7. Existing canonical V1 schema/services where not superseded.
8. Legacy Production only as migration/reference evidence.

If older UI/docs conflict with the approved Figma or this contract, do not silently preserve the older behavior.

## 3. Approved Figma authority

Section: **`06 — RETAIL ORDER`** (`181:29`).

### 3.1 Desktop Cart — APPROVED

| Node | Screen | Contract |
| --- | --- | --- |
| `777:3` | D10A — Retail Cart / Populated / Normal | Normal Product + retailer-package cart |
| `777:133` | D10B — Quantity / Pricing updated | Quantity changes update totals deterministically |
| `777:263` | D10C — Needs attention / Block checkout | Invalid/unavailable configuration blocks Checkout |
| `777:397` | D10D — Empty Cart | Empty state |

### 3.2 Desktop Guest Checkout — APPROVED

| Node | Screen | Contract |
| --- | --- | --- |
| `800:2` | D11A — COD / Normal | Guest information + COD |
| `800:120` | D11B — Bank Transfer | Bank choice; no premature transfer |
| `800:241` | D11C — Validation errors | Preserve entered data and correct errors |
| `810:98` | D11D — Review before submit | Explicit Review before Order creation |
| `800:363` | D11E — Submitting | Submission locked/idempotent |
| `800:484` | D11F — Submission failure / Retry | Retry without data loss or duplicate Order |
| `812:2` | SPEC — D11 Checkout · Staff Confirmation Contract | Supporting contract |

### 3.3 Desktop Order Confirmation / Status — APPROVED

| Node | Screen | Contract |
| --- | --- | --- |
| `818:2` | D12A — COD / `NEW` | Order received; waiting for staff confirmation |
| `818:157` | D12B — Bank Transfer / `NEW` | Order received; **do not transfer yet** |
| `818:315` | D12C — `CONTACTED` | Staff contacted customer; details still being confirmed |
| `818:470` | D12D — `CONFIRMED` COD | Final commercial total confirmed |
| `863:2` | D12E — `CONFIRMED` Bank Transfer | Confirmed total + managed bank-transfer instructions |

Final approved D12 presentation rules:

- one customer-facing Order lifecycle progress only;
- do not duplicate status across a separate status hero, second lifecycle tracker and summary badge;
- current status and lifecycle progress are one coherent status surface;
- Order number belongs in **Thông tin đơn hàng** and supports copy action;
- detailed order/customer/payment/amount information remains visible below the progress;
- Bank Transfer instructions appear only after final commercial confirmation.

### 3.4 Mobile Cart — APPROVED

| Node | Screen |
| --- | --- |
| `902:2` | M10A — Retail Cart / Populated / Normal |
| `902:95` | M10B — Quantity / Pricing updated |
| `902:188` | M10C — Needs attention / Block checkout |
| `902:286` | M10D — Empty Cart |

### 3.5 Mobile Guest Checkout — APPROVED

| Node | Screen |
| --- | --- |
| `906:2` | M11A — COD / Normal |
| `906:107` | M11B — Bank Transfer selected |
| `906:215` | M11C — Validation errors |
| `906:323` | M11D — Review before submit |
| `906:402` | M11E — Submitting |
| `906:467` | M11F — Submission failure / Retry |

### 3.6 Mobile Order Confirmation / Status — APPROVED

| Node | Screen |
| --- | --- |
| `908:2` | M12A — COD / `NEW` |
| `908:91` | M12B — Bank Transfer / `NEW` |
| `908:183` | M12C — `CONTACTED` |
| `908:272` | M12D — `CONFIRMED` COD |
| `908:366` | M12E — `CONFIRMED` Bank Transfer |

Do not use obsolete/rejected Retail Order explorations as implementation authority.

## 4. Retail Cart contract

### 4.1 Retail Cart is not Quote Cart

Retail Cart and Quote Cart remain separate.

Do not add a CTA that silently converts Retail Cart into Quote Request. Quote has its own state and screens.

### 4.2 Cart line identity

Cart must support approved PDP selections:

1. `manufacturer_product` configuration;
2. exact selected colour/sellable option where applicable;
3. `retailer_package` configuration.

For a manufacturer Product, preserve at least:

- canonical Product ID;
- canonical Product/model identity;
- selected sellable SKU/colour option, if any;
- configuration/display label where useful;
- quantity;
- authoritative pricing inputs at Order creation.

A `retailer_package` appears as **one customer-facing Cart line / one ordered configuration**, not as unrelated component lines.

Example fixture: `Bộ sen TBG10302 + DGH108ZR`.

The UI may show `Gồm 2 sản phẩm`, while the backend retains canonical package/component references. Quantity applies to the complete package.

If a required package component/configuration becomes invalid or unavailable:

- line enters **Needs attention**;
- Checkout is blocked;
- customer must choose another valid configuration or remove the line;
- do not silently substitute or split package components.

### 4.3 Pricing

Canonical Product pricing:

- `price` = regular selling price;
- `sale_price` = optional promotional selling price;
- `voucher_online_discount_amount` = optional additional fixed online discount.

Current Product price = `sale_price ?? price`.

Online discount is automatically applied to an online Retail Order. It is not a claim/checkbox interaction.

Cart summary distinguishes:

- Product price before online discount;
- online discount;
- shipping-fee state;
- current Product subtotal/tạm tính.

Never display pending shipping as `0đ` or imply free shipping.

### 4.4 Availability and revalidation

Indicative availability may be shown, but Checkout/Order creation must revalidate sellability and pricing.

A Cart with unresolved line problems cannot proceed.

## 5. Guest Checkout contract

### 5.1 Approved user flow

Customer-facing checkout is intentionally simple:

**1. Thông tin → 2. Kiểm tra & gửi → 3. Nhân viên xác nhận → 4. Xử lý & giao hàng**

Only steps **1–2** are customer actions during Checkout. Steps 3–4 describe what happens after submission.

Implementation rules:

- do not restore the rejected `Process Context Header` / `Bước x / 4` banner on Cart or Checkout;
- show the short public **Quy trình đặt hàng** inside content where useful;
- Review remains mandatory before Order creation;
- do not create extra pages merely because the process has four labels.

### 5.2 No account

Checkout is guest-first. Do not introduce login/account requirements.

### 5.3 Customer/contact fields

Required:

- name;
- phone.

Optional:

- email;
- order note.

Validation errors preserve all entered data.

### 5.4 Shipping address

Approved hierarchy:

- Tỉnh / Thành phố;
- Phường / Xã;
- detailed address.

Use searchable selectors where appropriate. Form entry does not imply that final shipping fee is known.

### 5.5 Installation support

Optional customer intent:

**`Tôi cần nhân viên tư vấn lắp đặt`**.

This is not an automatic installation sale/fee. Persist the intent explicitly so staff can confirm capability, scope and fee later.

### 5.6 Payment methods

Supported V1 methods:

- `COD`;
- `BANK_TRANSFER`.

No online gateway.

#### COD

Customer pays according to the commercial total confirmed by staff. At Order creation `payment_status = UNPAID`.

#### Bank Transfer

At `NEW` / before commercial confirmation:

- display **Chưa chuyển khoản** / **Chưa cần chuyển khoản**;
- do not tell customer to transfer the temporary Product subtotal;
- do not expose the temporary subtotal as final transfer amount;
- do not require transfer to create the Order.

After `CONFIRMED`:

- final commercial total is available;
- bank-transfer instructions may become actionable;
- bank account/instruction values come from managed configuration, never hard-coded UI/business logic.

### 5.7 Review before submit

Only the Review state has the final **Gửi đơn hàng** action.

Review must cover:

- contact;
- delivery address;
- installation-support intent;
- payment method;
- order note;
- ordered Product/colour/package snapshots;
- Product price/discount currently recorded;
- fees still pending;
- the fact that staff will confirm pending commercial details.

### 5.8 Submission / retry

Submission is idempotent.

If the Order was created but the client lost the response, retry must recover/return the same Order rather than creating a duplicate.

Submitting blocks duplicate submit actions while preserving state. Failure retains user data and permits retry/edit.

## 6. Order lifecycle and staff-confirmation contract

Canonical lifecycle:

`NEW → CONTACTED → CONFIRMED → PROCESSING → COMPLETED`

`CANCELLED` is an allowed terminal branch according to the service transition contract.

Customer-facing meaning:

- `NEW`: request/order received; **not commercially confirmed**;
- `CONTACTED`: staff has contacted customer and is resolving pending details;
- `CONFIRMED`: parties have agreed stock/fees/final commercial total;
- `PROCESSING`: confirmed order is being fulfilled;
- `COMPLETED`: fulfilled;
- `CANCELLED`: stopped/cancelled.

Guest Checkout creates:

- `source = RETAIL`;
- `status = NEW`;
- `payment_status = UNPAID`.

The first confirmation surface says **Đơn hàng đã được tiếp nhận**. Do not imply the sale is already commercially confirmed.

Depending on the order, staff may confirm:

- actual sellability/stock context;
- package composition validity;
- delivery fee;
- delivery timing;
- installation capability/fee if requested;
- final payable amount;
- bank-transfer instructions when applicable.

## 7. Order Confirmation / customer status surface

### 7.1 One progress surface

Desktop and Mobile use one simple lifecycle progress:

**Tiếp nhận → Liên hệ → Xác nhận → Xử lý → Hoàn tất**

The progress is a customer-readable representation of Order lifecycle; it is not a Checkout stepper.

Rules:

- highlight current/reached lifecycle state;
- show one current-status label with the progress;
- do not duplicate a second full tracker;
- do not repeat the same status in an Order Summary badge;
- keep Mã đơn in **Thông tin đơn hàng**;
- keep recipient/address/payment/install-support snapshots and ordered lines visible;
- cancellation is a separate terminal branch, not a sixth normal forward step.

### 7.2 Bank Transfer states

`NEW`:

- no transfer instruction;
- no final transfer amount;
- clear instruction to wait for staff confirmation.

`CONFIRMED`:

- final commercial total is explicit;
- transfer guidance can be shown;
- managed bank details are rendered from configuration;
- payment may still be `UNPAID` until payment reconciliation occurs.

### 7.3 No account dashboard implied

Approved D12/M12 states define status semantics. They do **not** approve a customer account or order-history dashboard.

If a later V1 task requires public revisit/status access, define a secure guest-access mechanism separately. Do not expose an Order by a guessable order number alone.

## 8. Amount semantics

Approved UX distinguishes **pending** from **confirmed** fees.

Do not encode pending shipping as `shipping_fee = 0`, because zero is a valid confirmed free-shipping amount and is not the same as unknown/pending.

Required behavior:

- Product price snapshots and online discount are recorded at Order creation;
- shipping/installation may be `PENDING_CONFIRMATION`;
- `tạm tính sản phẩm` is not the final payable total;
- `CONFIRMED` may show confirmed shipping/install fee(s) and final total.

Exact physical column names can be finalized in the post-freeze schema brief, but these semantics are mandatory.

## 9. Required schema/data amendments after global freeze

The approved UX requires additive amendments to current V1 Orders.

### 9.1 Selected sellable-option snapshot

Order lines preserve the exact sellable option selected on PDP/Cart, including colour SKU where applicable.

Recommended concepts:

- canonical Product ID;
- selected sellable-option ID nullable;
- SKU snapshot;
- option/colour label snapshot;
- Product/configuration label snapshot.

Do not snapshot only the base Product SKU if the customer selected a colour-specific option.

### 9.2 Retailer-package snapshot

Required concepts:

- line/target kind: `manufacturer_product | retailer_package` or equivalent;
- retailer-package ID/key snapshot;
- package label snapshot;
- immutable component snapshot at Order creation;
- quantity applies to the package as a whole.

Historical Orders must not change when package curation changes later.

### 9.3 Shipping confirmation state

Represent shipping-fee state explicitly, e.g.:

- `PENDING_CONFIRMATION`;
- `CONFIRMED`.

Nullable amount + explicit state or an equivalent model is acceptable. `0` alone is not.

### 9.4 Installation support / fee

Persist customer intent explicitly, e.g. `installation_support_requested`.

If installation fee participates in confirmed total, model it explicitly rather than hiding it in notes.

Recommended semantic states:

- `NOT_REQUESTED`;
- `PENDING_CONFIRMATION`;
- `CONFIRMED`.

### 9.5 Final total confirmation

The model distinguishes:

- Product subtotal known at intake;
- pending fees;
- commercially final total after staff confirmation.

Do not expose a temporary amount as final payable amount.

### 9.6 Bank-transfer instructions

Bank account/instruction data is managed configuration and becomes customer-visible only when business rules allow transfer.

### 9.7 Idempotency

Keep/extend the request-hash/idempotency service boundary so Guest Checkout retry cannot duplicate an Order.

## 10. Responsive implementation contract

Desktop and Mobile are both approved and must remain behaviorally equivalent.

Mobile rules visible in approved M10/M11/M12:

- 390px reference width;
- stack content into a single reading column;
- Product/Order Summary follows the main form/status information rather than becoming a permanently separate desktop rail;
- primary CTA remains full-width or clearly dominant;
- Cart line quantity/remove controls remain directly reachable;
- Checkout fields stack without removing required information;
- Review state remains explicit;
- Order lifecycle progress remains a single status surface;
- do not remove status/payment/fee information just to shorten the page.

Responsive code may adapt spacing/wrapping, but must not invent different business behavior per breakpoint.

## 11. Acceptance criteria for later implementation

Post-freeze implementation tests must prove at minimum:

1. manufacturer Product + selected colour SKU survives PDP → Cart → Order snapshot;
2. retailer package remains one customer line and freezes component snapshot;
3. invalid package/component blocks Checkout before Order creation;
4. quantity/pricing recalculates deterministically;
5. online discount is auto-applied and snapshotted;
6. shipping `pending` cannot be confused with confirmed free shipping;
7. installation-support intent persists;
8. guest checkout creates `RETAIL / NEW / UNPAID`;
9. Bank Transfer does not require payment before confirmation;
10. final total is displayed as confirmed only after staff confirmation;
11. Bank Transfer `CONFIRMED` uses managed instructions + confirmed amount;
12. retry is idempotent;
13. Retail Cart never silently becomes Quote Cart;
14. no customer account/payment gateway is introduced;
15. Checkout preserves the approved **Thông tin → Kiểm tra & gửi** customer-action flow;
16. rejected `Process Context Header`/duplicate checkout step banners do not return;
17. Order status uses one lifecycle progress surface without duplicate tracker/status badge;
18. Desktop and Mobile satisfy the same business contract;
19. legacy Cart/Checkout/variant/package fields are not runtime authority.

## 12. Codex handoff sequence after global freeze

When, and only when, the Owner has said **`V1 WIREFRAME APPROVED / FROZEN`**, use this document similarly to the PDP implementation handoff:

1. Codex reads this handoff, ADR 0021, PDP/Family handoff, ADR 0017 and pricing ADR 0020.
2. Audit existing Retail Cart/Order schema/services against this contract; do not redesign UX.
3. Produce a concise delta plan covering schema, service/API, Cart state, Checkout/idempotency, staff-confirmation amounts and responsive UI.
4. Surface conflicts/gaps instead of silently adapting the approved design to legacy code.
5. Obtain Owner approval for schema/migration decisions before destructive or persistent-data changes.
6. Implement in minimal reviewable slices with tests against Section 11.
7. Treat approved Figma nodes as visual/interaction authority throughout implementation.

Do not re-open already approved Product/Family/Retail UX unless an implementation blocker proves the approved contract technically impossible.

## 13. Current implementation gate

Retail Order design prerequisites are complete:

- Desktop D10/D11/D12: **APPROVED**;
- Mobile M10/M11/M12: **APPROVED**;
- durable Retail implementation handoff: synchronized with final approved Figma nodes.

What is **still missing** is the project-wide gate:

- Owner has **not yet** said `V1 WIREFRAME APPROVED / FROZEN` for 100% launch-critical Public + Admin wireframes.

Therefore no Codex/application/schema implementation is authorized yet. Documentation/read-only analysis may continue.