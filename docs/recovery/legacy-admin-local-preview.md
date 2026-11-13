# Legacy Admin local preview

This source task exercises the existing `src/app/admin` UI against a dedicated,
loopback-only PostgreSQL database. It does not connect Admin to a hosted database
or publish any edit to the public Worker.

## Run the preview

Requirements are Node 24, the repository's locked npm dependencies, PostgreSQL
17 tools, the recovered public capture directory, and the installed Playwright
Chromium browser. Use a PostgreSQL cluster bound only to `127.0.0.1:55439`, with
its data directory under `/tmp` and named `dpg-legacy-admin-pg-*`. Create the
dedicated database once:

```sh
createdb -h 127.0.0.1 -p 55439 -U postgres dpg_legacy_admin_preview
```

From a clean, committed checkout, run:

```sh
DATABASE_URL='postgresql://postgres@127.0.0.1:55439/dpg_legacy_admin_preview?schema=public' \
DIRECT_URL='postgresql://postgres@127.0.0.1:55439/dpg_legacy_admin_preview?schema=public' \
DPG_LOCAL_POSTGRES_DATA_DIRECTORY='/tmp/dpg-legacy-admin-pg-20261113' \
npm run recovery:local-admin-preview -- \
  --local-only \
  --source=/absolute/path/to/validated-public-capture
```

The command checks the URL, connected server address, port, PostgreSQL major
version, database name, and actual server data directory before running
`prisma db push` or writing rows. It rejects a password, host other than
`127.0.0.1`, a forwarded database address, another port/database/schema, or a
data directory outside the disposable local path. It requires a clean Git
checkout and refuses local `.env*` files except the tracked `.env.example`.
The Next.js build and server receive only the local database URLs, a fresh
local `AUTH_SECRET`, loopback site URL, production-build settings, and the
local-only Production runtime marker paired with the explicit write-freeze
override required to test login/session writes in this disposable database;
provider credentials from the caller are not passed through. Browser requests
to all other origins are blocked.

The first run imports the proposed Public recovery snapshot and keeps its
explicit Product and Blog IDs. It stores a source identity, source ID, source
digest, and idempotency key for each Product and Blog post in
`local_recovery.import_ledger`. An exact replay verifies the imported rows and
does nothing; a partial ledger, changed source, or changed imported row stops
with a conflict. Explicit-ID sequences are advanced after the insert. No reset,
truncate, or delete of imported records is available. The script only removes
its own clearly marked local test fixtures after a prior interrupted run.

Each run generates a fresh `admin` and `sale_manager` password in memory,
hashes each with bcrypt, and never writes or prints plaintext credentials. The
browser uses them for the acceptance checks; the script removes their test
sessions afterward. It creates, edits, and removes one unpublished synthetic
Product and one unpublished synthetic Blog post. The recovered rows remain
unchanged. Orders and customers must stay empty.

## Full-catalogue local recovery preview

The full Admin catalogue rehearsal uses a separate database so it cannot
replace the earlier 5,223-row Public snapshot trial. The local full source
capture is kept outside Git at
`/tmp/dpg-legacy-admin-full-capture-20261113`; its manifest records 888
nonoverlapping pages, all 17,752 Product IDs, per-table row counts, identical
whole-table source digests before and after capture, and the still-proposed
source state. The source queries were separate read-only requests, not one
MVCC snapshot, and image/document bytes were not downloaded.

Create `dpg_legacy_admin_full_preview` on the already verified loopback-only
PostgreSQL 17 cluster, then run the production-built browser rehearsal with
both the existing Public capture (used to verify the preserved 5,223-ID
subset and recover Blog) and the full source capture:

```sh
createdb -h 127.0.0.1 -p 55439 -U postgres dpg_legacy_admin_full_preview

DATABASE_URL='postgresql://postgres@127.0.0.1:55439/dpg_legacy_admin_full_preview?schema=public' \
DIRECT_URL='postgresql://postgres@127.0.0.1:55439/dpg_legacy_admin_full_preview?schema=public' \
DPG_LOCAL_POSTGRES_DATA_DIRECTORY='/tmp/dpg-legacy-admin-pg-20261113' \
npm run recovery:local-admin-preview -- \
  --local-only \
  --source=/tmp/dpg-legacy-admin-capture-validated-20261113 \
  --full-source=/tmp/dpg-legacy-admin-full-capture-20261113
```

