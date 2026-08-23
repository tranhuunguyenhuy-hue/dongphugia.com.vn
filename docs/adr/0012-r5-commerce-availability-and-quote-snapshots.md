---
status: accepted
---

# Adopt the R5 commerce availability vocabulary and quote snapshots

## Context

R5 replaces the earlier two-value Availability vocabulary in ADR 0001 with the
approved commerce contract for the Version 02 hybrid catalogue. Quote Items
currently retain a live Product relation but do not preserve the Product facts
known when a request was submitted.

## Decision

- The shared commerce projection uses `PUBLIC_PRICE` or `CONTACT_FOR_QUOTE`.
- Canonical `sale_price` is the selling price when valid; canonical
  `list_price` is the reference price and is the displayed baseline when no
  valid sale price is present. Legacy `price` and `original_price` remain
  reference-only compatibility inputs.
- Availability is represented by `InStock`, `PreOrder`, `QuoteOnly`, or
  `Discontinued`. Unknown legacy values, including `out_of_stock`, are
  withheld rather than silently converted.
- New Quote Items capture Product SKU/name, commerce mode, Availability,
  canonical price facts, and `snapshot_at` atomically with the request.
- Existing Quote Items are not backfilled. Their live Product relation is a
  clearly marked compatibility fallback while it exists; the approved
  `ON DELETE SET NULL` relation prevents Product deletion from removing a new
  snapshot's historical facts.

## Consequences

The older Availability wording in ADR 0001 is superseded for R5 commerce
projection and quote handling. Product deletion can leave legacy pre-R5 Quote
Items without identity because those rows were explicitly not backfilled; the
admin UI marks this state and no Production deletion or migration is included
in the R5 task. A future legacy-row policy or evidenced backfill is separate.

