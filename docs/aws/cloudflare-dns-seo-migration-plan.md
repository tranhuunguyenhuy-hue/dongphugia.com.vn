# Cloudflare, DNS, and SEO migration plan

Date: 2026-07-29

Status: Draft. No Cloudflare, Mắt Bão, or DNS mutation is approved by this document.

## Business goal

Move `https://www.dongphugia.vn` from the current Vercel Hobby production path to Cloudflare Free in front of the AWS EC2/Coolify origin without losing orders, search visibility, or rollback ability.

The migration must not turn every old URL into a homepage redirect. SEO equity depends on preserving canonical URLs and one-to-one redirects where routes change.

## Current known domain state

- Registrar/DNS currently at Mắt Bão.
- Current nameservers:
  - `ns1.matbao.com`
  - `ns2.matbao.com`
- Cloudflare Free requires full DNS setup with Cloudflare nameservers.
- Do not assume Cloudflare partial/CNAME setup is available on Free Plan.
- No production A/CNAME mutation has been approved.

## Ownership decision required

Before Cloudflare setup, PM/customer must decide:

| Question | Required decision |
|---|---|
| Who owns the Cloudflare account? | Customer-owned is preferred for long-term control |
| Who has MFA-enabled admin access? | At least customer owner plus implementation lead during migration |
| Who can change nameservers at Mắt Bão? | Named person online during go-live |
| Who owns Google Search Console? | Customer/project owner with verification access |
| Who can approve rollback? | Named PM/business contact |

## Customer handoff checklist

Request from customer before GO-PRODUCTION:

- Permission to add the domain to Cloudflare.
- Permission or live support to change nameservers at Mắt Bão.
- Screenshot/export of all current DNS records.
- MX/SPF/DKIM/DMARC records if email is used.
- Confirmation domain is not locked against nameserver changes.
- Current TTL values.
- Google Search Console access or delegated user.
- Go-live window and rollback contact.
- Confirmation old Vercel deployment can remain active for 7-14 days.

## Cloudflare setup checklist

Draft only, not yet executed:

1. Create or select Cloudflare account with MFA.
2. Add zone `dongphugia.vn`.
3. Import DNS records from Mắt Bão export.
4. Manually compare imported records against customer-provided DNS list.
5. Preserve email records exactly.
6. Set SSL/TLS mode to Full Strict after origin certificate is verified.
7. Enable Always Use HTTPS.
8. Set minimum TLS version after browser support review.
9. Configure cache rules:
   - Do not cache `/admin/*`.
   - Do not cache `/api/*`.
   - Do not cache authenticated/session responses.
   - Static assets may be cached aggressively.
10. Configure WAF/rate limiting within Cloudflare Free constraints.
11. Decide DNSSEC timing. Enable only when registrar support and rollback timing are clear.
12. Record Cloudflare nameservers for Mắt Bão handoff.

## DNS record draft

Final values depend on actual CloudFormation outputs after GO-STAGING.

| Host | Type | Value | Proxy | Notes |
|---|---|---|---|---|
| `www` | A | `<ElasticIpAddress>` | Proxied | Main production host after GO-PRODUCTION |
| `@` | A | `<ElasticIpAddress>` or redirect rule | Proxied | Depends on canonical host decision |
| `cdn` | CNAME | Bunny CDN target | Usually proxied off unless tested | Preserve current media behavior |
| email records | MX/TXT/CNAME | From Mắt Bão export | Per provider | Must not be lost |

Canonical host recommendation: `www.dongphugia.vn` as the primary host because the user explicitly named `https://www.dongphugia.vn` as the target. Apex should redirect to `www` unless PM decides otherwise.

## SEO migration checklist

### Before traffic switch

- Confirm canonical host in app config uses `https://www.dongphugia.vn`.
- Confirm generated canonicals for homepage, category, product, and blog pages.
- Confirm sitemap URLs use canonical host.
- Confirm robots.txt does not block production pages.
- Confirm structured data URLs use canonical host.
- Confirm Open Graph URLs/images are valid.
- Crawl staging/preview and capture:
  - status codes,
  - canonical tags,
  - noindex tags,
  - sitemap references,
  - obvious 404s.
- Prepare URL mapping for old routes that changed.
- Do not redirect all old product/category URLs to homepage.

### During go-live

- Keep Vercel old production live.
- Change nameservers only when PM/customer contact is online.
- Watch Cloudflare DNS propagation.
- Verify:
  - `http://www.dongphugia.vn` redirects to HTTPS.
  - `https://www.dongphugia.vn` returns the new site.
  - apex redirects consistently to canonical host.
  - product pages return 200.
  - category pages return 200.
  - blog pages return 200.
  - `/sitemap.xml` and sitemap index routes return 200.
  - `/robots.txt` returns expected content.
  - `/api/health` returns safe status.
  - admin path is not cached by Cloudflare.

### After go-live

- Verify Google Search Console property.
- Submit sitemap.
- Monitor 404s and soft-404s.
- Monitor indexed canonical host.
- Monitor traffic and conversion.
- Keep old Vercel deployment available for 7-14 days.
- Do not delete old DNS/hosting on same day.

## Rollback plan

Rollback triggers:

- Sustained 5xx on public pages.
- Checkout/order submission failure.
- TLS failure.
- Cloudflare cache serving admin/API incorrectly.
- Critical SEO misrouting.
- AWS instance instability.

Rollback options:

1. Change Cloudflare DNS record back to old Vercel target.
2. Disable proxy temporarily only if needed to isolate Cloudflare from origin behavior.
3. If nameserver migration causes unresolved DNS and cannot be corrected quickly, ask customer to revert nameservers at Mắt Bão.
4. Keep AWS stack intact for investigation; do not delete same day.

Rollback verification:

- Homepage returns old stable site.
- Product/category/blog URLs are reachable.
- Order or quote flow works on the rollback target.
- DNS records match rollback notes.

## Cloudflare cache safety rules

Never cache:

- `/admin/*`
- `/api/*`
- responses with cookies/session headers
- order submission routes
- quote submission routes
- revalidation endpoints

Candidate cache:

- Next.js static assets.
- Public images if served from stable CDN and already versioned.
- Public category/product/blog HTML only after app behavior and ISR/revalidation are verified.

## Open risks

- Cloudflare Free cannot use partial CNAME setup.
- Cloudflare IP-only origin restriction requires maintaining IP ranges or using a safer authenticated origin design.
- DNS/email records can be lost if Mắt Bão export is incomplete.
- Search Console Change of Address may not apply unless moving between verified domains; this migration is primarily host/infrastructure, not necessarily domain change.
- Single EC2 origin remains a single point of failure.

