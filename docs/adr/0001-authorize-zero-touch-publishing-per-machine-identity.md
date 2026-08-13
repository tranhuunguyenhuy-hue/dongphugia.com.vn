---
status: accepted
---

# Authorize zero-touch publishing per Machine Identity

Dongphugia will allow only explicitly approved internal Publishing Agents to publish Blog Posts without per-post human approval. Each integration uses a distinct Machine Identity linked to an Integration Sponsor and independently granted `posts:write`, `posts:publish`, and `media:write` capabilities; shared admin identities and credentials, external partner access, and machine self-elevation are excluded. Updating a live Blog Post requires both post capabilities so `posts:write` alone can never bypass publication authority.
