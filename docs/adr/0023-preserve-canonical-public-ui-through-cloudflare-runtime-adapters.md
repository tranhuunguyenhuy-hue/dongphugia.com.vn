---
status: accepted
decision_date: 2026-10-15
issue: 150
---

# Preserve the canonical Public UI through Cloudflare runtime adapters

## Context

AWS credit expiry made the legacy Production runtime unavailable. The immediate
migration target is an isolated, noindex Cloudflare Worker Preview. The current
Production Public component tree and visual language remain the Owner-approved
UI authority; the closed historical static Pages candidate is not a UI source.

ADR 0017 selected a separate Public Worker runtime and deprecated the legacy
runtime composition. That decision does not require a second visual
implementation. Reimplementing current pages as independent static markup would
create two UI authorities and repeat the divergence already observed in the
historical Pages candidate.

## Decision

The current `src/app/(public)` page and layout composition is the canonical
Public UI during migration. Cloudflare `apps/public` imports that component tree
and changes infrastructure concerns through explicit interfaces:

- `@dpg/public-home-runtime` supplies serializable homepage data;
- `@dpg/public-interactions` supplies explicitly allowed Public interactions;
- the legacy adapter may use the current PostgreSQL/Prisma services;
- the Cloudflare Preview adapter uses deterministic, non-secret fixture data and
  rejects writes until a separately approved Supabase runtime gate exists.

The Cloudflare app owns runtime policy, noindex behavior, Worker packaging,
cache controls, and static-asset delivery. It must not fork the canonical Public
markup or design system.

## Consequences

- Page structure, visual components, responsive behavior, and public assets can
  move without a redesign.
- Runtime-specific dependencies stay behind narrow adapters instead of leaking
  into the shared UI.
- The first Preview proves homepage/shell fidelity only. Catalogue route parity,
  real data, search, cart submission, contact submission, and other writes
  remain separate acceptance gates.
- A second runtime adapter makes the interface a real boundary; tests must fail
  if the Cloudflare app imports a database client or privileged environment.
- Production custom domains, DNS, traffic, AWS shutdown, database migration,
  and merge remain outside this decision and require their own exact approvals.

## Rollback

Remove the task-owned Preview Worker version or its Preview alias. The legacy
runtime adapter and canonical source remain unchanged and authoritative; no data
rollback is needed because the first Preview adapter performs no writes.
