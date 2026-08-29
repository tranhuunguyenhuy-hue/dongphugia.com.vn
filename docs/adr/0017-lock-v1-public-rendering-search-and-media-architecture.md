---
status: proposed
issue: LEO-558
verified: 2026-08-30
---

# Lock the V1 Public rendering, search, and media architecture

Dong Phu Gia V1 will use one Cloudflare Worker with Workers Static Assets for
the Public application, Supabase PostgreSQL as the canonical data authority,
and Bunny as the canonical media byte store and public media delivery origin.
Public catalogue and content HTML is rendered on demand and cached at the
Cloudflare edge for at most five minutes; it is not rebuilt into 10,000+
Product files. Search remains inside PostgreSQL through a dedicated projection,
Full Text Search, `unaccent`, and `pg_trgm`. This is the smallest design that
meets the approved SEO, freshness, cost, and scale constraints without reviving
the canceled LEO-545 static/shadow adapter.

This ADR is an architecture proposal for Owner review. It does not provision a
Worker, Pages project, Supabase object, Bunny zone, binding, credential, DNS
record, paid plan, Preview, or Production deployment.

## A. Recommended Public topology

```text
Visitor / crawler
      |
      v
Cloudflare zone
  |-- immutable Worker Static Assets: JS, CSS, fonts, fixed fallback assets
  |-- cached public HTML: 300-second hard freshness bound
  `-- Public Worker on a cache miss or dynamic request
          |-- narrow Public Read interface -> Supabase Data API/RPC
          |                                  -> canonical tables/read models
          |                                  -> search_documents projection
          |-- commerce write interface ------> separately authorized RPC/Edge seam
          `-- HTML contains Bunny delivery URLs; it does not proxy media bytes

Admin upload -> bounded Cloudflare Images transform -> Bunny private originals
                                                   -> Bunny public variants/docs
                                                   -> Supabase media references
```

Production uses **Workers, not Pages**, as the one Public runtime. Static assets
ship in the same immutable Worker artifact and do not need a second application
or deployment path. Pages may remain historical Preview evidence, but it is not
the New Production runtime. Cloudflare currently recommends `vinext` for
Next.js on Workers and documents App Router, SSR, static generation, Server
Actions, and ISR support. Because `vinext` is still beta, LEO-563 must run the
official compatibility check and a real Preview proof before adopting it. A
compatibility failure may use the documented OpenNext adapter without changing
the topology; it may not silently restore the static adapter.

The Public Worker calls a narrow read-only Data API/RPC interface. It does not
carry Prisma's direct-database coupling forward and never exposes a privileged
Supabase key to the browser. Static-first means immutable assets plus cached,
indexable server HTML. It does not mean one generated file per Product.

Generate ahead of time only:

- application code and content-hashed static assets;
- fixed error/fallback assets and the Preview noindex controls;
- a deployment manifest containing source, lockfile, artifact, configuration,
  and migration-manifest digests;
- optionally a small set of stable support/legal pages when their content is
  source-owned rather than Supabase-owned.

Render on demand and cache the result for catalogue/content pages, sitemap
index/shards, and all Product URLs. A deployment may prewarm a bounded set of
high-traffic routes, but prewarming is never an acceptance or release gate.

## B. Rendering decision by page type

