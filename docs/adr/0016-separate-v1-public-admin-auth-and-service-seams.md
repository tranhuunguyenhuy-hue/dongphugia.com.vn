---
status: proposed
---

# ADR 0016: Separate V1 Public, Admin, Auth, and service seams

## Context

LEO-559 locks the architecture needed by M2 and M5. The Owner-approved Product
Charter makes `dongphugia.vn` the Public Application,
`admin.dongphugia.vn` a separate staff-only Admin Application, Supabase the
canonical data authority, and fixed multi-role staff access a V1 requirement.
The current monolithic Next application, bcrypt-backed Admin sessions,
single-role `admin > sale_manager > sale` hierarchy, direct Prisma calls, and
Blog-only Publishing architecture are evidence to evaluate, not New
Production authority.

This decision is source architecture only. It does not authorize Supabase Auth
configuration, schema/RLS changes, credentials, deployment, DNS, Production,
or implementation of LEO-564 or LEO-572.

## Decision

Use separate Public and Admin deployables with independent runtime
configuration, origins, cookies, cache policy, and release artifacts. They may
share pure domain modules and explicit transport contracts, but not a Next
runtime, privileged database client, server environment, Auth cookie, Admin UI,
or direct database implementation.

Supabase Auth identifies staff. Canonical authorization is a current database
lookup of an active Staff User's fixed role assignments. Effective permissions
are the union of the assigned roles. Neither `user_metadata`, a primary role,
nor a stale JWT role list is authorization authority. All data access remains
behind public-safe RLS reads, capability-aware staff RLS, allowlisted RPCs, or
narrow Edge/server interfaces.

## A. Application and service diagram

```text
Customer browser                         Staff browser
       |                                      |
       v                                      v
dongphugia.vn                          admin.dongphugia.vn
Public Application                     Admin Application
- public-safe read models              - Supabase Auth session
- Guest Operation forms                - capability-aware modules
- Shareable Quote read                 - no privileged browser key
       |                                      |
       | public/publishable identity           | staff access token
       v                                      v
+---------------- narrow HTTPS interfaces / Supabase Data API ---------------+
| Public reads under RLS | Guest Intake Edge | Staff Edge/server adapters     |
|                        | + guest RPCs       | + staff RPCs                  |
+-----------------------------------+------------------------------------------+
                                    |
                                    v
                     Supabase PostgreSQL (canonical authority)
                     - private canonical tables
                     - forced RLS and explicit grants
                     - transaction RPCs and readiness checks
                     - fixed Staff Role -> Capability mapping
                                    |
                       Bunny media adapter when required
```

The Public Application owns customer-facing pages, public catalogue/content
reads, guest Checkout-to-Order intake, Quote Request intake, and read-only
Shareable Quote access. It must not import Admin routes, staff session code,
staff mutations, Auth Admin methods, or a secret/service-role client.

The Admin Application owns staff login/recovery, Dashboard, Product/Catalogue,
Sales, Marketing, and Staff Users/Roles. Its browser may use only the public
Supabase URL plus a publishable key and the current staff access token. A
secret/service-role key is confined to a narrow trusted adapter for operations
that genuinely require Supabase Auth Admin authority; it is never shared with
the browser or used as a general data adapter.

Share only pure domain types, validation rules, fixed capability names,
publication-readiness rules, media-reference validation, and generated
transport types. Each deployable owns its framework adapter, session handling,
origin policy, cache behavior, and environment validation. Public responses
are cacheable only when they contain no session refresh or staff data; Admin
and Auth responses are private and `no-store`.

## B. Staff Auth lifecycle

1. An active Staff User with `admin.staff.create` uses an Admin server/Edge
   interface. That trusted interface calls Supabase Auth Admin invite/create;
   the browser never receives the secret key.
2. The invite redirect is allowlisted only for the Admin Application and uses
   the Supabase PKCE/SSR flow. The invitee sets a password and receives a
   host-scoped, secure Admin session. Public Application cookies are not shared.
3. Login uses Supabase email/password sign-in. Public self-signup, email
   signup, phone signup, and anonymous Auth sign-in remain disabled. A public
   reset request returns a non-enumerating result and redirects only to an
   allowlisted Admin password-change page.
4. Every protected interface validates the Supabase identity, maps
   `auth.uid()` to exactly one active Staff User, loads every assigned Staff
   Role, and authorizes the requested Capability. An unmapped, invited,
   disabled, or ambiguous identity fails closed.
5. Disabling a Staff User first marks the canonical Staff User disabled so RLS
   denies even a still-valid access token. The trusted Auth adapter then bans
   or disables future login and revokes refresh sessions globally. Supabase
   access tokens cannot be recalled before expiry, so capability checks must
   always include current Staff User status; a short access-token lifetime is
   defense in depth, not the revocation mechanism.
