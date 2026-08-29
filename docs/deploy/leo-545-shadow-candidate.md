# LEO-545 immutable shadow candidate

This contract assembles the launch-required static and runtime boundaries into
one noindex Preview candidate. It does not authorize a Production deployment,
DNS/traffic change, target write switch, credential/security change, Bunny
write, scheduler activation, or merge.

## Candidate identity

The Preview workflow checks out and emits `candidate-evidence.json` for the
exact PR-head SHA (never the synthetic pull-request merge SHA) inside the immutable
`dongphugia-preview-<PR head SHA>` artifact. The evidence binds the exact PR
head SHA, PR number, workflow run ID, deterministic static-artifact SHA-256,
migration-manifest SHA-256, and SHA-256 of
[`leo-545-shadow-candidate-contract.json`](./leo-545-shadow-candidate-contract.json).
It also records static Blog-route count and the fact that at least one existing
`cdn.dongphugia.com.vn` reference remains in rendered HTML.

The JSON contract fixes the non-Production Supabase project/ref/region/schema,
the authenticated runtime function mapping, side-effect state, and rollback
boundary. The candidate does not store credentials, URLs with credentials, row
data, tokens, or synthetic-write payloads.

## Acceptance and handoff

Preview assembly uses the existing read-only source gate. It fails closed when
the source is not explicitly `read-only-non-production`, when any noindex
control is missing, when the configured Pages project does not already exist,
or when Blog/Bunny preservation cannot be proven from the static artifact.

LEO-546 and LEO-547 must consume the same PR-head artifact/evidence tuple.
They separately verify the deployed Preview URL, SEO/crawl parity, representative
media rendering, and live authenticated runtime/RLS behavior. No static
candidate evidence is proof of Production behavior.

## Rollback

AWS EC2/Coolify and AWS PostgreSQL remain the authoritative Production and
rollback boundary. The encrypted isolated Supabase backup/restore procedure in
[`runtime-backup-recovery.md`](./runtime-backup-recovery.md) is retained as
recovery evidence. Any transition of traffic or a write target belongs to the
separately Owner-approved M6 cutover gate.
