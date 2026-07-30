# DNS-SWITCH-APPROVAL-GATE

Status: **HOLD - approval package only**. No DNS, nameserver, production
redirect, canonical traffic, Vercel or production data mutation is authorized
by this file.

Evidence captured read-only on `2026-07-31` Asia/Ho_Chi_Minh
(`2026-07-30` UTC). Re-capture authoritative answers immediately before the
approved change.

## Current facts

| Host / zone | Current public answer | TTL / authority |
| --- | --- | --- |
| `dongphugia.vn` | no apex A/AAAA/CNAME answer observed | zone/SOA TTL `3600`; `ns1.matbao.com`, `ns2.matbao.com` |
| `www.dongphugia.vn` | no A/AAAA/CNAME answer observed | Mắt Bão zone |
| `dongphugia.com.vn` | A `216.198.79.1` | TTL `3600`; P.A Việt Nam zone |
| `www.dongphugia.com.vn` | CNAME `f67c116b40bea258.vercel-dns-017.com` | TTL `3600`; target currently resolves to Vercel |

Additional baseline facts:

- `https://dongphugia.com.vn/` currently redirects `307` to
  `https://www.dongphugia.com.vn/`.
- `https://www.dongphugia.com.vn/` currently returns `200`.
- the old zone has a Google Search Console verification TXT record; preserve it.
- Cloudflare is not authoritative for either observed zone.
- AWS target EIP recorded in the handoff is `47.131.92.97`.

## Proposed new-domain records

These values are a proposal for PM/Mắt Bão approval, not an instruction already
executed:

| Name | Type | Proposed value | Cutover TTL | Purpose |
| --- | --- | --- | --- | --- |
| `dongphugia.vn` (`@`) | A | `47.131.92.97` | `300` | reach Coolify, then application/proxy `308` to canonical `www` |
| `www.dongphugia.vn` | A | `47.131.92.97` | `300` | canonical AWS/Coolify application |

Keep the Mắt Bão nameservers unchanged. Do not add Cloudflare or combine a
nameserver migration with this cutover. Lower the relevant TTL from `3600` to
`300` in an approved preparation change, then wait at least the previous
`3600` seconds before the traffic change.

Mắt Bão operator responsibilities:

1. export/screenshot the complete `dongphugia.vn` zone before changes;
2. confirm the two names and absence of conflicting A/AAAA/CNAME records;
3. apply only the approved TTL preparation and, later, the approved A records;
4. preserve unrelated MX/TXT/CAA and nameserver records;
5. record authoritative answers and timestamps;
6. keep the exact rollback values ready.

## Old-domain redirect plan

Do not modify `dongphugia.com.vn` records during initial new-domain acceptance.
Keep apex and `www` on Vercel as the rollback baseline.

After PM accepts the new domain:

- configure the existing Vercel/old-domain application to issue one permanent
  `308` (or `301` only if separately approved) from both old hosts to
  `https://www.dongphugia.vn`, preserving path and query;
- change no old-domain DNS record unless the separately approved redirect
  implementation requires it;
- verify the old Search Console TXT record and email-related records remain;
- reject any plan that creates old apex -> old `www` -> new `www` chains.

## Rollback records

New-domain rollback before it accepts production writes:

- remove the new `@` A `47.131.92.97`;
- remove the new `www` A `47.131.92.97`;
- restore the pre-change state of no observed apex/`www` address record;
- keep old production/Vercel records untouched and verify old `www` returns
  `200`.

Old-domain redirect rollback:

- revert the approved Vercel redirect/configuration to the recorded production
  deployment;
- authoritative DNS remains the current apex A and `www` CNAME above unless a
  later approved plan changes them.

Rollback after AWS accepts writes is not DNS-only. Keep writes frozen and
follow the database reconciliation/rollback policy in the production runbook.

## Downtime expectation

- Existing production browsing downtime for the new-domain DNS activation:
  expected `0` because the old Vercel site remains active.
- New-domain availability may vary during DNS propagation and TLS issuance;
  do not enable old-domain redirects until external acceptance is complete.
- Production write downtime remains the runbook estimate of `30-60 minutes`
  until a production-sized migration rehearsal provides measured RTO/RPO.

## Evidence required for GO

- exact source revision, immutable image digest and GHCR evidence;
- exact digest deployed and accepted on staging;
- new-domain certificate/proxy configuration prepared without public DNS;
- canonical, sitemap, robots, Open Graph/schema and redirect tests pass;
- AWS host capacity, Security Group and health refreshed with valid access;
- PostgreSQL backup age/checksum, off-host copy, restore and reconciliation pass;
- production media inventory and Bunny compatibility/write decision complete;
- Vercel rollback deployment and full DNS zone exports recorded;
- Search Console, Analytics/GTM and SEO monitoring owners confirmed;
- application, database, Mắt Bão/P.A Việt Nam DNS, Vercel and on-call owners
  contain no `TBD`;
- PM approves the exact records, TTL, maintenance window, downtime and rollback.

Until every item is satisfied, the gate remains **HOLD** and no DNS switch may
occur.
