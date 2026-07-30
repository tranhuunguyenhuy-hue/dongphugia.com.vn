# SEO and domain migration plan

Status: preparation and approval evidence only. This document does not authorize
DNS, nameserver, Vercel, redirect, or production traffic changes.

## Approved target and migration boundary

- New canonical origin: `https://www.dongphugia.vn`.
- New apex: `https://dongphugia.vn`, with an HTTP `308` redirect to the
  corresponding URL on `https://www.dongphugia.vn`.
- Existing production remains `https://dongphugia.com.vn` on Vercel until the
  new domain and AWS/Coolify platform pass acceptance.
- The old apex and `www` host are redirected only after the new domain is
  accepted. Vercel and the old domain remain the rollback baseline throughout
  the observation window.

## URL mapping policy

The default mapping is one-to-one and must preserve both path and query string:

| Source | Destination | Activation |
| --- | --- | --- |
| `http://dongphugia.vn/:path*` | `https://www.dongphugia.vn/:path*` | new-domain release |
| `https://dongphugia.vn/:path*` | `https://www.dongphugia.vn/:path*` | new-domain release |
| `http://www.dongphugia.vn/:path*` | `https://www.dongphugia.vn/:path*` | new-domain release |
| `https://dongphugia.com.vn/:path*` | `https://www.dongphugia.vn/:path*` | only after new-domain acceptance |
| `https://www.dongphugia.com.vn/:path*` | `https://www.dongphugia.vn/:path*` | only after new-domain acceptance |

Use a single redirect hop. Before activation, test representative URLs with
plain paths, Vietnamese slugs, pagination/filter queries, UTM parameters and
unknown paths. Any intentional path exception must be listed explicitly; none
is currently approved.

## Source audit

Evidence from PR #26 source:

- `src/lib/site.ts` defaults canonical URLs to
  `https://www.dongphugia.vn` and normalizes all four old/new apex/`www`
  hostnames to that canonical host.
- metadata, Open Graph URLs, organization schema and sitemap routes use the
  canonical helper.
- `public/robots.txt` now advertises
  `https://www.dongphugia.vn/sitemap.xml`.
- Legal/public policy pages already link to `https://www.dongphugia.vn`.
- `cdn.dongphugia.com.vn` remains intentionally allowed for media
  compatibility. It is a media hostname, not a canonical page origin.

Open inventory items:

- the revalidation route documentation still references the legacy
  `admin.dongphugia.com.vn` and `www.dongphugia.com.vn` integration; confirm the
  real admin/revalidation caller and update its runtime endpoint before
  production unfreeze;
- the admin login placeholder and design-system contact example contain
  `dongphugia.com.vn` email addresses; PM must decide whether those mailboxes
  intentionally remain;
- complete the production database media-hostname inventory before removing
  the legacy Supabase/Bunny compatibility allowlist;
- inventory email templates, backlinks, ads, social profiles, business
  directories, QR codes and third-party webhooks outside this repository.

## Search and analytics preparation

Before old-domain redirects are enabled:

1. Verify Search Console access for both old hosts and a Domain property for
   `dongphugia.vn`. Keep the existing verification TXT record on the old zone.
2. Submit `https://www.dongphugia.vn/sitemap.xml` only after its public TLS,
   canonical and URL contents pass.
3. Use Search Console Change of Address only after the old-domain redirects are
   live and stable, if the verified property type supports it.
4. Confirm `NEXT_PUBLIC_GTM_ID` ownership and add the new apex/`www` hosts to
   Analytics/GTM referral, cross-domain and cookie policies as applicable.
5. Review cookie domain, CORS, CSRF/trusted origins, OAuth callbacks,
   revalidation endpoints and webhook allowlists for both the observation
   period and final state.
6. Keep annotations for the exact cutover timestamp in analytics and monitoring.

## Acceptance and observation

Pre-redirect acceptance:

- canonical and `og:url` use `https://www.dongphugia.vn`;
- sitemap index and every child URL use the new canonical host;
- robots references the new sitemap and does not block public routes;
- apex redirect is exactly one `308` hop and preserves path/query;
- no page creates a redirect loop or chain;
- representative old/new pages have matching content and HTTP status;
- structured data contains the new page origin;
- analytics events and revalidation/webhook calls reach the intended target;
- unknown URLs produce the approved `404` response.

Observe at least:

- `404` and `5xx` rate by host and path;
- redirect chains/loops and TLS errors;
- indexed and excluded URL counts;
- sitemap fetch/parse errors;
- organic sessions, landing pages and conversions;
- crawl activity, canonical selection and Change of Address status;
- legacy media failures and third-party integration failures.

The PM must set the observation-window duration and rollback thresholds. Do not
remove Vercel or the old domain at the end of a window without a separate
approval.
