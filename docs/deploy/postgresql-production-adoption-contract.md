# M1 — Production PostgreSQL adoption and restoration runbook

**Active authority:** [M1 #307](https://github.com/tranhuunguyenhuy-hue/dongphugia.com.vn/issues/307), [AGENTS.md](../../AGENTS.md). Replaces the old ARM64/EC2 image-gated adoption process. This runbook does **not** itself attest that hosted DB is populated or authorize destructive operations.

## Target confirmation, before touching data

1. Verify actual Supabase **V1** project ref, Postgres version/schema (candidate `bonxyxluzlxfkdetryoo/dpg_app`), role boundaries, network path and Worker account. Never access V2.
2. Preserve and verify a restorable database backup/checkpoint and source artefacts with checksums. Confirm backup recovery separately from a Worker rollback.
3. **Read-only inventory:** table list and schema drift; Product, SKU, published Product, Blog, published Blog, category, URLs/slugs/media; compare with the best available original/source inventory and audit exceptions. Local restored figures (~17,752/10) are leads, not acceptance numbers.
4. Estimate free-tier quotas, DB size, query volume/connection pooling and CPU before high-volume import.

## Non-destructive reconciliation

- Import **only** proven source data, idempotently, with stable primary/unique keys and foreign-key/canonical URL checks. Use bounded batches; no blind truncation, reset or overwrite of legitimate hosted records.
- Preserve full Blog bodies, slugs, publish dates and media references; restore media separately when missing.
- Record before/after row counts, duplicate checks, price/source provenance, published totals and precise unresolved differences. Sample real PDP and Blog slugs; broken images/404s are failures.
- Keep sensitive DB credentials only in provider secrets, not in code, files, issue comments or logs.

## Public database read path

- Connect Production Worker with a least-privileged **read-only** PostgreSQL role and compatible Cloudflare connection adapter (Hyperdrive if proven with actual bindings). Do not expose privileged credentials to browser code.
- Implement bounded queries/cache and explicit freshness/invalidation. Public may use cached results but its authoritative data origin must be hosted PostgreSQL. Avoid calling an unchanging bundled snapshot a live DB connection.
- Verify from actual deployed Worker version and representative category/listing/PDP/search/Blog requests. Document the evidence that DB query/projection was used and content reconciliation passed.
- Preserve a tested switch/rollback to current published snapshot if new DB path fails, without losing current routes or images.

## Release and rollback

Capture Worker version/source/route baseline and DB checkpoint. Run focused localhost integration tests and production-safe read-only smoke, then controlled release to the existing Production Worker. If fault appears, rollback Worker version or select snapshot fallback; **never presume that undoes SQL or imported data**. Document any necessary SQL restore/reverse steps separately.

**M1 DONE** = hosted DB data reconciliation + Production Public **actually serving PostgreSQL Products and Blog** + rollback demonstrable + Owner acceptance. No Admin rollout or schema redesign in M1.
