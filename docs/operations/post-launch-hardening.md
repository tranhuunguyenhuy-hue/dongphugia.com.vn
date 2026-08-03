# Dongphugia post-launch hardening

## Current evidence

As of the last verified launch acceptance, AWS EC2/Coolify is the only public
writer, the exact ARM64 application digest is healthy with zero restarts, the
`.vn` DNS and TLS matrix passes, and `.com.vn` remains a reachable Vercel
rollback baseline with `WRITE_FREEZE_ACTIVE` on writes. This document describes
the deferred work; it does not authorize a DNS, Vercel, Coolify, database or
production-data mutation.

Current Release It! maturity is estimated at **8.5/10**. The missing points
are operational metrics/alerts, measured capacity, and repeatable release
verification. A fresh current-production Lighthouse baseline was measured,
but it is not a passing release gate: LCP exceeded 2500 ms on both the
homepage and the category listing. Older localhost Lighthouse output is not
accepted as evidence.

## Latest staging candidate evidence

The current exact staging candidate is
`ghcr.io/tranhuunguyenhuy-hue/dongphugia-web@sha256:73403c56bdc52d8c9d5a01081195de99f2a95945572fc520c292f511ec276046`, built from
`09cf5c2`. Workflow `30804874102` passed with one ARM64 manifest, SBOM and
provenance evidence, and zero HIGH/CRITICAL Trivy findings. Coolify staging
deployment `tvsrq1yc9hl56y89uretmqvi` was verified by SSM as healthy with zero
restarts.

The staging route matrix passed, including the canonical synthetic category,
subcategory and product detail routes. Read-only observation produced zero
failures over 20 requests with p95 `146 ms` and max `283 ms`; app and database
aggregate error matches were both zero. A staging Lighthouse sample (three
runs each on home and listing) measured homepage LCP `3409.969-3418.879 ms`
and listing LCP `3548.214-3590.596 ms`; LCP <=2500 ms and best-practices `0.95`
remain deferred/non-blocking. This candidate is not production-approved.

The legacy redirect inventory preparation now includes
`scripts/seo/build-legacy-url-inventory.mjs`. From the current static product
redirect map it produced a candidate set of `29,476` unique HTTPS URLs across
the two `.com.vn` web hosts (`14,738` map entries expanded to both hosts).
This is not the final reviewed inventory because Search Console and bounded
crawl exports have not yet been merged. The verifier was run only on a bounded
two-URL sample; it returned aggregate `SOURCE_STATUS_307`, so the exact legacy
one-hop `308` gate is intentionally still pending. The Bunny hostname is
excluded by design.

## 2-3 day execution order

### Day 1: observability and baseline

1. Review the clean hardening branch and confirm the source revision is an
   ancestor of the accepted application source.
2. Validate the CloudFormation template and the CloudWatch agent JSON. Apply
   only during a new PM-approved infrastructure window after confirming the
   existing EC2 instance profile has the reviewed least-privilege policy.
3. Confirm the SNS email subscription manually, then test one alarm in a
   non-production or approved bounded way.
4. Run five mobile and five desktop Lighthouse measurements against
   `https://www.dongphugia.vn` and retain only sanitized reports.

### Day 2: performance and capacity

1. Use the production Lighthouse workflow as a scheduled/manual gate. It is
   restricted to `.vn` HTTPS hosts and checks the indexable homepage and
   listing routes for LCP <= 2500 ms, performance >= 0.90, CLS <= 0.1, TBT <=
   200 ms, total bytes <= 2 MiB and DOM <= 1,500. The intentionally `noindex`
   search route is checked for HTTPS availability by `monitor:probe`, not by
   the strict SEO assertion.
2. Fix only bottlenecks shown by the trace: hero discovery, above-fold HTML/DOM,
   server cache behavior and render-blocking resources. The current candidate
   marks only the first visible product card image as eager/high-priority and
   keeps all other card images deferred. Keep Bunny URLs and canonical metadata
   unchanged.
3. Run `load/k6-readonly.js` against the exact staging candidate with synthetic
   data. Use the warm-up, steady, spike and bounded soak schedule in its README.
   No production write endpoint is in the script.

### Day 3: inventory and release readiness

1. Build the reviewed URL inventory from Search Console exports, the existing
   redirect map and a bounded crawl. Classify valid legacy content separately
   from spam/unknown URLs; do not redirect everything to the homepage.
2. Run the redirect safety verifier against the proposed mapping. It must show
   exactly one 308, preserved path/query, final `.vn` 200 and zero loops.
3. Rebuild only from an immutable digest after lint, typecheck, unit tests,
   homepage Playwright tests, Lighthouse and ARM64/SBOM/provenance checks pass.
4. Update the launch evidence and rollback references. Do not promote or
   deploy from the dirty repository root.

## Operating thresholds

- Availability: synthetic route failure on two consecutive checks is an
  incident trigger.
- HTTP errors: material 5xx above 1% is a stop/rollback trigger.
- Latency: route p95 above two seconds during the bounded read-only test is a
  capacity failure.
- Host: CPU above 80%, memory above 85% or root disk above 80% requires review;
  disk at 90% is critical.
- PostgreSQL: sustained connections above 70% of the configured ceiling is a
  capacity failure.
- Any restart, OOM, TLS failure, Bunny media failure, write-ownership drift or
  data mismatch is an immediate NO-GO.

## Secret and data rules

- No script in this package reads Secrets Manager values, application env,
  database URLs, request bodies or row data.
- Production load is read-only and requires a fresh PM window marker in
  addition to the explicit environment guard.
- Monitoring logs must contain aggregate events only. Never forward Docker
  environment files or raw request payloads to CloudWatch.
