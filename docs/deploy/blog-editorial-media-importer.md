# Blog editorial media importer

The production image exposes `node scripts/publishing/import-blog-editorial-media.cjs`
as a private operator command for the approved Blog editorial media migration.
It is dry-run by default, never deletes source objects, and writes only
minimized JSONL inventory rows (post identifier, role, hostname and reference
hash) to the explicitly supplied private manifest path.

## Safety contract

- HTTPS sources only; DNS is pinned to a public address, redirects are bounded,
  private/loopback addresses are rejected, and the existing Publishing image
  processor enforces MIME, magic bytes, pixel and byte limits.
- Exact Product image URL relations are excluded. They are never uploaded or
  rewritten by this command.
- Ready Managed Media must be owned by the selected Publishing identity and use
  the expected purpose. Unknown or malformed Blog `<img>` references fail
  closed.
- Apply requires the Production environment, an active Publishing credential,
  an active admin actor, `--confirm yes`, and the application's write gate open.
- Publishing-owned Posts use the current version and idempotent mutation path;
  legacy/human Posts use an optimistic Prisma transaction plus a minimized
  admin audit event. A batch is limited with `--limit`/`--offset`.

## Procedure

Run the dry-run on the Production runtime with a root-owned private path, then
review the sanitized aggregate and preserve the manifest. Apply one bounded
batch at a time using the same path and an explicit admin/credential identity:

```text
node scripts/publishing/import-blog-editorial-media.cjs \
  --manifest-path /var/backups/dongphugia/blog-media-<run>.jsonl \
  --limit 2

node scripts/publishing/import-blog-editorial-media.cjs \
  --apply yes --confirm yes --environment production \
  --manifest-path /var/backups/dongphugia/blog-media-<run>.jsonl \
  --credential-id <approved-credential-uuid> \
  --admin-actor-id <approved-admin-id> --limit 2 --offset 0
```

Stop on any source/decode failure, version mismatch, Product/API compatibility
failure, non-zero write error, or post-deploy acceptance failure. Do not run on
Shared-data Staging; staging remains write-frozen and uses the same immutable
candidate only for read-only validation.