The full importer preserves explicit IDs and every captured source table that
has a matching legacy Prisma model, including the 2,016 variant groups,
descriptions, images, documents, specs, features, taxon and source mappings,
package rows, and product relationships. The generated `search_vector` is
omitted because it is a derived unsupported `tsvector`. It stores each source
row digest and idempotency key in a local ledger keyed by source table and ID.
Before a page is inserted or replay-checked, the importer verifies its exact
bytes against the digest captured during validation; a changed page aborts the
transaction. A no-op replay checks target row contents as well as ledger entries
and counts, and reports conflicts without overwriting changed rows. `updated_at`
and Blog `view_count` are mutable runtime metadata and are ignored for this
content comparison. `public` and
`private` remain source states; the Public 5,223-ID subset is checked against
the full set. The 10 recovered Blog posts are loaded from the verified local
archive. Orders and customers remain empty, and only fresh local synthetic
staff accounts are created for the browser checks.

This remains a local source and UI rehearsal. Both the Public source lock and
full-source manifest remain `PROPOSED_REVIEW_REQUIRED`; the checks do not
authorize hosted imports or expose local Admin edits to the Public Worker.

The local app serves at `http://127.0.0.1:3107` while checks run. The server
stops after the screenshots and checks complete; imported data persists in the
local PostgreSQL database. A JSON report lists the actual data counts, import
mode, browser results, local URL, and evidence directory. Screenshots are stored
outside the repository under `/tmp/dpg-legacy-admin-preview-YYYY-MM-DD/`.

## Acceptance covered

- Anonymous visits to Product and Blog routes redirect to the login form.
- Both synthetic accounts authenticate through the existing bcrypt/session
  path at 1440×1000 and 390×844.
- The admin sees the recovered Product list and all 10 restored Blog posts.
- The admin edits only the two synthetic local fixtures; Product and Blog
  changes persist through existing Admin server actions, then the fixtures are
  removed.
- `sale_manager` can read Products, cannot read Blog, and cannot update the
  synthetic Product. The route redirects and the denied server action leaves
  the Product row and audit count unchanged at both viewport sizes.
- `src/lib/admin-action-auth.test.ts` also exercises unauthenticated Product
  and Blog mutations and asserts that no database write runs.
- The launch sidebar shows only Products and Blog. The dashboard redirects to
  Products; deferred Orders, Customers, Quotes, Categories, PIM, Marketing,
  Partners, Projects, Staff, and Blog Tags routes return 404.

The Blog list received a small responsive layout correction because the first
mobile rendering squeezed the titles out of the available row width and hid
touch actions behind hover-only styling.

## Recovery limits

The source lock remains `PROPOSED_REVIEW_REQUIRED`. Local import and Admin
editing do not accept the captured snapshot as canonical production data. The
recovered source has 5,223 Products, 4 category slugs, 24 listing slugs, 59
brand slugs, and 10 published Blog bodies across 6 categories. The Public
projection does not supply numeric root-category, listing, or brand IDs; those
relationships are reconciled locally by their preserved slugs. Fifty-one
variant members in 17 groups lack source option axes and are not promoted into
new family relations. The 5,087 restored price fields are historical
provenance-controlled snapshots; 136 products have unknown price. Media URLs
are preserved, but the image/document bytes were not verified by this preview.

The Admin edit is private to this local database. Production Public reads fixed
catalogue and Blog snapshot assets from the existing Cloudflare Worker. A
versioned publisher that builds and validates a complete immutable snapshot
and atomically switches the Worker manifest is still required before Admin
edits can appear publicly.

## Shared Public/Admin data boundary

The Owner requires Public and the legacy Admin to use the same Cloudflare
infrastructure and canonical database. This source change does not select,
provision, or write a hosted target. The legacy Admin uses Next.js 16.3.3 on
Node 24 with Prisma 5.22 against PostgreSQL through `DATABASE_URL` and
`DIRECT_URL`; this repository has no configured Prisma adapter for Workers.
The Public Worker currently serves built catalogue and Blog snapshots rather
than querying that database, so Admin `revalidatePath` and `revalidateTag` do
not refresh Worker content. A controlled, reviewable snapshot publication step
is still needed to make Product or Blog edits public. This local rehearsal uses
only `dpg_legacy_admin_full_preview`; its edits are not hosted or published.
