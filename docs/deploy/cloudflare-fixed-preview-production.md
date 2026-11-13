# V1: localhost → ONE fixed Worker Preview → Production

**Owner approved 2026-11-13.** Use **ONE named Worker Preview `staging` INSIDE `dongphugia-v1-public-production`**, not a separate Staging Worker. No new domain/Worker and no automatic Preview per branch.

| Environment | Resource | Purpose / data |
| --- | --- | --- |
| Localhost | Existing local Wrangler / dev | Fast coding and tests; disposable DB |
| **Fixed Preview `staging`** | **Preview of existing `dongphugia-v1-public-production` Worker** | M2 Public UI parity (snapshot allowed); M3 FULL legacy Admin, Hyperdrive and Auth with isolated TEST PostgreSQL |
| Production | Same Worker's Production deployment, `www.dongphugia.vn` and `dongphugia.vn` | M1 database-backed Public; M4 validated Admin `/admin` |

Current V1 Cloudflare account: `d54f3402b9d112ab64d6135e0e3f1fb1`. **No successful named `staging` Preview deployment was verified at this document update.** Existing older per-branch Preview records are not evidence of a working runtime. A separate Worker named `dpg-staging` exists but is **not** the approved target; leave unchanged pending later housekeeping.

## Create or update fixed Preview

1. Verify live account, installed/pinned Wrangler, current Worker configuration and Cloudflare Workers Previews mode. Previews **do not inherit Production settings**: explicitly configure `previews` vars/bindings in existing Wrangler config, plus separate Preview secrets.
2. Build the same Public application and, in M3, **all legacy Admin routes `/admin`**. Use one name every time: `npx wrangler preview --worker-name dongphugia-v1-public-production --name staging`. Verify actual CLI config and source SHA. Do not run `wrangler deploy` for Preview. Record generated stable Preview URL + immutable deployment URL/ID; do not invent addresses.
3. **M2:** compare Preview Public to current Production: homepage/banner, categories/PLP/PDP, SKU search, Blog, assets, desktop/mobile. Read-only published snapshot is permitted for Public and does not need fresh DB here. Keep noindex.
4. **M3 — explicit Owner permission:** Preview runs **FULL legacy Admin** using real Next/Workerd SSR, Prisma and Hyperdrive, real authentication/login/logout/cookies/CSRF/RBAC and all legacy modules/CRUD. No disabled sign-in shell or mock-only acceptance. Verify hosted CPU/latency and database persistence. Reuse `src/app/admin` and verified prior source from #300/#301/#304.
5. **Isolation is mandatory:** Cloudflare Previews Hyperdrive binding refers to a Hyperdrive config ID and **is not automatically isolated**. Provision a **different Hyperdrive configuration** that points to **a separate TEST PostgreSQL database or schema with restricted test roles**. Do not bind Production writable DB. Configure Preview-specific auth secrets/cookie domain/origin, never Production secrets in repo/client, and keep auth-sensitive query caching disabled. Preview URLs are public by default: protect with Cloudflare Access or equivalent **plus** the real Admin login/authorization.
6. Use one fixed Preview rather than branch fan-out: disable/filter per-branch auto Preview builds or deploy the fixed Preview manually. Owner's M1 Production read path is separate, earlier milestone. Do not modify Production routes/DNS while configuring Preview.
7. **M4:** publish only the Owner-accepted build to the existing Worker's Production deployment with Production-only credentials and tested rollback. Verify Production Public and Admin. Worker/Preview code rollback **does not roll back PostgreSQL mutations**; use separate DB restore/reverse plan.

## Version and rollback notes

For Preview failure, restore the previous pinned candidate **on the same `staging` Preview** or select an available prior Preview deployment through supported Cloudflare controls, never accidentally rollback Production. For Production failure, use the Production Worker Deployments rollback. Record exact source SHA, Preview deployment ID, URL and TEST DB identity (no secret values) on each milestone issue.

## Official Cloudflare references

- [Workers Previews](https://developers.cloudflare.com/workers/previews/)
- [Previews settings and secrets](https://developers.cloudflare.com/workers/previews/configuration/)
- [Preview Hyperdrive resource isolation](https://developers.cloudflare.com/workers/previews/resources/)
- [Wrangler preview](https://developers.cloudflare.com/workers/wrangler/commands/workers/#preview)
