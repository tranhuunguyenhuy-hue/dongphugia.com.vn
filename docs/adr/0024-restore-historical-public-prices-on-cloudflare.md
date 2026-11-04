# ADR 0024 — Restore historical Public product prices on Cloudflare

Status: Accepted for the Public recovery candidate — Owner decision 2026-11-03

## Scope

This decision applies only to the read-only Public snapshot that replaces the
contact-only snapshot after the Cloudflare migration. It does not authorize a
database update, checkout, order creation, Admin pricing, DNS change, or
Production release. Merge and Production remain separate Owner gates.

## Decision

The Owner approved publishing the old Dong Phu Gia prices tagged with the Hita
source, alongside the old manually sourced Public prices. Hita is provenance of
the recovered row, not a replacement retailer price catalogue. The protected
projection reads only public, eligible products and exports explicit allowlisted
fields into one versioned snapshot.

For a SKU, the old positive `price` is the recovered current Public selling
price. The source must be `manual` or `hita`, with matching source system, high
confidence, `priced` state, and the verified 2026-07-02 source update date.
Manual rows additionally require matching sale and list fields. A Hita row
keeps its recovered `price` even if optional comparison fields are absent or
contradictory. Such rows show no unverified original/promotion amount, and
their mismatch is counted as an exception. Missing or invalid base `price`
stays “Liên hệ báo giá”.

The Public display shows list/original price when its two old source fields
agree and it is no lower than `price`, promotional selling price when lower,
and the recorded online discount when valid. The final online price is
the selling price minus that discount. A missing discount does not become zero
and does not produce a final online price. The same projected amounts feed PDP,
cards, listing, and search. This is display of recovered historical prices;
the contact actions remain phone and Zalo.

## Relationship to V1 pricing work

ADR 0020 defines the canonical future Product and Order pricing semantics.
This recovery snapshot is a compatibility view over the old published fields.
It does not change the V1 Product/Order schema or make historical field names
authoritative for new commerce writes.

## Release controls

The candidate audit checks every product bucket, listing shard, search shard,
variant link, and price calculation against one checkpoint. The Preview and
Production Worker must use that exact snapshot and source SHA. The Owner reviews
the visible prices and exceptions before approving Production for the candidate.
