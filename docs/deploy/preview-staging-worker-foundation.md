# Preview and Staging combined Workers

## Source topology

The source adapter builds the existing `apps/public` and `apps/admin` runtimes
into one Worker per environment:

| Environment | Worker | Public | Admin |
| --- | --- | --- | --- |
| Preview | `dpg-preview` | `/` | `/admin` |
| Staging | `dpg-staging` | `/` | `/admin` |

Each deployment has one `workers.dev` origin, one active Worker deployment and
one source SHA. Preview URLs, routes, custom domains, service bindings and
Production state are excluded. Public uses its code-owned synthetic fixtures;
Admin receives only the Supabase URL and publishable key. Its service layer,
JWT checks, staff mapping and RLS boundaries stay in the existing Admin module.
Admin session cookies are scoped to `/admin`, and password recovery links stay
on that path.

## Same-origin security boundary

Mounting Admin below `/admin` does not create a browser origin boundary. The
cookie path prevents the Admin session cookie from being sent to Public `/`,
but same-origin JavaScript on Public can still send requests to `/admin`; the
browser attaches the cookie when the request targets that path. Treat both app
bundles as equally trusted: a Public script injection or compromised dependency
could make and read same-origin requests using a signed-in staff session.

The dispatcher gives Public no Supabase URL/key or privileged binding, and the
Admin server still verifies JWT claims, active staff mapping, capabilities and
database RLS. These checks protect Admin data from unauthenticated Public users,
but cannot distinguish malicious Public JavaScript from the staff user's own
same-origin Admin actions. Keep this topology synthetic-only unless the Owner
accepts that trust model; a separate Admin origin is required for browser-level
isolation from Public.

## Trusted build and publication

`.github/workflows/environment-worker-ci.yml` builds and locally browser-checks
both identities without credentials. The manual
`.github/workflows/environment-worker-publish.yml` runs from `main` and accepts
either a commit on `main` or an exact open, same-repository PR head whose current
GitHub review decision is `APPROVED`. It checks out that SHA as build input,
builds and browser-checks it without Cloudflare credentials, and uploads the
artifact. The separate publication job checks out trusted `main` code, validates
the artifact manifest/digests and replaces its config with an allowlist before
it exposes a token to Wrangler. Candidate scripts never run in the credentialed
job. Preview and Staging publication share one non-canceling concurrency group.

## Cloudflare setup contract

Current source target account: `d54f3402b9d112ab64d6135e0e3f1fb1`.
The 2026-11-12 cleanup inventory recorded this manifest:

| Worker | Recorded state | Action in this task |
| --- | --- | --- |
| `dongphugia-v1-public-production` | Sole remaining script; source SHA `8c67d253c64c7bb44435984f3f736272c0326c4b`; active deployment `2c93c96f-2cf2-4627-8b8f-af7737111105`, version `7d0194d7-b007-4fb0-9fd9-d365ca9de834` | Keep unchanged |
| `dpg-preview` | Absent from account inventory | Owner creates |
| `dpg-staging` | Absent from account inventory | Owner creates |

Recheck the live manifest immediately before Owner setup. Preserve Production
and the separate `dpg-pr-291` account/workflow. This source foundation does not
create, update, delete or deploy a Cloudflare resource.

An Owner must create only `dpg-preview` and `dpg-staging` in the target account,
enable their `workers.dev` subdomains, and leave domains/routes empty. After both
exist, configure separate GitHub environments `cloudflare-preview` and
`cloudflare-staging`. Each environment's `CLOUDFLARE_API_TOKEN` must be an
account-owned token with `Individual Workers Editor` for only that environment's
existing Worker. Do not grant product-wide Workers Editor/Scripts Write,
Workers Admin, zone route write, or permission to the Production Worker. The
selected-Worker roles cannot create or delete Workers; this keeps resource
creation and cleanup under Owner control and limits CI updates to the named
nonproduction Worker. Before upload, the workflow checks that the selected
Worker is readable and the Production Worker is denied. Keep GitHub environment
approval protections enabled.

## Supabase build variables

Configure separate environments `dpg-preview-build` and `dpg-staging-build`
with public variables `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. These are build inputs, not Worker
secrets; the key is intentionally available in the Admin browser. Use distinct,
isolated, nonproduction Supabase Auth projects with synthetic data and restrictive
RLS. Never use a Production URL/key or a service-role/Auth-admin/database secret.
The workflow fails if either public value is missing. Project isolation, Auth
redirect allowlists, synthetic staff fixtures and tested credential scope must be
verified before publication; no project is provisioned or modified by this PR.

## Existing ownership and acceptance limits

PR #291 remains separate Phase 2 work and is not changed or restarted here. The
new environment publisher is owned by this foundation and targets only the two
Workers above. Local CI can prove route composition, rendered layouts, login
shell, same-origin assets, noindex and unauthenticated denial. It cannot prove a
real staff login, hosted logs, account token scope, deployment identity or live
database/Auth isolation; those require the sequenced Owner setup and Preview
acceptance.
