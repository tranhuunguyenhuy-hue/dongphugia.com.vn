---
status: accepted
renumbered_from: ADR 0001 duplicate
---

# ADR 0014: Authorize zero-touch publishing per Machine Identity

> **Identifier normalization.** This accepted Publishing decision was formerly
> stored as a duplicate ADR 0001. It is renumbered to ADR 0014 to remove
> reference ambiguity; its decision and status are unchanged.

Dongphugia will allow only explicitly approved internal Publishing Agents to publish Blog Posts without per-post human approval. Each integration uses a distinct Machine Identity linked to an Integration Sponsor and independently granted `posts:write`, `posts:publish`, and `media:write` capabilities; shared admin identities and credentials, external partner access, and machine self-elevation are excluded. Updating a live Blog Post requires both post capabilities so `posts:write` alone can never bypass publication authority.
