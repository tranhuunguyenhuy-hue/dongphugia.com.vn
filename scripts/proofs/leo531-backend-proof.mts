import { performance } from 'node:perf_hooks'
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
if (process.env.LEO531_ALLOW_DISPOSABLE_WRITE !== 'true') {
  throw new Error('LEO531_ALLOW_DISPOSABLE_WRITE=true is required')
}
const parsedDatabaseUrl = new URL(databaseUrl)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsedDatabaseUrl.hostname)) {
  throw new Error('Backend proof requires a loopback PostgreSQL target')
}
if (decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, '')) !== 'leo531_runtime') {
  throw new Error('Backend proof requires the exact leo531_runtime database')
}

const first = new Client({ connectionString: databaseUrl })
const second = new Client({ connectionString: databaseUrl })
await Promise.all([first.connect(), second.connect()])

try {
  const target = (await first.query<{ database: string }>(
    'SELECT current_database() AS database',
  )).rows[0]
  if (target.database !== 'leo531_runtime') {
    throw new Error('Connected PostgreSQL target is not the attested disposable database')
  }
  const inventory = (await first.query<{
    publishing_tables: number
    publishing_policies: number
    idempotency_unique: number
    admin_tables: number
    commerce_tables: number
  }>(`
    SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'publishing_%') AS publishing_tables,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public' AND (tablename LIKE 'publishing_%' OR policyname LIKE 'publishing_%')) AS publishing_policies,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public' AND tablename='publishing_idempotency_records' AND indexdef ILIKE '%UNIQUE%identity_id%key_hash%') AS idempotency_unique,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tablename IN ('admin_users','admin_sessions')) AS admin_tables,
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public' AND tablename IN ('orders','order_items','quote_requests','quote_items')) AS commerce_tables
  `)).rows[0]

  await first.query('BEGIN')
  await second.query('BEGIN')
  await first.query("SELECT pg_advisory_xact_lock(hashtextextended('publishing.global-gate', 0))")
  const blockedWhileHeld = (await second.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(hashtextextended('publishing.global-gate', 0)) AS locked")).rows[0].locked === false
  await first.query('COMMIT')
  const acquiredAfterRelease = (await second.query<{ locked: boolean }>("SELECT pg_try_advisory_xact_lock(hashtextextended('publishing.global-gate', 0)) AS locked")).rows[0].locked === true
  await second.query('ROLLBACK')

  const searchStarted = performance.now()
  const search = await first.query(`
    SELECT p.id, p.slug
    FROM products p
    WHERE p.is_active=true AND p.stock_status <> 'discontinued'
      AND p.sellable_status='sellable' AND p.publication_status='public'
      AND p.pdp_visibility='public' AND p.search_visibility='visible'
      AND (p.name ILIKE $1 OR p.sku ILIKE $1)
    ORDER BY p.created_at DESC LIMIT 8
  `, ['%toto%'])
  const searchDurationMs = Math.round((performance.now() - searchStarted) * 100) / 100

  const identityId = (await first.query<{ id: string }>('SELECT id FROM publishing_machine_identities ORDER BY id LIMIT 1')).rows[0]?.id
  let idempotencyConflict = false
  if (identityId) {
    await first.query('BEGIN')
    const keyHash = randomUUID().replaceAll('-', '')
    const requestHash = randomUUID().replaceAll('-', '')
    await first.query(`
      INSERT INTO publishing_idempotency_records
        (id, identity_id, key_hash, request_hash, operation, expires_at)
      VALUES ($1, $2, $3, $4, 'leo531-proof', now() + interval '5 minutes')
    `, [randomUUID(), identityId, keyHash, requestHash])
    try {
      await first.query(`
        INSERT INTO publishing_idempotency_records
          (id, identity_id, key_hash, request_hash, operation, expires_at)
        VALUES ($1, $2, $3, $4, 'leo531-proof', now() + interval '5 minutes')
      `, [randomUUID(), identityId, keyHash, requestHash])
    } catch (error) {
      idempotencyConflict = (error as { code?: string }).code === '23505'
    }
    await first.query('ROLLBACK')
  }

  const due = (await first.query<{ count: string }>(`
    SELECT count(*) FROM blog_posts
    WHERE status='scheduled' AND publishing_identity_id IS NOT NULL AND scheduled_for <= now()
  `)).rows[0].count

  process.stdout.write(`${JSON.stringify({
    inventory,
    advisoryLock: { blockedWhileHeld, acquiredAfterRelease },
    idempotency: { identityPresent: Boolean(identityId), duplicateRejected: idempotencyConflict },
    search: { representativeRows: search.rowCount, durationMs: searchDurationMs },
    scheduler: { duePostsInSnapshot: Number(due), currentFrequencyTarget: 'every minute' },
    workloadDisposition: {
      adminAuth: 'rewrite adapter; preserve hashed sessions and role ordering or explicitly migrate auth contract',
      adminCrud: 'Edge Function/RPC transactions',
      productContentWrites: 'Edge Function/RPC transactions with write-freeze gate',
      ordersQuotes: 'Edge Function/RPC transactions; add durable idempotency for public POSTs',
      searchFilter: 'read-only Edge Function or RPC',
      publishingApi: 'Edge Function/RPC preserving bearer auth, capabilities, audit and response contracts',
      publishingIdempotency: 'Postgres unique key plus transaction',
      transactionLocks: 'Postgres advisory transaction locks preserved',
      scheduler: 'Supabase Cron every minute invoking SQL or Edge Function',
      publicRefresh: 'GitHub/Cloudflare build hook; end-to-end latency remains unmeasured',
    },
  })}\n`)
} finally {
  await Promise.all([first.end(), second.end()])
}
