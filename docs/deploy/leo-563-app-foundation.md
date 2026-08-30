# LEO-563 New Production application foundation

Status: source implementation for review. This document records the
repository-only Public/Admin and CI foundation. It authorizes no Supabase,
Cloudflare, Bunny, AWS, DNS, IAM, credential, Production, or traffic mutation.
It performs no Cloudflare Preview publication.

## Repository structure

```text
apps/
  public/                    independent Public deployable
    app/                     Public-owned foundation routes
    src/config/env.ts        Public environment and browser-secret guard
    next.config.ts           Public build/runtime headers
  admin/                     independent Admin deployable
    app/                     Admin-owned foundation routes
    src/config/env.ts        Admin environment and browser-secret guard
    next.config.ts           private/no-store response baseline
packages/
  app-contracts/             framework-free identities and route contracts
scripts/app-foundation/      change gate and immutable artifact evidence
```

The root lockfile pins the shared toolchain, but each deployable owns its own
Next config, TypeScript project, environment validator, route tree, runtime
metadata, and build output. `npm run build:public` and `npm run build:admin`
never invoke the other application.

## Route and shared-code seam

The foundation owns only these routes:

| Deployable | Routes | Authority |
| --- | --- | --- |
| Public | `/`, `/robots.txt`, `/api/health` | `https://www.dongphugia.vn` |
| Admin | `/`, `/login`, `/robots.txt`, `/api/health` | `https://admin.dongphugia.vn` |

These are shell/probe routes only. No catalogue, checkout, search, filter,
quote, Product, Sales, Marketing, or Staff feature UI is implemented, and no
Figma-dependent composition is introduced. The full approved IA remains the
authority for later feature issues.

`packages/app-contracts` contains only literal identities, route ownership,
cache/noindex values, and TypeScript types. It imports no Next, React, Node, or
database module. Public does not import Admin code, legacy `/admin` code,
session code, staff mutation code, Auth Admin methods, or a service-role
client. Admin does not import Public code, Public cookies, or the legacy Public
runtime.

## Environment and cache contract

Both validators fail closed on unknown `NEXT_PUBLIC_*` variables and on known
privileged names such as database URLs, service-role/Auth Admin keys, session
secrets, provider API keys, and publishing tokens. Public Preview requires a
non-Production origin and `PREVIEW_NOINDEX=true`; its Production authority is
exactly `https://www.dongphugia.vn`. Admin allows only the publishable Supabase
URL/key in future browser configuration, never a staff token or secret; its
Production authority is exactly `https://admin.dongphugia.vn` and its shell is
always private/no-store and noindex. Supabase Auth/RLS/service integration is
deferred to LEO-564.

Public’s shell is anonymous and declares a 300-second revalidation contract.
Health/probe responses are private and no-store. Admin’s complete response
surface is private and no-store; it makes no Public cache assumption. No
session or cookie implementation is introduced by this issue.

## CI candidate contract

The `repo-code-gate` compares the exact PR-head SHA to its base and marks a
Preview as required only for material application/build inputs:

- `apps/public/**` or `apps/admin/**`, excluding documentation and tests;
- `packages/app-contracts/**`, excluding documentation and tests; or
- `package.json`, `package-lock.json`, or `tsconfig.json`.

Database, import, Supabase, migration, documentation, workflow-only, and test-
only changes cannot reach `app-preview-artifact` or a Cloudflare call. A
material change builds both deployables with `APP_ENV=preview`, an invalid
non-Production placeholder origin, and `PREVIEW_NOINDEX=true`.

Each artifact identity is a deterministic SHA-256 over sorted payload paths and
bytes, namespaced by application, exact source commit, and build target. The
payload omits Next builder-local cache, trace, diagnostics, type, and
machine-path metadata; these cannot become deployable application identity.
The candidate evidence also records the lockfile digest, PR number, workflow
run, Public checksum, Admin checksum, and the three noindex controls. CI
recomputes the identity immediately before artifact upload.

The existing single Pages workflow is not a valid target for these two
artifacts. The Cloudflare gate therefore records `BLOCKED_BY_OWNER_GATE` for a
material app change and performs no API or credential call. The exact deferred
decision is the identity and safety contract for separate existing
non-Production Preview resources for Public and Admin; no new resource is
created here. The resulting candidate remains CI-only. Production custom
domains, DNS, traffic, and Legacy Production remain untouched.

The existing merge/promotion workflows remain the historical single-artifact
Production path and are intentionally not wired to these new application
artifacts by this repository-only foundation. Production promotion, DNS, and
traffic remain separate future scope and are not authorized here.

## Deferred scope

- LEO-564: Supabase Auth, RLS, capabilities, guest/staff service interfaces.
- LEO-565: Bunny media, Cloudflare transform, recovery, and provider targets.
- LEO-566, LEO-567, LEO-568, LEO-569, LEO-571, and LEO-572: catalogue,
  commerce, search, filters, Quote, and Admin feature UI/behavior.
- Worker adapter compatibility/activation and any external Preview resource
  configuration: later Owner-gated delivery after this repository foundation.