| Approved page type | Rendering and cache contract |
| --- | --- |
| Homepage | Server-rendered on miss; public edge cache for 300 seconds. Static shell/assets are generated ahead. |
| Search | Server-rendered query page and JSON suggestion endpoint; `noindex,follow`; `no-store` for query-specific HTML/results. A bounded popular-suggestion response may use a 60-second public cache. |
| Category / Subcategory | Server-rendered on miss; public edge cache for 300 seconds; pagination/filter state uses a normalized allowlisted cache key or `no-store` until proven safe. |
| Brand index / Brand | Server-rendered on miss; public edge cache for 300 seconds. |
| PDP | Server-rendered on first request; public edge cache for 300 seconds. No build-time enumeration of every Product. Family remains PDP navigation/context, not a page. |
| Collection | Server-rendered on miss; public edge cache for 300 seconds. Collections are manual groups, not a rules engine. |
| Content hub/detail/Landing | Server-rendered on miss; public edge cache for 300 seconds. Content resolves canonical Product/Category/Brand references at read time. |
| Static support page | Build-time only when source-owned; otherwise the same 300-second content contract under `/ho-tro/{slug}`. |
| Wishlist / Cart / Quote Cart | Static application shell plus browser-local state; never cache a user's state at the shared edge. |
| Checkout / Quote Request | Static GET shell where possible; submissions are dynamic `no-store` writes through the approved commerce interface. |
| Order confirmation | Dynamic `no-store`; display only the just-created public-safe confirmation contract. |
| Shareable Quote | Dynamic `no-store`, `noindex,nofollow`; validate the public-safe token on every request and never put it in a shared cache. |

All indexable detail/listing responses must emit canonical metadata and the
approved structured-data projection from the same page model used for visible
facts. Search URLs, carts, checkout, confirmations, and shareable Quotes are
excluded from sitemaps.

## C. Cache and freshness contract

The **correctness mechanism is a hard 300-second TTL** on public Product,
Category, Brand, Collection, Content, Homepage, and sitemap responses. Browser
cache must not extend that bound. Do not use an unbounded stale cache, and do
not rely on invalidation for correctness. Cacheable responses are anonymous,
must not emit `Set-Cookie`, and key only on host, path, and explicitly
allowlisted functional query parameters; tracking parameters are excluded.

After a successful canonical publish transaction, the application makes a
best-effort Cloudflare purge-by-URL call for the exact affected route set:

| Change | Routes purged after commit |
| --- | --- |
| Product facts, price, or availability | PDP, primary Category/listing pages, Brand, affected Collections, Homepage if featured, and sitemap shard when visibility/slug changes |
| Category or Brand | Its index/detail/listing routes, affected navigation/Homepage, and sitemap routes; a slug change also emits the approved redirect mapping |
| Content publication | Detail, content hub/type listing, referenced landing routes, Homepage if featured, and sitemap shard |
| Collection membership | Collection and affected Homepage/listing surfaces |

Purge happens only after commit. A failed purge is logged and does not roll
back canonical data; the old response expires within five minutes. If the
Supabase read fails after cache expiry, commerce-bearing pages fail with a
controlled `503` rather than serving price or availability beyond the bound.
No publish operation may report success before canonical data and the search
projection commit together.

Acceptance must measure `published_at -> first uncached correct response` and
prove it is at most five minutes for Product, price/availability, taxonomy,
Content, Search, and sitemap changes. It must also inject purge failure and
prove TTL recovery.

## D. Search decision

Choose **Supabase/PostgreSQL FTS + `pg_trgm` + `unaccent` over a dedicated
`search_documents` projection** for V1.

The projection contains one public-search document per Product, Category, and
Brand, with entity type/id, canonical URL, display fields, normalized name,
model, SKU, Brand, approved aliases/common names, a weighted `tsvector`, and
publish/version timestamps. Product publication updates its document in the
same database transaction; Brand, Category, alias, or visibility changes
update all affected documents deterministically. A rebuild procedure and
source-vs-projection count/hash check are mandatory recovery controls.

Use these ranking stages, with bounded candidates and deterministic tie-breaks:

1. exact normalized SKU/model;
2. SKU/model/name prefix;
3. weighted FTS over name, model, SKU, Brand, and aliases using the `simple`
   dictionary after lowercasing and accent normalization;
4. trigram similarity fallback for typo tolerance;
5. editorial popularity and deterministic entity/name/id tie-breaks.

