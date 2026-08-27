# LEO-531 infrastructure simplification proof gate

Verified: 2026-08-27. This is proof evidence, not implementation, merge,
deployment, migration, DNS, paid-service, Phase 2, or Production authority.

## Gate result

- Overall status: `BLOCKED`
- Architecture: `CONFIRMED_WITH_CHANGES` (Owner direction only; mandatory proof confirmation pending)
- Public static: `PASS_WITH_CHANGES` (artifact-size/route-generation subproof only; full gate unresolved)
- Database fit: `PASS_WITH_CHANGES`
- Backend: `NOT_RUN`
- Media: `NOT_RUN`
- Publishing freshness: `NOT_RUN`
- DevOps simplification: `NOT_RUN`
- Final decision: `NEEDS_MORE_PROOF`

The blocking fact is a current source-of-truth conflict: the freshly attested
Production PostgreSQL snapshot contains zero Blog categories/posts, while the
live no-cache runtime and sitemap still serve 14 Blog URLs. The Production app
was re-attested to the same database host, database, and `public` schema for
both its public and Publishing connections. Static cutover from the database
would therefore drop live indexed content. Do not create a detailed migration
roadmap until the 14 Blog records are recovered or their authoritative source
is proven and the full proof is rerun.

## Executive conclusion

- The isolated route-generation artifact is within Cloudflare Pages Free limits,
  but this is only a size/route subproof: the renderer is not a pixel/content-
  equivalent application build and the full public-static gate remains open.
- The proof generated 4,093 files and 7,559,256 bytes in 1.40 seconds from the
  restored local database; the Free limit is 20,000 files and 25 MiB per file.
- All 4,033 sitemap-eligible Products generated unique canonical PDP paths and
  three product sitemap files.
- Current `main` changes 162 live PDP paths; the proof generated 162 explicit
  legacy-to-canonical 301 rules with zero missing legacy Product URLs.
- Preview proof used disallow-all robots, per-page `noindex,nofollow`, and an
  `X-Robots-Tag` header for every generated HTML page.
- A reduced runtime DB restored locally to 108,181,171 bytes (103 MiB), below
  both the preferred 350 MiB ceiling and Supabase Free's 500 MB quota.
- All 55 retained table manifests matched their source snapshot by row count
  and aggregate row hash; required extensions remained present.
- The canonical Family migration replay produced 1 Family, 3 configuration
  groups, 18 memberships, and 2 catalogue gaps without changing any Product
  row hash or fabricating Products.
- PostgreSQL advisory locks and Publishing idempotency constraints behaved as
  required locally; the target Edge adapters were not run on Supabase.
- A 4.64 MB image produced all seven current WebP variants locally and can map
  to Cloudflare Images, but no real Images binding or Bunny write ran.

## Proof evidence

### Public static and SEO

Baseline `next build` at `origin/main=dea46db` completed in 14.18 seconds but
classified every public application route as dynamic because the root layout
uses `force-dynamic`. The isolated proof generator removed that inheritance by
building a separate public artifact from one read-only database snapshot.

Production artifact:

- 4,093 files; 7,559,256 bytes; 1.40-second proof generation.
- 4,033 Product pages; 4 category roots; 31 subcategories; 12 static content
  pages; 3 client-runtime shells.
- 4,033 unique canonical Product URLs; zero duplicates; 3 product sitemaps.
- Organization and Product JSON-LD were emitted. Article JSON-LD is supported,
  but no DB Blog row existed to generate an actual Article page.
- Bunny/Hita media URLs remained direct; observed media hosts were
  `cdn.dongphugia.com.vn` and `cdn.hita.com.vn`.
- Search, filtered/paginated listing variants, cart/order submission, API
  routing, maintenance, apex redirect, and query-string redirects remain
  dynamic/client/Worker responsibilities.

Preview artifact contained `noindex,nofollow` in every HTML page, disallow-all
robots, and `X-Robots-Tag: noindex, nofollow`.

Live comparison found 3,871 Product URLs unchanged and 162 changed by current
canonical taxonomy on `main`. The generated redirect file covered all 162 old
paths. Before any cutover, this inventory must be checked in and tested; a
runtime PDP redirect is not available after pure static export unless the
explicit rules exist.

