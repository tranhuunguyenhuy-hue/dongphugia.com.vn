# Codex living project context

**Updated:** 2026-08-01 Asia/Ho_Chi_Minh

**Context owner:** Codex

**Status:** Platform and domain migration preparation is in progress. Production
data and public traffic have not moved to the target platform.

This is the compact continuity record for future Codex sessions. It is not a
substitute for read-only verification: commits, checks, deployments, DNS and
runtime health may change after this file is written.

## Project outcome

- Keep current public production at `https://www.dongphugia.com.vn` on Vercel
  until the target is accepted and an approved traffic switch is complete.
- Launch the target at `https://www.dongphugia.vn` on AWS EC2 Singapore,
  Coolify, immutable Linux/ARM64 GHCR and Next.js.
- Redirect `https://dongphugia.vn` to the target `www` with HTTP 308.
- Move the application-owned `public` schema to self-hosted PostgreSQL with TLS
  `verify-full` and retain Bunny Storage/CDN compatibility.
- Keep Vercel and the `.com.vn` domain as the rollback baseline through the
  observation window. Redirect the old domain only after separate approval.

## Latest verified reference snapshot

| Item | Verified reference |
|---|---|
| PR #26 head | `9aa93c3c565e23e459d4e4f24ba363805ab88134` |
| PR #26 required checks | quality, homepage-readiness and Vercel passed |
| Accepted application baseline | `090ff89c981f8c6b2d851bf99d7fb8572dacc4da` |
| Stable staging digest | `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df` |
| Dark-production digest | `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b` |
| Current public production | Vercel on `www.dongphugia.com.vn` |
| Target PostgreSQL | provisioned and TLS-validated; production data not migrated |
| Target DNS/traffic | not switched; target `www.dongphugia.vn` not publicly resolving at last verification |

Before using any row as an execution input, re-verify it against the source of
truth. Do not build or deploy from a stale copied SHA or digest.

## Completed preparation evidence

- Exact green application baseline and immutable release references recorded.
- Stable staging and production-specific dark image identities recorded.
- Dark application health, target DB TLS, homepage, admin session lifecycle and
  media read were previously accepted without canonical traffic.
- Disposable Bunny object upload/read/checksum/TLS/delete smoke passed.
- Source backup, checksum, off-host copy and isolated restore evidence were
  prepared under the approved Minimum Safe Launch scope.
- Vercel and the old domain remain available as the rollback baseline.
- Mắt Bão `.vn` portal DNS export was captured outside the repository at
  `/Users/m-ac/Downloads/dongphugia.vn-01082026022643.csv`. The CSV SHA-256 is
  `5f8866721e952dc9bb6b19df2e86e9c4fab3b383659648f719a48f85d057033a` and
  contains one operational record: `@ NS ns1.matbao.com., ns2.matbao.com.` with
  TTL `3600`. A public authoritative NS lookup matched the CSV. The supporting
  non-repository dossier is
  `/Users/m-ac/Downloads/dongphugia-DNS-evidence-2026-08-01.md`.
- P.A Việt Nam `.com.vn` zone export was captured outside the repository at
  `/Users/m-ac/Downloads/dns_records_dongphugia_com_vn_2026-08-01_22-03-51.csv`.
  The UTF-8/BOM CSV has 5 unique customer-managed records and SHA-256
  `cd05ed3f9413f9af99da855cd99331271819e3411227ddb8bd622c0c70f1ad50`.
  Sanitized inventory is `@ TXT` TTL 3600 (value withheld), `cdn CNAME ->
  dpg-products.b-cdn.net` TTL 3600, `@ A -> 216.198.79.1` TTL 3600, `www
  CNAME -> f67c116b40bea258.vercel-dns-017.com` TTL 3600, and `* A ->
  103.9.159.156` TTL 300. Read-only authoritative comparison passed. Current
  NS are `ns1.pavietnam.vn` and `ns2.pavietnam.vn`; no public MX/CAA data was
  observed. The former P.A export blocker is closed; no DNS mutation occurred.

## Latest technical readiness refresh - 2026-08-01 22:33 Asia/Ho_Chi_Minh

- PR #29 remains open/draft at exact head
  `31b6e1c60ee35cd2eab13a515d492c0f1e1c9e7b`; quality,
  homepage-readiness, Vercel and preview comments are all `PASS`.
- AWS profile `dongphugia-admin` is valid for account `503344933326` in
  `ap-southeast-1`; EC2 `i-011fe10948e0a8c15` is arm64/running with EIP
  `47.131.92.97`, status checks `ok` and SSM `Online`.
