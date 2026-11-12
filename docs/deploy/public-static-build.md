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

## PR application CI

`.github/workflows/migration-preview.yml` remains a required source and
integration gate for application changes, but it no longer builds or publishes
a Cloudflare Preview candidate. The exact PR-head change gate selects the
Public, Admin, database/Auth, and backup checks; it carries no Cloudflare
credential and has no external Preview path.

The PR application build checks Public and Admin without secrets. The scoped
environment Worker CI checks the same-origin `/` and `/admin` dispatcher and
its fail-closed policies. Local Preview is started with `npm run preview:local`
at `http://127.0.0.1:8787`; the Staging publisher is a separate trusted,
serialized workflow for the single `dpg-staging` Worker, described in
[`preview-staging-worker-foundation.md`](preview-staging-worker-foundation.md).