Use GIN indexes for the stored `tsvector` and trigram-searchable normalized
text. Autocomplete returns a bounded mixed list of Product, Category, and Brand
suggestions. Recent searches stay browser-local. Popular searches use a
rate-limited, narrow server endpoint and a privacy-safe aggregate; do not store
IP addresses or other PII in the search projection. The browser never queries
projection tables directly; it calls one versioned search RPC/interface with
query length, result, timeout, and ranking limits.

| Option | V1 decision | Reason |
| --- | --- | --- |
| Existing Prisma `contains` query | Deprecate | Searches only Product name/SKU; no Brand, aliases, entity suggestions, typo handling, useful ranking, or projection freshness contract. |
| PostgreSQL projection + FTS/trigram | Select | One canonical database, transactional freshness, no sync pipeline, available Supabase extensions, and reasonable scale for 10,000+ Products. |
| PGroonga | Hold as measured fallback | Better multilingual tooling is not justified before Vietnamese relevance/latency tests show FTS/trigram cannot pass. |
| Algolia/Typesense/Meilisearch or vectors | Post-V1 / Owner gate | Adds cost or an operated cluster plus indexing synchronization. Semantic/vector search is explicitly not a launch blocker. |

LEO-568 must test typo/alias/model/SKU Vietnamese fixtures, p50/p95 latency,
query plans, index/database size, zero-result rate, and projection freshness
before an external search service may be proposed.

## E. Media responsibility matrix

| Responsibility | Supabase | Bunny | Cloudflare |
| --- | --- | --- | --- |
| Original uploaded bytes | Stores immutable key, SHA-256, MIME, dimensions, provenance, state; not bytes | Private Source Storage is byte authority | Validates and transforms a bounded upload; keeps no authoritative copy |
| Primary image/gallery | Owns ordered Product references and alt/editorial metadata | Stores immutable public variants | Renders references in HTML only |
| Technical PDFs/docs | Owns typed reference, title, checksum, visibility | Stores immutable public document object and delivers it | Does not transform; HTML only links to the Bunny URL |
| Public delivery URL | Stores canonical Bunny object key/profile version, not arbitrary external URLs | Pull Zone/custom hostname is the only public media origin | Allowlist/CSP only; no competing media hostname or proxy |
| Image resize/format | Stores locked profile/version | Stores generated immutable variants | Images binding is a stateless upload-time processor, not storage or runtime source of truth |
| Media cache | No byte cache | Pull Zone owns byte caching and purge | Page cache may contain Bunny URLs; it does not cache/proxy Bunny bytes |
| Deletion | Owns reference/unpublish/tombstone state and exact object inventory | Deletes only explicitly owned exact keys, then purges delivery cache | Does not delete Bunny media |
| Validation | Enforces references, purpose, checksum, dimensions, profile, primary/gallery invariants | Confirms exact stored bytes/metadata and delivery response | Enforces bounded size/type/signature/decoded dimensions and locked output profiles |
| Failure/fallback | Does not publish incomplete media state | Existing immutable objects remain; ambiguous writes are reconciled before retry/delete | Transform failure publishes nothing; Public UI uses a checked-in local placeholder and stable dimensions |

Use two logical Bunny areas: private immutable originals and public immutable
delivery variants/documents. The exact existing/new Storage Zone, region, Pull
Zone, hostname, credential scope, lifecycle, and recovery choice belongs to
LEO-565 and remains an Owner gate before any external mutation. Object keys are
content-addressed and profile-versioned; replacement creates new keys and then
atomically changes Supabase references. Never overwrite a public object in
place and never delete by prefix.

Carry forward LEO-544's bounded-stream, MIME-signature, decoder-derived
dimension, checksum, content-addressed path, exact-host allowlist, bounded
retry, ambiguous-write, and secret-safe logging concepts. Do not carry forward
its Preview-only hard-coded target or activate its Worker. The V1 transform
profile must be smaller and Product/Content-purpose-specific rather than
blindly inheriting seven Blog variants.