- Dark resource `dongphugia-web-production-dark` runs exact digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`,
  healthy, restart `0`, internal `/` HTTP `200`.
- Coolify ingress is `coolify-proxy` / Traefik `v3.6` on ports 80/443/8080.
  The dark router is only HTTP `Host(dpg-production-dark.invalid)` to port
  3000; the proposed `.vn` hosts return HTTP `404`, HTTPS returns `503`, and
  the current SNI certificate is the Traefik default certificate, not covered
  for either `.vn` host. This is the current TLS/ingress technical blocker.
- Target DB is private with `pg_isready` PASS, `ssl=on`, minimum TLSv1.2 and
  4/5 active sessions encrypted. Client `verify-full` was not reproven without
  secret exposure; prior evidence is stale for this checkpoint.
- Read-only dark HTTP checks passed for homepage, sitemap, robots, admin login
  GET, hero widths 720/1280, canonical/OG/JSON-LD and security headers. No
  credentials, sessions or business writes were created. Accepted source
  `090ff89` statically contains centralized write-freeze coverage.
- Data backup/restore, P.A/Mắt Bão DNS exports and rollback evidence remain
  unchanged and are not repeated here.

The session taking over a release action must locate and verify the underlying
artifact/log evidence; this summary alone is not an approval.

## Current critical path

1. Preserve the checksum-verified `.vn` and `.com.vn` zone exports as rollback
   evidence; no DNS mutation is authorized.
2. Resolve dark-only TLS/ingress routing and revalidate target DB `verify-full`
   without exposing secrets.
3. Refresh backup, restore and reconciliation evidence only for a newly
   approved maintenance window.
4. Present `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` with exact timing,
   downtime, owners, final-copy plan and rollback triggers.
5. Only after an approved data cutover and target acceptance, present
   `DNS-SWITCH-APPROVAL-GATE` with exact records, TTL, TLS and rollback.

## Active blockers and human dependencies

- `FACT` - The 31 July 2026 maintenance window has expired.
- `HUMAN-ONLY` - PM must approve a new write-freeze/data-copy window.
- `FACT` - Both `.vn` and `.com.vn` read-only zone exports are now checksum-
  verified; the former P.A Việt Nam export blocker is closed.
- `TECHNICAL BLOCKER` - Coolify dark ingress lacks HTTPS routers and a
  domain-covered certificate for `dongphugia.vn` and `www.dongphugia.vn`.
- `HUMAN-ONLY` - PM/DNS portal operator must later execute only the records
  explicitly approved at the DNS gate.
- `HUMAN-ONLY` - PM owns GO/NO-GO, production-data and DNS/traffic approval.
- `UNKNOWN` - Named backup DNS operator and availability must be re-confirmed.

## Ownership model

- Codex is the only technical execution context for the project.
- The active Codex thread may coordinate work, but only one writer may own each
  source, deployment, database, cloud or DNS resource at a time.
- PM/user owns business scope and all explicitly gated decisions.
- At thread end, ownership must be explicitly released or retained in a Codex
  closeout. Absence of a response is not proof that an owner stopped.

## Durable next action

At the next authorized release session, run the repository audit, verify the
latest PR/runtime state, then continue read-only DNS-zone evidence collection or
prepare a fresh data-gate package. Do not infer permission for production write
or DNS mutation from this context.

## Latest session closeout

- Task: replace the retired multi-assistant workflow with a Codex-only project
  context and mandatory cross-thread closeout.
- Branch/PR: `codex/orchestrator-handoff-cleanup`, draft PR #29. Verify its exact
  head and checks before review or merge.
- Result: root context, living context, session closeout and active-document
  ownership language prepared for review.
- Local caveat: the separate dirty root worktree still has an untracked local
  `AGENTS.md`; do not overwrite it. Resolve that collision only after PR #29 is
  merged and the two files have been compared.
- Mutation ownership: released after the documentation commit is pushed; no
  release, deployment, database, cloud or DNS resource was claimed.
- Next action: review and merge PR #29, then perform the separately authorized
  local `AGENTS.md` collision cleanup without touching other dirty files.

## Latest context transition

- The former multi-agent documentation model is retired.
- Root `AGENTS.md` is the canonical Codex instruction entry point.
- This file is the living cross-session state summary.
- `CODEX-SESSION-CLOSEOUT.md` is mandatory at the end of each project thread.
- Historical material remains under `docs/archive/` as non-authoritative
  provenance only.

## Dark-only ingress/TLS preparation refresh - 2026-08-01 23:17 Asia/Ho_Chi_Minh

- `FACT` - PM-authorized changes were limited to Coolify app
  `ydgt1mkagpitpq8shovd726z` (`dongphugia-web-production-dark`). The running
  image remains the exact immutable digest
  `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b`
  with source revision `090ff89c981f8c6b2d851bf99d7fb8572dacc4da`.
- `FACT` - The configuration save/redeploy sequence completed successfully;
  latest Coolify deployment is `uedctlreknzlgyh7ogvjph4p`, runtime container
  is `ydgt1mkagpitpq8shovd726z-161316206465`, health is `healthy`, and restart
  count is `0`. Earlier successful configuration deployments were
  `zufd6h8561kxolkpv6ga5yxf`, `lvklw7azumo4jdecc9sa6ftf` and
  `o2tvmkud0es2chkf06d4uevq`.
- `FACT` - Coolify saved a custom `apex-to-www` redirectregex middleware with
  `permanent=true` and readonly labels disabled. Runtime labels still contain
  the generated apex router with `redirect-to-https`; the generated router has
  precedence over the custom middleware. This is a configuration/runtime
  divergence, not a DNS result.
- `FACT` - Host-header validation from the EC2 host returned HTTP `302` for
  `www.dongphugia.vn` to its HTTPS URL and HTTP `302` for
  `dongphugia.vn` to `https://dongphugia.vn/...`; the required apex HTTP
  `308` to `https://www.dongphugia.vn/...` is therefore **not PASS**. Path and
  query were observed in the redirect, but the status is wrong. No DNS,
  nameserver, traffic or old-domain redirect mutation occurred.
