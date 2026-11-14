import { Client } from 'pg'

const PUBLIC_PRODUCT = `p.is_active=true AND p.publication_status='public' AND p.pdp_visibility='public'
 AND p.id>0 AND p.name<>'' AND char_length(p.name)<=240 AND p.sku<>'' AND char_length(p.sku)<=120
 AND p.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 AND c.is_active=true AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 AND s.is_active=true AND s.category_id=c.id AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`
const FROM_PRODUCT = `FROM dpg_app.products p
 JOIN dpg_app.categories c ON c.id=p.category_id
 JOIN dpg_app.subcategories s ON s.id=p.subcategory_id`

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

const worker = {
  async fetch(request, env) {
    if (request.method !== 'GET' || new URL(request.url).pathname !== '/probe') {
      return new Response('Not found.', { status: 404 })
    }
    if (!env.PREFLIGHT_TOKEN || request.headers.get('authorization') !== `Bearer ${env.PREFLIGHT_TOKEN}`) {
      return new Response('Not found.', { status: 404 })
    }
    if (!env.PUBLIC_DB?.connectionString) return json({ status: 'FAIL', stage: 'binding' }, 503)

    const client = new Client({
      connectionString: env.PUBLIC_DB.connectionString,
      connectionTimeoutMillis: 3000,
      query_timeout: 5000,
    })
    let stage = 'connect'
    try {
      await client.connect()

      stage = 'identity'
      const identity = (await client.query(`SELECT current_user AS role,
        current_setting('transaction_read_only') AS read_only`)).rows[0]
      if (identity?.role !== 'dpg_public_catalogue' || identity.read_only !== 'on') {
        return json({ status: 'FAIL', stage }, 503)
      }

      stage = 'tls'
      const ssl = (await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0]?.ssl
      if (ssl !== true) return json({ status: 'FAIL', stage }, 503)

      stage = 'row-security'
      const rls = (await client.query("SELECT row_security_active('dpg_app.products'::regclass) AS active")).rows[0]?.active
      if (rls !== true) return json({ status: 'FAIL', stage }, 503)

      stage = 'allow-public-read'
      await client.query('SELECT id FROM dpg_app.products LIMIT 1')

      stage = 'deny-customer-read'
      let customerReadDenied = false
      try {
        await client.query('SELECT * FROM dpg_app.customers LIMIT 0')
      } catch (error) {
        customerReadDenied = error?.code === '42501'
      }
      if (!customerReadDenied) return json({ status: 'FAIL', stage }, 503)

      stage = 'deny-admin-read'
      let adminReadDenied = false
      try {
        await client.query('SELECT * FROM dpg_app.admin_users LIMIT 0')
      } catch (error) {
        adminReadDenied = error?.code === '42501'
      }
      if (!adminReadDenied) return json({ status: 'FAIL', stage }, 503)

      stage = 'catalogue-counts'
      const counts = (await client.query(`SELECT
        (SELECT count(p.id) ${FROM_PRODUCT} WHERE ${PUBLIC_PRODUCT})::int AS public_products,
        (SELECT count(p.id) ${FROM_PRODUCT} WHERE ${PUBLIC_PRODUCT}
          AND p.listing_visibility IN ('default','low_priority'))::int AS listing_products,
        (SELECT count(b.id) FROM dpg_app.blog_posts b
          JOIN dpg_app.blog_categories c ON c.id=b.category_id
          WHERE b.status='published' AND b.published_at IS NOT NULL AND c.is_active=true)::int AS published_blogs`)).rows[0]
      if (counts?.public_products !== 5964 || counts.listing_products !== 5362 || counts.published_blogs !== 10) {
        return json({ status: 'FAIL', stage }, 503)
      }

      stage = 'database-only-sku'
      const product = (await client.query(`SELECT p.sku FROM dpg_app.products p
        JOIN dpg_app.categories c ON c.id=p.category_id
        JOIN dpg_app.subcategories s ON s.id=p.subcategory_id
        WHERE ${PUBLIC_PRODUCT} AND p.listing_visibility IN ('default','low_priority')
          AND p.search_visibility='visible' AND p.sku=$1 LIMIT 1`, ['A-LFV-402S-1'])).rows[0]
      if (product?.sku !== 'A-LFV-402S-1') return json({ status: 'FAIL', stage }, 503)

      return json({
        status: 'PASS', role: identity.role, readOnly: true, tls: true, rowLevelSecurity: true,
        customerReadDenied, adminReadDenied, publicProducts: counts.public_products,
        listingProducts: counts.listing_products, publishedBlogs: counts.published_blogs,
        databaseOnlySku: product.sku,
      })
    } catch {
      // Deliberately omit Postgres/client errors; they may contain connection details.
      return json({ status: 'FAIL', stage }, 503)
    } finally {
      await client.end().catch(() => undefined)
    }
  },
}

export default worker