6. Role changes take effect from the canonical role-assignment lookup on the
   next operation. JWT/app metadata may mirror non-sensitive display context
   only; V1 RLS and mutation authorization do not depend on it.

Invite is deliberately fail-closed across the Auth/database seam: if Auth has
created an identity but Staff User/role persistence fails, that unmapped
identity has no access. Retry reconciles the exact Auth user ID rather than
creating a second user. Disable follows the reverse order for the same reason:
deny in the database first, then revoke Auth sessions.

## C. Canonical multi-role model

Conceptual private-schema model:

```text
staff_users
  auth_user_id uuid primary key -> auth.users.id
  email, display_name
  status enum('invited','active','disabled')
  created_at, updated_at, updated_by

staff_user_roles
  auth_user_id -> staff_users.auth_user_id
  role enum('Product','Sales','Marketing','Admin')
  created_at, updated_at, updated_by
  primary key (auth_user_id, role)

role_capabilities
  role, capability
  primary key (role, capability)
  migration-owned fixed configuration; no Admin write interface
```

`role_capabilities` is fixed, versioned configuration rather than a dynamic
RBAC builder. LEO-564 must expose one narrow `staff_context` read interface and
one `staff_has_capability(capability)` enforcement helper. The helper reads
current Staff User status and all role assignments. If implemented as
`SECURITY DEFINER`, it must live in a private schema, use a fixed empty/private
`search_path`, accept only the capability enum, expose no row data, have
default `PUBLIC` execution revoked, and be covered by denial tests.

`Admin` receives a broad explicit capability list, not `*`, bypass-RLS, or a
hard-coded bypass branch. The database enforcement mapping is authoritative;
UI navigation uses the same returned capability set but is not a security
control.

## D. Permission matrix

`R/C/U/P/A` means read/create/update/publish-or-share/archive-or-disable.
`P` is a direct transition after readiness and authorization checks; it is not
an approval step. `A` is resource-specific archive, cancellation, revocation,
or disable. V1 Admin interfaces do not hard-delete canonical or referenced
records.

| Module / resource | Product | Sales | Marketing | Admin |
| --- | --- | --- | --- | --- |
| Product, price, availability, media/docs | R/C/U/P/A | R | R | R/C/U/P/A |
| Family, Category, Brand, specs/filter metadata | R/C/U/P/A | R | R | R/C/U/P/A |
| Orders and payment status | - | R/C/U/-/A | - | R/C/U/-/A |
| Quote Requests | - | R/C/U/-/A | - | R/C/U/-/A |
| Negotiated Quotes, share Quote, Quote to Order | - | R/C/U/P/A | - | R/C/U/P/A |
| Guide, Inspiration, Buying Guide, Landing Page | - | - | R/C/U/P/A | R/C/U/P/A |
| Collections/editorial presentation | R | R | R/C/U/P/A | R/C/U/P/A |
| Staff Users and role assignments | - | - | - | R/C/U/-/A |
| Core V1 configuration | - | - | - | R/C/U/-/- |

The corresponding capability families are explicit:
`catalogue.{read,create,update,publish,archive}`,
`sales.order.{read,create,update,archive}`,
`sales.quote_request.{read,create,update,archive}`,
`sales.quote.{read,create,update,publish,archive}`,
`marketing.content.{read,create,update,publish,archive}`,
`marketing.collection.{read,create,update,publish,archive}`,
`admin.staff.{read,create,update,disable,assign_roles}`, and
`admin.config.{read,create,update}`. Dashboard capabilities are scoped reads
derived from the same module capabilities; Dashboard never grants authority.

## E. Guest and staff service contract

| Caller | Interface | Allowed outcome | Required controls |
| --- | --- | --- | --- |
| Guest | `order_intake.create` | Create one Order from canonical public Product facts | schema/size validation, authoritative price and availability snapshot, rate limit/abuse control, idempotency, atomic Order+lines, minimal receipt only |
| Guest | `quote_request_intake.create` | Create one Quote Request and immutable requested-Product snapshots | schema/size validation, public Product eligibility, rate limit/abuse control, idempotency, atomic request+lines, minimal receipt only |
| Guest | `shareable_quote.read(token)` | Read one non-revoked, non-expired customer-safe negotiated Quote projection | high-entropy token stored hashed, no numeric-ID fallback, no list/search, rate limit, no internal notes/staff/customer leakage |
| Staff | Catalogue/Marketing interfaces | Manage and directly publish authorized resources | current staff capability, RLS, readiness, version check, idempotency for mutations |
| Staff | Sales interfaces | Manage Orders, payment state, Quotes, sharing, and Quote to Order | current staff capability, explicit state transitions, atomic snapshot-preserving transaction |
| Staff | Staff Admin interface | Invite/disable Staff Users and assign fixed roles | explicit Admin capabilities, last-active-Admin invariant, trusted Auth Admin adapter |