Cloudflare Images Free permits 5,000 unique transformations per month. The V1
runtime must fail closed when that allowance is exhausted; it must not enable
billing automatically. Initial 10,000+ Product migration uses an offline,
deterministic processor with the same profile and uploads resulting immutable
objects to Bunny. Crossing the Images allowance or choosing Bunny Optimizer
requires a separate exact Owner cost decision.

## F. Preview / Production contract

Preserve these controls while replacing the LEO-545 adapter itself:

- one immutable candidate tuple: source commit, lockfile digest, build command
  and tool versions, Worker artifact SHA-256, configuration-manifest digest,
  migration-manifest digest, and Cloudflare Worker version/deployment ID;
- separate Preview and Production Worker identities, bindings, Supabase targets,
  Bunny targets, secrets, hostnames, and deployment gates;
- Preview uses only an already approved non-Production project/environment,
  has no Production custom domain, uses synthetic/non-Production data and media,
  and may not obtain Production credentials;
- every Preview HTML document includes `noindex,nofollow`, every response has
  `X-Robots-Tag: noindex, nofollow`, and Preview `robots.txt` has `Disallow: /`;
- CI verifies the exact downloaded artifact and target identity before deploy,
  then verifies the deployed HTTPS response, headers, robots, canonical-host
  isolation, and artifact/version evidence;
- missing target, binding, credential, or enablement is
  `BLOCKED_BY_OWNER_GATE`; automation never creates a substitute resource;
- merge and Production promotion remain separate gates. Production promotion
  is disabled by default and requires explicit approval for the exact candidate
  and target. Rollback selects a separately validated prior immutable candidate.

## G. Free-tier constraints and growth exits

These are current provider facts verified on 2026-08-30 and must be rechecked
immediately before implementation or activation:

| Platform | Current constraint | Growth/failure action |
| --- | --- | --- |
| Cloudflare Workers Free | 100,000 Worker requests/day, 10 ms CPU/request, 128 MB memory, 50 subrequests/request, 3 MB compressed Worker, 20,000 Static Asset files/version, 25 MiB/asset. Static-asset requests are free/unlimited; Worker/SSR requests use the Worker quota. | LEO-563 profiles real SSR and bundle size. First optimize rendering/cache and materialize only stable hot pages. If still insufficient, stop for Owner approval of Workers Paid (currently minimum USD 5/month). |
| Cloudflare Images Free | 5,000 unique transformations/month; new transformations fail with error `9422` after the allowance, while cached existing transformations continue. | Keep profiles bounded, monitor usage, process initial import offline. Paid transformations are currently USD 0.50/1,000 beyond the included 5,000 and require Owner approval. |
| Supabase Free | Two active Free projects; 500 MB database per project; exceeding it makes the database read-only; 5 GB uncached plus 5 GB cached egress; inactive Free projects may pause after about seven days; no included automatic backups. | Track total database plus search-index headroom and egress. Preserve encrypted backup/isolated restore. Any paid plan, extra project, or capacity crossing is an Owner gate. |
| Bunny | Not free: USD 1/month account minimum with active zones. Standard HDD storage starts at USD 0.01/GB/region; Standard CDN traffic in Asia/Oceania is USD 0.03/GB. Bunny Optimizer is USD 9.50/Pull Zone/month plus bandwidth and is not selected. | Use one approved account and the minimum reviewed regions/zones, enable spend protection, and monitor storage/traffic. New zones, regions, Optimizer, or a changed paid commitment require exact Owner approval. |

