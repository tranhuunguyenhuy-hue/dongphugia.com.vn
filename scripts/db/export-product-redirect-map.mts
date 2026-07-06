import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Client } from 'pg'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ quiet: true })

type RedirectRow = {
  id: number
  old_url: string
  new_url: string
  is_active: boolean
}

type ProductRouteRow = {
  id: number
  slug: string
  category_slug: string
  subcategory_slug: string | null
  sku: string | null
  name: string
}

type Resolution =
  | 'exact_target_exists'
  | 'repair_from_old_exact'
  | 'repair_from_new_slug'
  | 'repair_from_old_slug'
  | 'unresolved_kept_original'

type ResolutionSample = {
  redirect_id: number
  old_url: string
  original_new_url: string
  resolved_new_url: string
  resolution: Resolution
  product_id: number | null
  sku: string | null
  name: string | null
}

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('Missing DIRECT_URL or DATABASE_URL')
  process.exit(1)
}

const DATA_OUT = path.resolve(process.cwd(), 'src/data/product-redirect-map.json')
const REPORT_OUT = path.resolve(process.cwd(), 'scripts/output/product-redirect-map-audit.json')
const REPORT_MD_OUT = path.resolve(process.cwd(), 'scripts/output/product-redirect-map-audit.md')

function parsePathname(input: string) {
  try {
    return new URL(input, 'https://www.dongphugia.com.vn').pathname
  } catch {
    return input
  }
}

function parseSlug(input: string) {
  const pathname = parsePathname(input)
  const parts = pathname.split('/').filter(Boolean)
  return parts.length >= 3 ? parts[2] : null
}

function routeFromRow(row: ProductRouteRow) {
  return `/${row.category_slug}/${row.subcategory_slug || 'all'}/${row.slug}`
}

function summarize(items: string[]) {
  const counts = new Map<string, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

async function main() {
  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query('BEGIN READ ONLY')
    await client.query(`SET LOCAL statement_timeout = '120s'`)

    const redirects = (
      await client.query<RedirectRow>(`
        SELECT id, old_url, new_url, is_active
        FROM redirects
        WHERE is_active = true
          AND old_url LIKE '/%'
          AND new_url LIKE '/%'
      `)
    ).rows

    const products = (
      await client.query<ProductRouteRow>(`
        SELECT
          p.id,
          p.slug,
          c.slug AS category_slug,
          s.slug AS subcategory_slug,
          p.sku,
          p.name
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
      `)
    ).rows

    const routeToProduct = new Map<string, ProductRouteRow>()
    const slugToProducts = new Map<string, ProductRouteRow[]>()
    for (const product of products) {
      const route = routeFromRow(product)
      routeToProduct.set(route, product)
      const list = slugToProducts.get(product.slug) || []
      list.push(product)
      slugToProducts.set(product.slug, list)
    }

    const redirectMap = new Map<string, string>()
    const brokenAliasMap = new Map<string, string>()
    const samples: ResolutionSample[] = []
    const resolutionCounts = new Map<Resolution, number>()

    let aliasCount = 0

    for (const redirect of redirects) {
      const oldPath = parsePathname(redirect.old_url)
      const newPath = parsePathname(redirect.new_url)

      let resolution: Resolution = 'unresolved_kept_original'
      let resolvedPath = newPath
      let resolvedProduct: ProductRouteRow | null = null

      const exactTarget = routeToProduct.get(newPath)
      if (exactTarget) {
        resolution = 'exact_target_exists'
        resolvedProduct = exactTarget
      } else {
        const oldExact = routeToProduct.get(oldPath)
        if (oldExact) {
          resolution = 'repair_from_old_exact'
          resolvedProduct = oldExact
          resolvedPath = routeFromRow(oldExact)
        } else {
          const newSlug = parseSlug(newPath)
          const newSlugProducts = newSlug ? slugToProducts.get(newSlug) || [] : []
          if (newSlugProducts.length === 1) {
            resolution = 'repair_from_new_slug'
            resolvedProduct = newSlugProducts[0]
            resolvedPath = routeFromRow(newSlugProducts[0])
          } else {
            const oldSlug = parseSlug(oldPath)
            const oldSlugProducts = oldSlug ? slugToProducts.get(oldSlug) || [] : []
            if (oldSlugProducts.length === 1) {
              resolution = 'repair_from_old_slug'
              resolvedProduct = oldSlugProducts[0]
              resolvedPath = routeFromRow(oldSlugProducts[0])
            }
          }
        }
      }

      if (oldPath !== resolvedPath) {
        redirectMap.set(oldPath, resolvedPath)
      }

      if (resolvedPath !== newPath && newPath !== resolvedPath) {
        brokenAliasMap.set(newPath, resolvedPath)
        aliasCount += 1
      }

      resolutionCounts.set(resolution, (resolutionCounts.get(resolution) ?? 0) + 1)

      if (samples.length < 500) {
        samples.push({
          redirect_id: redirect.id,
          old_url: oldPath,
          original_new_url: newPath,
          resolved_new_url: resolvedPath,
          resolution,
          product_id: resolvedProduct?.id ?? null,
          sku: resolvedProduct?.sku ?? null,
          name: resolvedProduct?.name ?? null,
        })
      }
    }

    for (const [brokenPath, resolvedPath] of brokenAliasMap.entries()) {
      if (brokenPath !== resolvedPath && !redirectMap.has(brokenPath)) {
        redirectMap.set(brokenPath, resolvedPath)
      }
    }

    for (const [fromPath, toPath] of [...redirectMap.entries()]) {
      let current = toPath
      const seen = new Set<string>([fromPath])
      while (brokenAliasMap.has(current) && !seen.has(current)) {
        seen.add(current)
        current = brokenAliasMap.get(current)!
      }
      if (fromPath === current) {
        redirectMap.delete(fromPath)
      } else {
        redirectMap.set(fromPath, current)
      }
    }

    const redirectObject = Object.fromEntries(
      [...redirectMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    )

    const summary = {
      generatedAt: new Date().toISOString(),
      redirectRowCount: redirects.length,
      mapEntryCount: redirectMap.size,
      brokenAliasCount: aliasCount,
      resolutionBreakdown: Object.fromEntries(
        [...resolutionCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      ),
      sampleCount: samples.length,
    }

    await mkdir(path.dirname(DATA_OUT), { recursive: true })
    await mkdir(path.dirname(REPORT_OUT), { recursive: true })
    await writeFile(DATA_OUT, `${JSON.stringify(redirectObject, null, 2)}\n`)
    await writeFile(REPORT_OUT, `${JSON.stringify({ summary, samples }, null, 2)}\n`)

    const md = [
      '# Product Redirect Map Audit',
      '',
      `Generated at: ${summary.generatedAt}`,
      '',
      `- Redirect rows loaded: ${summary.redirectRowCount}`,
      `- Final map entries: ${summary.mapEntryCount}`,
      `- Broken destination aliases added: ${summary.brokenAliasCount}`,
      '',
      '## Resolution Breakdown',
      '',
      ...Object.entries(summary.resolutionBreakdown).map(([key, value]) => `- ${key}: ${value}`),
      '',
      '## Sample Repairs',
      '',
      '| Resolution | Old URL | Original New URL | Resolved New URL | SKU |',
      '| --- | --- | --- | --- | --- |',
      ...samples.slice(0, 40).map((sample) =>
        `| ${sample.resolution} | ${sample.old_url} | ${sample.original_new_url} | ${sample.resolved_new_url} | ${sample.sku || ''} |`
      ),
      '',
    ].join('\n')

    await writeFile(REPORT_MD_OUT, `${md}\n`)
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
