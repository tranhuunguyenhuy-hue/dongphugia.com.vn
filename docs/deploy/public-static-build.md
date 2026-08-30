# Canonical public static build

Status: current source/build procedure for LEO-536. This creates a reviewable
static artifact only. It does not deploy, change DNS or traffic, write a
database, resume Phase 2, or provision a Cloudflare resource.

## Build contract

`npm run static:build` reads the public source dataset through `pg` inside a
repeatable read-only PostgreSQL transaction. The output is plain HTML and
static control files; it does not contain a Next.js server or a Prisma runtime.
The existing taxonomy path helper remains the canonical Product URL authority.

The build fails closed unless it produces exactly 4,033 unique canonical
Product paths and all four public category roots. It emits the required static
content, taxonomy, Product/PDP, Blog, search/cart/order shells, sitemap index,
three 2,000-URL Product sitemap batches, robots, redirects, redirect metadata,
headers, and a sanitized build report.

SEO output preserves the `https://www.dongphugia.vn` canonical base, title and
description metadata, Product/Breadcrumb/Article/Organization JSON-LD, exact
source media URLs, legacy 301 rules, `/tin-tuc` redirects, and the existing
`/api/sitemap_static` compatibility redirect. Query-string category redirects
are recorded in `redirects.json` for the later Worker responsibility.

The approved `dongphugia-runtime` Preview source stores the reduced runtime
dataset in the private `dpg_app` schema. Its CI connection must authenticate as
the target-local `dpg_readonly_login`, explicitly set role `dpg_readonly`, and
pass `npm run static:verify-preview-source` before the build. That attestation
checks the target contract, Preview identity, Free-tier headroom, transaction
read-only mode, and SELECT-only access to every Product, Blog, Family, and
redirect table used by the build. It emits no rows or credentials.

## Source-safe invocation

The read-only guard is mandatory and the database transaction is also declared
read-only:

```sh
PUBLIC_STATIC_BUILD_READ_ONLY=true \
  DATABASE_URL='(provided by the authorized build environment)' \
  npm run static:build -- --mode=production --output=/absolute/path/to/output
```

Use `--mode=preview` only for a noindex review artifact. Preview emits
`Disallow: /` and `X-Robots-Tag: noindex, nofollow`; it must not be submitted
to a search engine. Never put a credential, connection URL, row, or raw
production payload in the report or PR.

## Required checks

```sh
npm run static:check
npx vitest run scripts/quality/product-family-preservation-contract.test.ts
npm run lint
npm run typecheck
npm test
```

The static checks report file count, total bytes, largest file, sitemap URL
count, canonical Product coverage, and reject any artifact file containing a
Prisma runtime marker. The free-tier guard is 20,000 files and 25 MiB per file;
the accepted historical regression baseline is 4,093 files and 7,559,256 bytes.
Provider-plan facts remain subject to the LEO-532 current-plan verification
gate. A passing local or PR artifact does not authorize Preview deployment,
merge, Production, DNS, or traffic changes.

## Migration PR CI and Preview gate

`.github/workflows/migration-preview.yml` remains the required repository gate
for every PR to `main`. It runs lint, type-check, the full test suite, and the
LEO-536 static contract checks without publishing the legacy static artifact.
The LEO-563 repository-code gate then compares the exact PR-head SHA with the
base SHA. Only material changes under `apps/public`, `apps/admin`,
`packages/app-contracts`, or the shared build manifests can produce the new
application Preview candidate.

For that predicate, CI builds Public and Admin independently, records each
artifact SHA-256, binds both to the exact source SHA and lockfile digest, and
verifies the candidate identity before uploading the CI artifact. The Public
artifact carries the Worker-plus-Static-Assets runtime identity; Admin carries
the independent private-runtime identity. Both Preview artifacts require the
HTML, response-header, and `robots.txt` noindex contract.

The former single-Pages publish/create path is intentionally not called. One
existing Pages project cannot safely represent the separate Public Worker and
Admin deployables, and LEO-563 does not create or reconfigure a Cloudflare
resource, credential, binding, custom domain, DNS record, or traffic route.
Application candidates therefore remain CI-only until an Owner attests exact
separate non-Production Preview resources and authorizes a later adapter.
DB/import/docs-only changes end with `SKIPPED_UNRELATED_CHANGE` and cannot
reach the candidate or Cloudflare path. Candidate build, identity, or noindex
failures fail closed.