Guest endpoints accept no privileged browser credential. Prefer a narrow Edge
or same-origin Public adapter authenticated only with the publishable project
identity and an allowlisted anonymous `SECURITY INVOKER` RPC. Private canonical
tables remain outside exposed schemas; `anon` receives only the exact function
execution and underlying insert/select privileges needed by that invoker path,
with forced RLS. Guest callers never receive Order/Quote list or mutation
interfaces after intake.

A guest Edge adapter must use Supabase's current publishable-key mode rather
than the existing authenticated-user helper or a service-role client. Its
platform JWT setting and application-level key validation must be configured as
one reviewed contract. Guest mutation CORS allows only the exact Public origin;
staff interfaces allow only the exact Admin origin, never `*`.

Shareable Quote uses a separately generated random token, stores only its hash,
and returns a public-safe projection. Staff access uses canonical Quote ID and
staff capabilities; the public token is never staff authority.

## F. RLS, RPC, Edge, and transaction recommendation

- Use direct Supabase Data API reads only through an explicitly exposed,
  read-only interface schema containing reviewed `security_invoker` views (or
  equivalent read RPCs). Underlying canonical tables stay private and RLS
  remains authoritative. Do not use direct browser table writes in V1.
- Use `SECURITY INVOKER` RPC for multi-table mutations, lifecycle transitions,
  all Admin writes, publication, Quote sharing, Quote to Order, guest intake,
  idempotent replay, optimistic concurrency, and any operation that must commit
  or roll back as one transaction.
- Use Edge/server adapters for request validation, CORS/origin rules, abuse
  controls, Auth Admin invite/disable/revoke, Bunny or other external calls,
  media processing, safe error translation, and transport orchestration. Pass
  the staff bearer token to an RLS-scoped client for data work.
- Use a secret/service-role client only inside the smallest trusted Auth Admin
  or external-integration adapter after that adapter performs explicit
  authorization. Never use it as the default Admin data client and never expose
  it to either browser.
- Keep canonical application tables in a private schema; expose only reviewed
  public views/RPCs. Enable and force RLS, revoke default `PUBLIC`, `anon`,
  `authenticated`, and service-role grants before adding exact grants.
- Prefer invoker functions. A definer helper is exceptional and limited to the
  private current-staff/capability lookup described above. No definer function
  may become a general CRUD interface.

LEO-541's owner-bound RLS, immutable snapshots, advisory transaction locks,
idempotency hashes, rollback behavior, and safe errors are reusable patterns.
Its authenticated-owner CRUD surface is not the guest V1 contract and must be
refactored into separate guest-intake and staff-operation interfaces.

LEO-542's bearer-to-RLS client, explicit grants, forced RLS, invoker RPCs,
fail-closed actor mapping, optimistic version checks, and authorization-read
guards are reusable. Its single `admin_users.role`, legacy role names,
Blog-only capability map, generic content/commerce resource switches, machine
identity assumptions, and deep audit tables are not the V1 model.

## G. Publishing authorization contract

Direct publication is allowed when the current active Staff User has
`catalogue.publish`, `marketing.content.publish`, or
`marketing.collection.publish` through any assigned role. Admin has those
explicit capabilities. Sales uses `sales.quote.publish` only to create or
replace the customer-visible Shareable Quote projection; it does not publish
catalogue or Marketing content.

Every publish operation must:

1. resolve current Staff User status and union capabilities in the database;
2. lock or compare the current resource version and reject stale writes;
3. run the resource-specific readiness gate, including canonical references
   and Managed Media readiness;
4. reserve an idempotency key and reject reuse with a different request;
5. atomically update public state, version, `updated_at`, and `updated_by`;
6. fail without changing the canonical resource when any check fails.

There is no mandatory approval state, reviewer role, notification, or
Blog-specific workflow. Draft/private states remain useful editorial states,
not approval queues. Reuse the proven separation of draft validity from public
readiness, media reference validation, safe idempotent replay, and optimistic
concurrency; generalize them by resource type.

## H. Reuse, refactor, and deprecate

