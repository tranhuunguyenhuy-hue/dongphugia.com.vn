import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const args = process.argv.slice(2)
const brand = readArg('--brand=', 'caesar')
const subcategory = readArg('--subcategory=', 'bon-cau')
const source = readArg('--source=', `hita-sample-${brand}-${subcategory}`)
const sampleDir = readArg('--sample-dir=', path.resolve(process.cwd(), `scripts/crawl-hita/output/${brand}/sample-${subcategory}`))
const uploadBunny = args.includes('--upload-bunny')

const normalizedFile = path.join(sampleDir, 'sample-products.normalized.json')
const qaDiffFile = path.join(sampleDir, 'qa-diff.json')
const manifestFile = path.join(sampleDir, 'image-migration-manifest.json')
const reportFile = path.join(sampleDir, 'sample-report.md')

const bunnyKey = process.env.BUNNY_STORAGE_API_KEY || ''
const bunnyZone = process.env.BUNNY_STORAGE_ZONE_NAME || ''
const bunnyHostname = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com'
const bunnyCdn = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn'

type SampleProduct = {
  sku: string
  name: string
  source_url?: string | null
  price?: number | null
  original_price?: number | null
  online_discount_amount?: number | null
  price_display?: string | null
  description?: string | null
  description_raw_html?: string | null
  specs?: Record<string, unknown>
  product_images?: Array<{ url?: string; sort_order?: number; alt?: string }>
  image_main_url?: string | null
  subcategory_id?: string | null
  product_type?: string | null
}

type DbProduct = {
  id: number
  sku: string
  name: string
  price: string | null
  original_price: string | null
  online_discount_amount: string | null
  price_display: string | null
  description_length: number
  specs_count: number
  spec_rows: number
  document_rows: number
  image_rows: number
  hita_image_rows: number
  bunny_image_rows: number
  source_url: string | null
  image_main_url: string | null
  is_active: boolean
  subcategory_slug: string | null
  product_type: string | null
}