### Database fit and archive design

The Production source was freshly re-attested before export:

- PostgreSQL 17.6; `default_transaction_read_only=on`.
- Role is not superuser and does not have `BYPASSRLS` or role memberships.
- SELECT on 57/57 application tables; INSERT/UPDATE/DELETE on 0 tables.

A normal `pg_dump` failed closed because the read-only principal cannot read
sequence state. No Production grant was changed. The successful design used:

1. schema-only export;
2. binary `COPY` for each table in one `REPEATABLE READ READ ONLY DEFERRABLE`
   transaction;
3. source integrity manifest in the same snapshot;
4. local PostgreSQL 17 restore;
5. sequence reset from restored maxima on the disposable target;
6. exclusion of data, not schema, for `crawl_product_snapshots` and
   `crawl_import_decisions`;
7. exact comparison of 55 retained table counts and aggregate row hashes.

Result after canonical Family replay: 108,181,171 bytes (103 MiB), leaving
258,820,429 bytes (246.83 MiB) below the preferred 350 MiB ceiling. Extensions
`pgcrypto`, `plpgsql`, and `uuid-ossp` remained. The two crawl tables remained
in schema with zero runtime rows.

There are about 126 days from this proof date through 2026-12-31. The preferred
ceiling therefore permits approximately 1.96 MiB/day of net database growth,
or 239% growth over the restored size. This is substantial headroom, but no
historical runtime-only size series exists to prove the actual slope. Planning
must add alerts at 250/300 MiB and fail the 350 MiB acceptance gate if observed
growth approaches that ceiling.

Archive-only crawl data was restored into a second disposable PostgreSQL 17
database together with its schema and retained dependency data. All three crawl
tables had zero rows in both the source COPY log and the restored database; the
three binary COPY artifacts were checksummed before the restore. A durable
archive must still package schema, binary data, checksums, source snapshot
identity, encryption, and retention metadata. A private encrypted R2 destination
remains a hypothesis; external placement needs owner approval. The local proof
copy is disposable and not a backup. Historical crawl/audit recoverability is
`UNKNOWN`: this rehearsal restored empty crawl tables and cannot prove recovery of
non-empty historical data.

The Blog conflict prevents an unconditional database PASS. A static build from
this snapshot would remove 14 currently live URLs. Recovery must use an
authoritative backup/cache-safe source, not fabricated catalogue/content data.

### Backend and Publishing (`NOT_RUN` on target)

Local PostgreSQL evidence found 11 Publishing tables, 9 Publishing-related RLS
policies, the unique `(identity_id, key_hash)` idempotency constraint, both
admin auth tables, and all four order/quote tables. Executable checks proved:

- the global Publishing advisory transaction lock blocks a concurrent holder
  and becomes acquirable after release;
- a duplicate idempotency key is rejected by PostgreSQL;
- a representative public search returned 8 rows in 43.44 ms locally.

Target disposition:

- Admin auth must preserve hashed sessions, role ordering, expiry, IP/network
  decisions, and authorization checks; adopting Supabase Auth silently is not
  equivalent.
- Admin CRUD, content writes, orders/quotes, search, and Publishing can use
  Edge Functions plus transaction-owning RPCs.
- Publishing must preserve bearer identity, capability re-checks, Global Gate,
  write freeze, audit, idempotency, response contracts, and advisory lock
  order. These rules belong in database transactions, not split client calls.
- Public order/quote POSTs need durable idempotency in addition to rate limits.
- Supabase's current hosted Edge limits are 256 MB, 150-second Free wall time,
  and 2 seconds CPU per request; Sharp/libvips is unsupported.

No Supabase project or Edge Function was created. Deno/runtime compatibility,
RLS role mapping, cold starts, egress, and end-to-end auth remain unproven.

### Media (`NOT_RUN` on target)

A generated 4,644,352-byte JPEG (2,400 x 1,800) passed the existing 5 MiB and
40 MP contract and produced the current seven WebP variants:

- thumbnail: 640x360 and 960x540;
- cover: 720x309, 1280x549, and 1600x686;
- inline: 640x480 and 960x720.