- `FACT` - The final root and path/query probes returned HTTP `301` with
  `Location: https://www.dongphugia.vn/` and
  `Location: https://www.dongphugia.vn/_dark-validation/path?probe=1`,
  respectively. This confirms path/query preservation and no observed chain,
  but still fails the required `308` status.
- `FACT` - Internal HTTPS validation using `--resolve` reached the app: `/`
  returned `200`, `/sitemap.xml`, `/robots.txt`, `/admin/login`, and hero
  endpoints at widths `720` and `1280` returned `200`; homepage canonical,
  `og:url`, JSON-LD and `.vn` references were present. The six checked
  security headers were present. The synthetic `/_dark-validation` path is
  not an application route and returned `404` on `www` HTTPS.
- `FACT` - The current SNI certificate remains Traefik's default certificate
  (`CN=TRAEFIK DEFAULT CERT`) with only an internal generated SAN; it does not
  cover either `.vn` hostname. This is not TLS PASS. ACME/DNS-01 records were
  not created and no HTTP-01 attempt was made.
- `FACT` - Secret-safe runtime refresh proved target client metadata without
  exposing values: `DATABASE_URL` host `dpg-production-postgres`, port `5432`,
  `sslmode=verify-full`, client connection `ok`, server SSL `true`, TLS `1.3`
  and a cipher present. No database write was issued.
- `FACT` - Staging digest, PR #26, Vercel rollback baseline, Bunny evidence,
  backup/restore proof and DNS exports were not changed. The exact `.vn` and
  `.com.vn` zone records remain read-only evidence only.
- `GATE` - `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` remains `NO-GO`:
  no new PM-approved window, freeze, final copy or final delta exists.
- `GATE` - `DNS-SWITCH-APPROVAL-GATE` remains `NO-GO`: apex `308` and a
  domain-covered certificate are not yet proven. The next safe technical
  action is to reconcile the Coolify generated router precedence and prepare
  the exact ACME action; no DNS mutation is authorized.

## Dark apex router reconciliation - 2026-08-01 23:45 Asia/Ho_Chi_Minh

- `FACT` - Before this bounded attempt, deployment `uedctlreknzlgyh7ogvjph4p`
  was healthy on the exact approved digest/revision, with generated apex
  router middleware `redirect-to-https` and Caddy `caddy_1.redir` lacking an
  explicit status. This is the rollback configuration reference.
- `FACT` - Coolify deployments `fisp4s4wve7b3s83wlq688xe`,
  `g8fmibf4rusxv3h4anufveoq`, `o5446de3b36s4chxjugoirc9` and
  `etp64no66uz4latp52thr0bs` completed successfully without changing the
  image or source revision. Latest runtime container is
  `ydgt1mkagpitpq8shovd726z-164404708127`, healthy after startup, restart `0`.
- `FACT` - Coolify retained `priority=100` on the generated apex router and
  retained the custom `apex-to-www` middleware (`permanent=true`), but still
  emitted `middlewares=redirect-to-https`. A Caddy label entered as
  `caddy_1.redir=... 308` was emitted without the status suffix. The effective
  router therefore remains Coolify-managed rather than the requested custom
  permanent redirect.
- `FACT` - Final Host-header validation returned HTTP `301` from
  `dongphugia.vn` to `https://www.dongphugia.vn/_dark-validation/path?probe=1`
  and HTTP `302` from `www.dongphugia.vn` to its HTTPS URL. Path/query were
  preserved, but apex status `308` was not achieved. No source mutation, DNS
  mutation, canonical traffic switch or old-domain redirect occurred.
- `DECISION` - Router-only configuration has now been tested with the
  minimum reversible overrides; source editing is not authorized by this
  checkpoint and was not attempted. The remaining issue is Coolify-generated
  label precedence/normalization, not application behavior.
- `ACME PLAN` - Prefer DNS-01 because the new `.vn` names are not yet pointed
  at the target and HTTP-01 must not be probed before DNS. The eventual action
  is to obtain the ACME order, create TXT challenge record(s) under
  `_acme-challenge.dongphugia.vn` and, if requested by the CA, the equivalent
  `www` challenge name, with provisional TTL `300`; wait for authoritative
  propagation, issue a certificate covering apex and `www`, then remove only
  the challenge records. The CA-generated TXT values, order, timing and
  operator must be presented to PM/DNS operator at a separate approval. No
  order or TXT record was created in this phase. Renewal must remain under
  Coolify/Traefik ownership; rollback retains the last valid certificate and
  removes only pending challenge records.
- `GATE` - Both production-data write-freeze and DNS-switch gates remain
  `NO-GO`. The next PM package must call out the 308 router blocker and the
  exact DNS-01 operator action without exposing a challenge token.