function readArg(prefix: string, fallback: string) {
  const arg = args.find(item => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function hasHtmlImage(value: string | null | undefined) {
  return /<img\b/i.test(value || '')
}

function isHitaUrl(value: string | null | undefined) {
  return Boolean(value && /https?:\/\/(?:cdn\.)?hita\.com\.vn/i.test(value))
}

function fileExtFromUrl(url: string, contentType = '') {
  const pathname = new URL(url).pathname
  const ext = path.extname(pathname).replace(/[^.\w]/g, '').toLowerCase()
  if (ext && ext.length <= 6) return ext
  if (/webp/i.test(contentType)) return '.webp'
  if (/png/i.test(contentType)) return '.png'
  if (/gif/i.test(contentType)) return '.gif'
  return '.jpg'
}

function targetBunnyUrl(sourceUrl: string) {
  const url = new URL(sourceUrl)
  const basename = path.basename(url.pathname).replace(/[^a-zA-Z0-9._-]/g, '-') || 'image.jpg'
  const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 12)
  const ext = path.extname(basename) ? '' : '.jpg'
  return `https://${bunnyCdn}/migrated/sample/${brand}/${subcategory}/${hash}-${basename}${ext}`
}

function storageUrlFromCdn(cdnUrl: string) {
  const pathname = new URL(cdnUrl).pathname.replace(/^\/+/, '')
  return `https://${bunnyHostname}/${bunnyZone}/${pathname}`
}

async function uploadAndVerify(entry: { source_url: string; bunny_url: string }) {
  if (!bunnyKey || !bunnyZone) {
    return { uploaded: false, verified: false, status: 0, content_type: null, error: 'missing_bunny_env' }
  }

  try {
    const source = await fetch(entry.source_url)
    if (!source.ok) throw new Error(`source_fetch_${source.status}`)
    const contentType = source.headers.get('content-type') || 'application/octet-stream'
    const buffer = await source.arrayBuffer()
    const finalBunnyUrl = entry.bunny_url.replace(/(\.[a-z0-9]+)?$/i, fileExtFromUrl(entry.source_url, contentType))
    const upload = await fetch(storageUrlFromCdn(finalBunnyUrl), {
      method: 'PUT',
      headers: {
        AccessKey: bunnyKey,
        'Content-Type': contentType,
      },
      body: buffer,
    })
    if (!upload.ok) throw new Error(`bunny_upload_${upload.status}`)

    const head = await fetch(finalBunnyUrl, { method: 'HEAD' })
    const verified = head.ok
    return {
      uploaded: true,
      verified,
      status: head.status,
      content_type: head.headers.get('content-type'),
      bunny_url: finalBunnyUrl,
      error: null,
    }
  } catch (error) {
    return {
      uploaded: false,
      verified: false,
      status: 0,
      content_type: null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function extractDescriptionImageUrls(product: SampleProduct) {
  const html = product.description || ''
  return [...html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(Boolean)
}

function collectImageManifest(products: SampleProduct[]) {
  const rows: Array<{
    sku: string
    use: string
    source_url: string
    bunny_url: string
    upload?: unknown
  }> = []

  for (const product of products) {
    if (isHitaUrl(product.image_main_url)) {
      rows.push({
        sku: product.sku,
        use: 'image_main_url',
        source_url: product.image_main_url as string,
        bunny_url: targetBunnyUrl(product.image_main_url as string),
      })
    }
    for (const image of product.product_images || []) {
      if (!isHitaUrl(image.url)) continue
      rows.push({
        sku: product.sku,
        use: `product_images[${image.sort_order ?? ''}]`,
        source_url: image.url as string,
        bunny_url: targetBunnyUrl(image.url as string),
      })
    }
    for (const url of extractDescriptionImageUrls(product)) {
      if (!isHitaUrl(url)) continue
      rows.push({
        sku: product.sku,
        use: 'description_html',
        source_url: url,
        bunny_url: targetBunnyUrl(url),
      })
    }
  }

  const deduped = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    if (!deduped.has(row.source_url)) deduped.set(row.source_url, row)
  }
  return [...deduped.values()]
}

async function fetchDbProducts(skus: string[]) {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    const { rows } = await client.query<DbProduct>(
      `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.price::text,
        p.original_price::text,
        p.online_discount_amount::text,
        p.price_display,
        length(coalesce(p.description, ''))::int AS description_length,
        (SELECT count(*)::int FROM jsonb_object_keys(coalesce(p.specs::jsonb, '{}'::jsonb))) AS specs_count,
        (SELECT count(*)::int FROM product_spec_values v WHERE v.product_id = p.id) AS spec_rows,
        (SELECT count(*)::int FROM product_documents d WHERE d.product_id = p.id) AS document_rows,
        (SELECT count(*)::int FROM product_images i WHERE i.product_id = p.id) AS image_rows,
        (SELECT count(*)::int FROM product_images i WHERE i.product_id = p.id AND i.image_url ILIKE '%cdn.hita.com.vn%') AS hita_image_rows,
        (SELECT count(*)::int FROM product_images i WHERE i.product_id = p.id AND i.image_url ILIKE '%cdn.dongphugia.com.vn%') AS bunny_image_rows,
        p.source_url,
        p.image_main_url,
        p.is_active,
        s.slug AS subcategory_slug,
        p.product_type
      FROM products p
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE p.sku = ANY($1::text[])
      ORDER BY p.sku
      `,
      [skus]
    )
    return new Map(rows.map(row => [row.sku, row]))
  } finally {
    await client.end()
  }
}

function buildDiff(products: SampleProduct[], dbBySku: Map<string, DbProduct>) {
  return products.map(product => {
    const db = dbBySku.get(product.sku)
    const sampleSpecCount = Object.keys(product.specs || {})
      .filter(key => !['documents', 'Phụ kiện đi kèm', 'technologies'].includes(key)).length
    const sampleDocuments = Array.isArray(product.specs?.documents) ? product.specs.documents.length : 0
    const sampleImages = product.product_images?.length || 0
    return {
      sku: product.sku,
      name: product.name,
      exists_in_db: Boolean(db),
      is_active_current: db?.is_active ?? null,
      subcategory_current: db?.subcategory_slug ?? null,
      subcategory_sample: product.subcategory_id ?? null,
      product_type_current: db?.product_type ?? null,
      product_type_sample: product.product_type ?? null,
      price: {
        db: numberOrNull(db?.price),
        sample: numberOrNull(product.price),
        changed: numberOrNull(db?.price) !== numberOrNull(product.price),
      },
      original_price: {
        db: numberOrNull(db?.original_price),
        sample: numberOrNull(product.original_price),
        changed: numberOrNull(db?.original_price) !== numberOrNull(product.original_price),
      },
      online_discount_amount: {
        db: numberOrNull(db?.online_discount_amount),
        sample: numberOrNull(product.online_discount_amount),
        changed: numberOrNull(db?.online_discount_amount) !== numberOrNull(product.online_discount_amount),
      },
      price_display: {
        db: db?.price_display ?? null,
        sample: product.price_display ?? null,
        changed: (db?.price_display ?? null) !== (product.price_display ?? null),
      },
      specs: {
        db_json_keys: db?.specs_count ?? null,
        db_normalized_rows: db?.spec_rows ?? null,
        sample_json_keys: sampleSpecCount,
        changed_or_enriched: sampleSpecCount > 0 && sampleSpecCount !== (db?.specs_count ?? 0),
      },
      description: {
        db_length: db?.description_length ?? null,
        sample_length: product.description?.length || 0,
        sample_has_img: hasHtmlImage(product.description),
      },
      images: {
        db_rows: db?.image_rows ?? null,
        db_hita_rows: db?.hita_image_rows ?? null,
        db_bunny_rows: db?.bunny_image_rows ?? null,
        sample_rows: sampleImages,
        sample_hita_rows: (product.product_images || []).filter(image => isHitaUrl(image.url)).length,
      },
      documents: {
        db_rows: db?.document_rows ?? null,
        sample_rows: sampleDocuments,
      },
      source_url: {
        db: db?.source_url ?? null,
        sample: product.source_url ?? null,
        changed: (db?.source_url ?? null) !== (product.source_url ?? null),
      },
      guardrail: {
        preserve_is_active_on_import: db?.is_active ?? false,
        do_not_import_in_sample: true,
      },
    }
  })
}

function buildMarkdownReport(diff: ReturnType<typeof buildDiff>, manifest: ReturnType<typeof collectImageManifest>, sourceRun: unknown) {
  const sampleCount = diff.length
  const missingDb = diff.filter(item => !item.exists_in_db).length
  const specsOk = diff.filter(item => item.specs.sample_json_keys > 0).length
  const descriptionImg = diff.filter(item => item.description.sample_has_img).length
  const priceChanges = diff.filter(item => item.price.changed || item.original_price.changed || item.online_discount_amount.changed).length
  const activeCurrent = diff.filter(item => item.is_active_current).length
  const verified = manifest.filter((item: any) => item.upload?.verified).length

  const lines = [
    `# Sample QA diff — ${brand}/${subcategory}`,
    '',
    `Source: \`${source}\``,
    `Sample products: **${sampleCount}**`,
    `Current active SKUs in sample: **${activeCurrent}**`,
    `Missing in DB: **${missingDb}**`,
    `Specs non-empty: **${specsOk}/${sampleCount}**`,
    `Description has HTML images: **${descriptionImg}/${sampleCount}**`,
    `Price-related changes vs DB: **${priceChanges}/${sampleCount}**`,
    `Image migration candidates: **${manifest.length} unique URLs**`,
    uploadBunny ? `Bunny verified: **${verified}/${manifest.length}**` : 'Bunny upload: **not executed**',
    '',
    '## Crawl Run',
    '',
    '```json',
    JSON.stringify(sourceRun, null, 2),
    '```',
    '',
    '## Product Diff',
    '',
    '| SKU | Active | Price DB -> Sample | Specs DB/Sample | Images DB/Sample | Docs DB/Sample | Notes |',
    '|---|---:|---|---:|---:|---:|---|',
  ]

  for (const item of diff) {
    const notes = [
      item.exists_in_db ? '' : 'new_sku',
      item.description.sample_has_img ? 'desc_img' : '',
      item.source_url.changed ? 'source_url_change' : '',
    ].filter(Boolean).join(', ')
    lines.push(
      `| ${item.sku} | ${item.is_active_current ? 'yes' : 'no'} | ${item.price.db ?? 'null'} -> ${item.price.sample ?? 'null'} | ${item.specs.db_normalized_rows ?? 'null'}/${item.specs.sample_json_keys} | ${item.images.db_rows ?? 'null'}/${item.images.sample_rows} | ${item.documents.db_rows ?? 'null'}/${item.documents.sample_rows} | ${notes || '-'} |`
    )
  }

  lines.push(
    '',
    '## Image Manifest Preview',
    '',
    '| SKU | Use | Hita URL | Bunny URL | Verify |',
    '|---|---|---|---|---|'
  )
  for (const item of manifest.slice(0, 40) as any[]) {
    lines.push(`| ${item.sku} | ${item.use} | ${item.source_url} | ${item.upload?.bunny_url || item.bunny_url} | ${item.upload?.verified ? '200' : (item.upload?.error || 'pending')} |`)
  }
  if (manifest.length > 40) lines.push(`| ... | ... | ${manifest.length - 40} more | ... | ... |`)

  lines.push(
    '',
    '## Guardrails',
    '',
    '- No product/catalog import was executed by this script.',
    '- Full import must preserve current `is_active` per SKU.',
    '- DB image replacement must wait until Bunny URLs verify 200.',
    '- Full import must use normalized pipeline only; do not run old `4-import-db.js` for Caesar.'
  )

  return `${lines.join('\n')}\n`
}

async function main() {
  if (!fs.existsSync(normalizedFile)) throw new Error(`Missing normalized file: ${normalizedFile}`)
  const products = readJsonFile<SampleProduct[]>(normalizedFile)
  if (products.length === 0) throw new Error('No sample products found')

  const skus = [...new Set(products.map(product => product.sku).filter(Boolean))]
  const dbBySku = await fetchDbProducts(skus)
  const diff = buildDiff(products, dbBySku)
  const manifest = collectImageManifest(products)

  if (uploadBunny) {
    for (const entry of manifest) {
      entry.upload = await uploadAndVerify(entry)
      if ((entry.upload as any).bunny_url) entry.bunny_url = (entry.upload as any).bunny_url
      console.log(`${entry.sku} ${entry.use} ${(entry.upload as any).verified ? 'verified' : 'failed'} ${entry.bunny_url}`)
    }
  }

  const sourceRun = {
    brand,
    subcategory,
    source,
    sample_dir: sampleDir,
    products: products.length,
    unique_skus: skus.length,
    generated_at: new Date().toISOString(),
  }

  writeJson(qaDiffFile, { sourceRun, diff })
  writeJson(manifestFile, { sourceRun, manifest })
  fs.writeFileSync(reportFile, buildMarkdownReport(diff, manifest, sourceRun), 'utf8')

  console.log(JSON.stringify({
    products: products.length,
    unique_skus: skus.length,
    image_manifest_urls: manifest.length,
    report: reportFile,
    qa_diff: qaDiffFile,
    manifest: manifestFile,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