Official evidence: [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/),
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/),
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/),
[Supabase pricing](https://supabase.com/pricing),
[Supabase database-size behavior](https://supabase.com/docs/guides/platform/database-size),
[Supabase FTS](https://supabase.com/docs/guides/database/full-text-search),
[Supabase extensions](https://supabase.com/docs/guides/database/extensions),
[Bunny CDN pricing](https://bunny.net/pricing/cdn/), and
[Bunny Storage pricing](https://bunny.net/pricing/storage/).

## H. Reuse / Refactor / Deprecate

**Reuse:** Product/Family/public-price/visibility contracts; canonical URL and
SEO/schema/sitemap test knowledge; managed-media validation concepts;
content-addressed immutable objects; exact-candidate identity; all-document
Preview noindex; fail-closed target lookup; encrypted backup/isolated restore.

**Refactor:** Product, Brand, Category, Collection, Content, media/doc metadata,
and SEO utilities behind narrow Supabase-backed Public Read and Managed Media
interfaces. Convert existing cache tags/TTLs into the fixed five-minute public
contract. Adapt candidate evidence from Pages/static output to the Worker plus
Static Assets artifact.

**Deprecate as New Production authority:** legacy route/UI/Admin composition;
root `force-dynamic` rendering; Node standalone/Prisma direct coupling; legacy
30-minute to six-hour catalogue TTLs; substring-only Search; legacy image/upload
routes and arbitrary external media allowlists; the LEO-545 static/shadow
adapter; prebuilding every PDP; Pages as the Production runtime; dual Bunny and
Cloudflare media origins; runtime Bunny Optimizer; semantic/vector Search.

## I. Constraints for LEO-563, LEO-565, and LEO-568

**LEO-563 — Public/Admin app and CI/Preview foundation**

- Implement the Public Worker + Static Assets topology and keep Admin separate.
- `vinext` remains beta: it must pass the official compatibility check before
  adoption.
- Measure representative server-rendered cache-miss routes against every
  applicable Workers Free limit, including the 10 ms CPU/request limit, as well
  as bundle size, subrequests, Supabase connectivity, SSR metadata,
  cache-hit/miss, and 300-second freshness in Preview.
- A Free-limit failure must first optimize rendering/cache and re-measure. It
  must not silently enable Workers Paid; if Paid remains required, stop before
  mutation and return an explicit Owner cost gate with the measured shortfall.
- If `vinext` fails, prove OpenNext against the same interface/topology; do not
  restore LEO-545 or broaden into catalogue/search implementation.
- Port immutable-candidate and triple-noindex controls to isolated Worker
  Preview. Do not create missing Cloudflare resources or enable Production.

**LEO-565 — Bunny media/cache/delivery/recovery baseline**

- Establish the exact private-original and public-delivery targets only after
  Owner attests account, zones, regions, Pull Zone, hostname, price, credential
  scope, and recovery.
- Implement one Managed Media interface, content-addressed immutable keys,
  locked versioned profiles, exact-key deletion, reconciliation, placeholder,
  and backup/recovery evidence.
- Cloudflare transforms; Bunny stores/delivers; Supabase owns references. No
  second public media origin and no implicit Images/Bunny paid upgrade.

**LEO-568 — core Search and autocomplete**

- Implement the PostgreSQL projection and one versioned Search interface/RPC;
  do not query raw catalogue tables from the browser.
- Prove transactionally updated 1–5 minute freshness, projection rebuild/drift
  recovery, Vietnamese exact/prefix/alias/typo relevance, Category/Brand/Product
  suggestions, local recent searches, privacy-safe popularity, and p95 plans.
- Record database/index bytes against the Free guard. An external engine or
  vectors requires measured failure plus a new Owner cost/operations decision.

## Consequences

The first request after an edge miss performs server rendering and a Supabase
read, so LEO-563 must measure Worker CPU and origin latency. The five-minute TTL
is intentionally less aggressive than an event-heavy global invalidation
system: URL purge improves freshness, while TTL remains the failure-safe bound.
Search relevance becomes a tested data/index concern rather than a separate
distributed service. Bunny remains the one media authority, but its unavoidable
minimum charge and every future paid capacity increase remain visible Owner
gates.