Cloudflare Images binding accepts raw streams up to 20 MB, so the input bound
fits. The adapter must transform each current width/crop/quality to WebP, PUT
the exact deterministic path to Bunny, and only then mark DB metadata ready.
Retries must reuse media ID/path; partial failures remain failed/recoverable.
Cloudflare's offline binding is low fidelity, so a real free binding test is
still required. No Bunny credential or object was used in this proof.

Current Free allowance is 5,000 unique transformations/month. At seven maximum
variants per source this allows at most about 714 entirely new seven-variant
sources per calendar month before new transformations fail; actual managed
media volume is UNKNOWN.

### Scheduler and freshness (`NOT_RUN` end-to-end)

Supabase documents `pg_cron` plus `pg_net` invocation every minute and records
job status in `cron.job_run_details`. Current PostgreSQL advisory locks are
compatible with this model. A disposable local Blog publication appeared in a
new 4,095-file artifact in 1 second and the fixture was removed.

This proves database-to-local-artifact latency only. GitHub dispatch/queue,
full UI build, Cloudflare upload/activation, cache visibility, failure
notification, and end-to-end publish-to-live time were not measured. The
existing <=5 minute expectation is therefore not yet accepted or weakened.

### DevOps simplification (`NOT_RUN`)

The proposed target daily path is:

`branch -> PR -> CI -> noindex preview -> review -> merge -> automated static deploy`

It may remove routine ARM64 image builds, EC2/SSM access, Coolify/container
selection, host-level validation, and runtime digest checks from public-site
delivery, but no target deployment, preview, rollback, or observation exercise
was run. EC2/SSM/Docker can leave the daily path only after the backend,
preview, publish freshness, rollback, and observation gates pass.

Remaining credentials are Cloudflare deploy/API, Supabase project/function,
Bunny write, GitHub Actions, machine Publishing, and encrypted-backup keys.
Rollback becomes promotion of the prior immutable static deployment plus
database-compatible backend rollback. New complexity is cross-provider
identity, secrets, logs, build triggers, and failure correlation.

## Material assumptions and required proof

The following are not proven:

- full current UI/content/accessibility parity from the generated static HTML;
- recovery and canonical ownership of 14 live Blog pages absent from the DB;
- real Cloudflare Pages build/upload/preview, `_headers`, `_redirects`, and
  apex/query redirect behavior;
- real Supabase schema/role/RPC/Edge runtime behavior and external restore size;
- real Cloudflare Images transformation and Bunny write/retry behavior;
- end-to-end publish-to-live latency <=5 minutes;
- actual monthly Bunny, function, image-transform, build, and egress usage;
- Supabase Free availability/backup risk acceptance.

Minimal owner approval for the next proof is limited to free, disposable,
non-Production Cloudflare Pages/Worker/Images resources and a disposable
Supabase Free project using schema plus synthetic data only. A Production-
derived Supabase restore, even read-only, requires separate explicit approval
for external data placement, region, retention, encryption, and deletion.

## Risks and recurring cost

- Production risk: stale cache currently masks missing Blog database rows;
  restart/revalidation may remove live pages before any migration.
- SEO risk: 14 live Blog URLs are not rebuildable from the attested DB; 162
  Product redirects must be explicit in static hosting.
- Data risk: Free has no automatic downloadable backups/PITR and enters
  read-only above 500 MB; archive and runtime backups require encrypted,
tested external restores.

Sanitized machine-readable aggregates are recorded in
`docs/ops/leo-531-proof-evidence.json`; no rows, credentials, connection URLs,
or external-system payloads are included.
- DevOps risk: split providers simplify the happy path but complicate incident
  correlation and secret rotation.
- Expected new core recurring cost remains $0 within current published limits.
  Bunny remains paid with actual usage `UNKNOWN`; AWS remains paid until a
  separately approved retirement gate. No paid fallback is approved.

## Credential incident

A Production runtime credential appeared in prior audit tool output. The value
must not be reproduced. Rotation remains a separate owner-approved Production
security action and was not performed by this proof.

## Decision

`NEEDS_MORE_PROOF`

Do not begin the detailed Linear implementation roadmap. First recover or
prove the authoritative Blog dataset, then request the narrowly bounded free
external proof above and rerun the proof gate. Mutation ownership is released
after this evidence PR is delivered; no runtime/external mutation is retained.
