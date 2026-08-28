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

`.github/workflows/migration-preview.yml` runs on every PR to `main` and is
the required migration delivery gate. It runs lint, type-check, the full test
suite, and the LEO-536 static contract checks. When an Owner has already
authorized an exact read-only non-Production source, it builds the `preview`
mode artifact, verifies the free-tier limits and every HTML/headers/robots
noindex control, and emits a candidate tuple containing the source commit, PR,
workflow run, artifact SHA-256, and migration manifest SHA-256.

Cloudflare upload is separately gated by the single non-Production Pages project
contract. The workflow may create exactly the configured project when it is
absent, using the pre-authorized Pages:Edit token; it fails closed on API,
identity, custom-domain, or branch mismatches.
The workflow never creates a project, secret, binding, permission, security
setting, DNS record, traffic route, or deployment deletion. The Owner must
preconfigure `MIGRATION_PREVIEW_SOURCE_ENABLED=true`,
`MIGRATION_PREVIEW_SOURCE_CONTRACT=read-only-non-production`,
`CLOUDFLARE_PAGES_PREVIEW_ENABLED=true`, and the exact
`CLOUDFLARE_PAGES_PREVIEW_PROJECT`, plus the existing read-only source,
`CLOUDFLARE_ACCOUNT_ID`, and least-privilege Pages Edit
`CLOUDFLARE_API_TOKEN` secrets. Missing gates produce
`BLOCKED_BY_OWNER_GATE`; build, free-tier, identity, or deployed noindex
failures fail the workflow and block the merge path. A successful deployment
is checked at a `pr-<number>.<project>.pages.dev` alias for HTML
`noindex,nofollow`, `X-Robots-Tag: noindex, nofollow`, and `Disallow: /`.