| Disposition | Current evidence | V1 decision |
| --- | --- | --- |
| Reuse | LEO-539 private schemas, explicit grants, forced RLS, disabled signup baseline | Preserve and extend per V1 table/interface; revalidate target before rollout |
| Reuse | LEO-541 snapshots, idempotency, advisory locks, atomic rollback, safe responses | Keep as transaction-safety patterns |
| Reuse | LEO-542 bearer verification, RLS-scoped client, invoker RPC, fail-closed mapping/read guards | Keep as staff transport and enforcement patterns |
| Reuse | Publishing version checks, readiness, media validation, idempotency | Generalize to Catalogue, Marketing, and Quote sharing |
| Refactor | LEO-541 authenticated owner CRUD | Split into anonymous create-only Guest Operations and capability-aware staff operations |
| Refactor | LEO-542 Admin RPCs and role checks | Replace single role with fixed multi-role union and resource-specific interfaces |
| Refactor | Blog-only Publishing and machine identity controls | Keep separate integration identity only if a later approved automated publisher needs it; staff publishing uses Staff User capabilities |
| Deprecate | bcrypt `admin_users.password_hash`, `admin_sessions`, `dpg-admin-session` | Supabase Auth and Admin-host session are authoritative for New Production |
| Deprecate | `admin`, `sale_manager`, `sale`, role hierarchy, `admin_users.role`, wildcard `*` | Non-authoritative; replace with Product/Sales/Marketing/Admin role assignments and explicit capabilities |
| Deprecate | `/admin` inside the monolithic Public Next app and direct Prisma Server Actions | Non-authoritative; separate Admin deployable and Supabase interfaces |
| Deprecate | `audit_logs`, `runtime_audit_events`, `publishing_audit_events` as V1 product features | Do not carry forward as a deep audit/event platform |
| Deprecate | Generic service-role-backed Admin data access | Forbidden as a browser or default server data path |

## Audit contract

Canonical V1 business and role-assignment records carry only `created_at`,
`updated_at`, and nullable `updated_by` referencing the Staff User Auth UUID.
Guest-created records begin with `updated_by = null`; the first staff mutation
sets it. Database triggers or transaction RPCs maintain these fields so callers
cannot forge them.

Short-lived idempotency records, token hashes, Auth security records, and
provider logs may exist for correctness/security operations, but they are not
a user-facing audit history and do not retain change payloads. Do not implement
an audit event stream, revision store, notification system, or audit UI in V1.

## I. M2/M5 implementation constraints

LEO-564 (M2) must:

- implement the private Staff User, fixed multi-role, and migration-owned
  capability model plus current-status RLS helper;
- configure/verify invite-only Supabase Auth, exact Admin redirect URLs,
  PKCE/SSR session handling, recovery, disable, and global refresh-session
  revocation without exposing an Auth Admin secret;
- create separate guest-intake, Shareable Quote read, and staff-operation
  interfaces with exact grants, forced RLS, safe responses, and transaction
  tests;
- preserve LEO-541/542 idempotency, snapshots, concurrency, media readiness,
  and fail-closed authorization while removing single-role assumptions;
- prove no self-signup, no unmapped/disabled staff access, multi-role union,
  least privilege for each role, anonymous create-only access, token isolation,
  and absence of secret/service-role values from browser bundles; and
- keep all target/config/credential/runtime mutations behind their own Owner
  gates. This ADR alone authorizes none of them.

LEO-572 (M5) must:

- build `admin.dongphugia.vn` as a separate deployable that consumes the LEO-564
  interfaces and does not import the legacy `/admin` implementation or direct
  Prisma adapters;
- gate navigation and actions with the returned capability set while treating
  database RLS/RPC authorization as authoritative;
- implement only the approved Dashboard, Product/Catalogue, Sales, Marketing,
  and Staff Users/Roles modules and the matrix above;
- use archive/disable/cancel/revoke instead of general hard delete, preserve
  Order/Quote snapshots, and keep Quote to Order atomic;
- provide direct publish actions for authorized Product, Marketing, Sales
  Quote-sharing, and Admin capabilities without an approval workflow; and
- omit customer accounts, custom roles, deep audit, notifications, CRM,
  advanced Quote versioning, and other Product Charter exclusions.

Neither issue may reopen Public/Admin separation, Supabase as canonical data
authority, fixed roles, permission union, direct authorized publication, or
the basic audit limit without a new Owner architecture decision.

## Security guidance verified for this decision

Supabase's current guidance confirms that authorization data must not use
user-editable metadata, JWT claims may be stale, secret/service-role keys
bypass RLS and must never enter browsers, invite/recovery redirect URLs must be
allowlisted, and Auth SSR uses PKCE/cookie session handling. Implementation
must re-check the current changelog and docs before LEO-564 because these
interfaces continue to change:

- <https://supabase.com/changelog?types=breaking-change>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/database/secure-data>
- <https://supabase.com/docs/guides/auth/server-side>
- <https://supabase.com/docs/guides/auth/redirect-urls>
- <https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail>

## Related

- Linear project `Dong Phu Gia V1 — New Production`
- `V1 Product Charter — Dong Phu Gia New Production`
- `Technical Reuse Inventory — Pre-Reset Baseline`
- approved LEO-556 page/module inventory
- LEO-559 architecture lock
- downstream LEO-564 and LEO-572
- `docs/deploy/supabase-runtime-security-boundary.md`
- `docs/deploy/supabase-runtime-api.md`
