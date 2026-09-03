# ADR 0020 — Canonical V1 Product pricing contract

Status: Accepted — Owner decision 2026-09-03

## Context

The historical V1 schema used `retail_price` and `list_price`, while current Dong Phu Gia Production data also carries `price`, `sale_price`, and `online_discount_amount`. Those names do not express one consistent business meaning and can cause implementation mistakes.

The Owner has locked a simpler V1 model with two Product prices plus one specific online-order incentive.

## Decision

Current V1 application authority is:

- `price`: regular public selling price published by Dong Phu Gia.
- `sale_price`: optional promotional public selling price. When present it must be greater than zero and lower than `price`; it becomes the current displayed commerce price.
- `voucher_online_discount_amount`: optional additional fixed discount for an online order. It applies after `sale_price` when present, otherwise after `price`.

The current display price is therefore:

```text
sale_price ?? price
```

The online-order payable Product amount before shipping/services is:

```text
(sale_price ?? price) - (voucher_online_discount_amount ?? 0)
```

`voucher_online_discount_amount` is deliberately **not** a generic voucher/coupon engine. V1 does not add voucher codes, customer eligibility, stacking rules, automatic campaign pricing, customer segmentation, or promotion rule evaluation.

## Production mapping evidence

Current Production Product `CS735DT3#XW` demonstrates the intended semantics:

- regular/base website price: 5,832,000 VND;
- current sale price: 4,782,240 VND;
- additional online-order discount: 699,840 VND.

The existing Production UI renders the online discount separately from the sale price as “Độc quyền đặt Online / Giảm thêm ... khi đặt Online”.

Production field names are migration evidence only. Mapping into V1 must be validated by business meaning, not copied by matching names blindly.

## Compatibility

Historical `dpg_v1.products.retail_price` and `list_price` may remain physically present temporarily as compatibility-only fields so completed migration evidence is not rewritten. They are superseded as current application pricing authority and must not be used by new Public/Admin/Cart/Checkout code.

The corrective migration adds the canonical fields and changes the publication price gate to `price`.

## Import rule

Current Dong Phu Gia Production may be used as the approved business pricing source, subject to deterministic validation. Ambiguous or invalid combinations are quarantined for Product review instead of guessed.

Examples of invalid combinations include:

- missing regular `price` while a `sale_price` is supplied;
- `sale_price >= price`;
- online discount greater than or equal to the current displayed price;
- conflicting source fields whose business meaning cannot be established deterministically.

## Commerce snapshots

Retail Order implementation must snapshot the authoritative Product price inputs and the online discount actually applied. Historical Orders must not change when current Product pricing changes later.
