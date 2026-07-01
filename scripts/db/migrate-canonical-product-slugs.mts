import { Prisma, PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const prisma = new PrismaClient()
const args = process.argv.slice(2)
const execute = args.includes('--execute')

function readArg(prefix: string, fallback: string) {
  const arg = args.find(item => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function slugify(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cleanHitaPathSlug(sourceUrl: string) {
  if (!sourceUrl) return ''

  try {
    const parsed = new URL(String(sourceUrl).trim(), 'https://hita.com.vn')
    const pathname = decodeURIComponent(parsed.pathname || '')
      .replace(/^\/+/, '')
      .replace(/\.html$/i, '')
      .split('/')
      .filter(Boolean)
      .pop() || ''
    const parts = pathname.split('-').filter(Boolean)
    if (parts.length > 1 && /^\d{3,}$/.test(parts[parts.length - 1])) parts.pop()
    return parts.join('-')
  } catch {
    return String(sourceUrl).trim().replace(/^\/+/, '').replace(/\.html$/i, '')
  }
}

function variantLabelFromProduct(product: any) {
  if (product.variant_label && String(product.variant_label).trim()) {
    return String(product.variant_label).trim()
  }

  if (Array.isArray(product.variant_options)) {
    const labels = product.variant_options
      .map((option: any) => String(option?.value || '').trim())
      .filter(Boolean)
    if (labels.length > 0) return labels.join('-')
  }

  return ''
}

function canonicalSlugFromProduct(product: any) {
  const variantSuffix = slugify(variantLabelFromProduct(product))
  const cleanedSourceSlug = cleanHitaPathSlug(product.source_url || '')
  if (cleanedSourceSlug) {
    return slugify([cleanedSourceSlug, variantSuffix].filter(Boolean).join('-'))
  }

  if (product.hita_product_id) {
    const cleanedCurrentSlug = cleanHitaPathSlug(product.slug || '')
    if (cleanedCurrentSlug) {
      return slugify([cleanedCurrentSlug, variantSuffix].filter(Boolean).join('-'))
    }
  }

  const typePart = product.product_sub_types?.slug
    || product.product_sub_type
    || product.product_types?.slug
    || product.product_type
    || ''
  const syntheticSku = /^HITA-/i.test(String(product.sku || '').trim()) ? '' : String(product.sku || '').trim()
  const fallbackParts = [typePart, product.brands?.slug, syntheticSku, variantSuffix, product.name]
    .filter(Boolean)
    .map((part) => slugify(part))
    .filter(Boolean)

  return fallbackParts.join('-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

function preferredSlugForProduct(product: any) {
  const currentSlug = String(product.slug || '').trim()
  if (currentSlug && !currentSlugHasHitaSignal(product)) return currentSlug
  return canonicalSlugFromProduct(product) || currentSlug || `product-${product.id}`
}

function categoryKey(product: any) {
  return String(product.categories?.slug || product.category_id || 'unknown')
}

function currentSlugHasHitaSignal(product: any) {
  if (!product.slug) return false
  if (product.source_url || product.hita_product_id) return /-\d{3,}$/.test(String(product.slug))
  return false
}

function productPath(product: any, slug: string) {
  const category = product.categories?.slug || 'danh-muc'
  const subcategory = product.subcategories?.slug || product.product_type || '_'
  return `/${category}/${subcategory}/${slug}`.replace(/\/+/g, '/').replace(/\/$/, '')
}

function normalizeRedirectPath(value: string) {
  try {
    const parsed = new URL(value, 'https://www.dongphugia.com.vn')
    return `${parsed.pathname}${parsed.search}` || '/'
  } catch {
    const trimmed = String(value || '').trim()
    if (!trimmed) return '/'
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  }
}

function normalizeRedirectDestination(value: string) {
  try {
    const parsed = new URL(value, 'https://www.dongphugia.com.vn')
    if (parsed.hostname === 'dongphugia.com.vn' || parsed.hostname === 'www.dongphugia.com.vn') {
      return `${parsed.pathname}${parsed.search}` || '/'
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return normalizeRedirectPath(value)
  }
}

function resolveRedirectDestination(startUrl: string, redirectMap: Record<string, string>) {
  let current = normalizeRedirectDestination(startUrl)
  const visited = new Set<string>([normalizeRedirectPath(startUrl)])

  for (let hops = 0; hops < 20; hops += 1) {
    const next = redirectMap[normalizeRedirectPath(current)]
    if (!next) return current

    const normalizedNext = normalizeRedirectDestination(next)
    const normalizedNextKey = normalizeRedirectPath(normalizedNext)
    if (visited.has(normalizedNextKey)) return normalizedNext

    visited.add(normalizedNextKey)
    current = normalizedNext
  }

  return current
}

async function exportRedirectMapFile(output: string) {
  const redirects = await prisma.redirects.findMany({
    where: { is_active: true },
    orderBy: [{ old_url: 'asc' }],
    select: {
      old_url: true,
      new_url: true,
      status_code: true,
      is_active: true,
    },
  })

  const map = Object.fromEntries(
    redirects
      .filter(row => row.old_url && row.new_url && (row.status_code ?? 301) >= 300 && (row.status_code ?? 301) < 400)
      .map(row => [normalizeRedirectPath(row.old_url), row.new_url])
  )

  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, `${JSON.stringify(map, null, 2)}\n`)

  return Object.keys(map).length
}

async function flattenRedirectChains() {
  const redirects = await prisma.redirects.findMany({
    where: { is_active: true },
    orderBy: [{ old_url: 'asc' }],
    select: {
      old_url: true,
      new_url: true,
      status_code: true,
      is_active: true,
    },
  })

  const redirectMap = Object.fromEntries(
    redirects
      .filter(row => row.old_url && row.new_url && (row.status_code ?? 301) >= 300 && (row.status_code ?? 301) < 400)
      .map(row => [normalizeRedirectPath(row.old_url), normalizeRedirectDestination(row.new_url)])
  )

  const rowsToFlatten = redirects
    .map((row) => {
      const currentDestination = normalizeRedirectDestination(row.new_url)
      const finalDestination = resolveRedirectDestination(row.new_url, redirectMap)
      return {
        old_url: normalizeRedirectPath(row.old_url),
        current_destination: currentDestination,
        final_destination: finalDestination,
      }
    })
    .filter(row => row.final_destination && row.final_destination !== row.current_destination)

  const CHUNK_SIZE = 500
  let flattened = 0

  for (let i = 0; i < rowsToFlatten.length; i += CHUNK_SIZE) {
    const chunk = rowsToFlatten.slice(i, i + CHUNK_SIZE)
    const oldUrls = chunk.map(row => row.old_url)
    const newUrls = chunk.map(row => row.final_destination)

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        WITH data AS (
          SELECT * FROM UNNEST(
            ARRAY[${Prisma.join(oldUrls)}]::text[],
            ARRAY[${Prisma.join(newUrls)}]::text[]
          ) AS t(old_url, new_url)
        )
        UPDATE redirects r
        SET new_url = data.new_url,
            status_code = 301,
            is_active = true
        FROM data
        WHERE r.old_url = data.old_url
      `
    })

    flattened += chunk.length
    console.log(`  flattened ${flattened}/${rowsToFlatten.length} redirect rows`)
  }

  return rowsToFlatten.length
}

async function main() {
  const reportPath = path.resolve(process.cwd(), readArg('--report=', 'scripts/output/canonical-slug-audit.json'))

  const products = await prisma.products.findMany({
    orderBy: [{ category_id: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      sku: true,
      slug: true,
      name: true,
      source_url: true,
      hita_product_id: true,
      product_type: true,
      product_sub_type: true,
      variant_label: true,
      variant_options: true,
      categories: { select: { slug: true } },
      subcategories: { select: { slug: true } },
      brands: { select: { slug: true } },
    },
  })

  const proposed = products.map((product) => {
    const desired_base_slug = canonicalSlugFromProduct(product)
    return {
      ...product,
      desired_base_slug,
      current_has_hita_id: currentSlugHasHitaSignal(product),
    }
  })

  const duplicateRiskGroups = new Map<string, typeof proposed>()
  for (const product of proposed) {
    const key = `${categoryKey(product)}:${product.desired_base_slug}`
    const bucket = duplicateRiskGroups.get(key) || []
    bucket.push(product)
    duplicateRiskGroups.set(key, bucket)
  }

  const duplicateRisk = [...duplicateRiskGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, count: rows.length, skus: rows.map(row => row.sku), ids: rows.map(row => row.id) }))

  const assignedSlugById = new Map<number, string>()
  const seenSlugsByCategory = new Map<string, Set<string>>()
  const finalSlugCollisions: Array<{ id: number; sku: string; category: string; base_slug: string; final_slug: string }> = []
  let preservedCleanSlugCount = 0

  for (const row of [...proposed].sort((a, b) => {
    const aPriority = currentSlugHasHitaSignal(a) ? 1 : 0
    const bPriority = currentSlugHasHitaSignal(b) ? 1 : 0
    if (aPriority !== bPriority) return aPriority - bPriority
    const categoryCompare = categoryKey(a).localeCompare(categoryKey(b))
    if (categoryCompare !== 0) return categoryCompare
    return Number(a.id) - Number(b.id)
  })) {
    const category = categoryKey(row)
    const preferredSlug = preferredSlugForProduct(row)
    const baseSlug = preferredSlug || row.desired_base_slug || row.slug || `product-${row.id}`
    const seen = seenSlugsByCategory.get(category) || new Set<string>()
    let finalSlug = baseSlug
    let suffix = 2
    while (seen.has(finalSlug)) {
      finalSlug = `${baseSlug}-${suffix}`
      suffix += 1
    }
    seen.add(finalSlug)
    seenSlugsByCategory.set(category, seen)
    assignedSlugById.set(row.id, finalSlug)

    if (finalSlug === row.slug && !currentSlugHasHitaSignal(row)) {
      preservedCleanSlugCount += 1
    }

    if (finalSlug !== baseSlug) {
      finalSlugCollisions.push({
        id: row.id,
        sku: row.sku,
        category,
        base_slug: baseSlug,
        final_slug: finalSlug,
      })
    }
  }

  const slugChanges = proposed.filter(row => row.slug !== (assignedSlugById.get(row.id) || row.slug))

  const report = {
    generated_at: new Date().toISOString(),
    total_products: products.length,
    current_hita_id_slug_count: proposed.filter(row => row.current_has_hita_id).length,
    preserved_clean_slug_count: preservedCleanSlugCount,
    slug_changes_count: slugChanges.length,
    collision_resolved_count: finalSlugCollisions.length,
    duplicate_risk_group_count: duplicateRisk.length,
    duplicate_risk: duplicateRisk,
    final_slug_collisions: finalSlugCollisions,
    sample_changes: slugChanges.slice(0, 200).map(row => ({
      id: row.id,
      sku: row.sku,
      old_slug: row.slug,
      new_slug: assignedSlugById.get(row.id) || row.desired_base_slug,
      old_url: productPath(row, row.slug),
      new_url: productPath(row, assignedSlugById.get(row.id) || row.desired_base_slug),
    })),
  }

  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

  console.log(`🧭 Canonical slug audit`)
  console.log(`  products: ${report.total_products}`)
  console.log(`  current slugs with trailing Hita-like ids: ${report.current_hita_id_slug_count}`)
  console.log(`  slug changes needed: ${report.slug_changes_count}`)
  console.log(`  duplicate-risk groups after cleanup: ${report.duplicate_risk_group_count}`)
  console.log(`  report: ${reportPath}`)

  if (!execute) return

  let updated = 0
  const rowsToUpdate = proposed
    .map((row) => ({
      row,
      finalSlug: assignedSlugById.get(row.id) || row.desired_base_slug || row.slug,
    }))
    .filter(({ finalSlug, row }) => Boolean(finalSlug) && row.slug !== finalSlug)

  const CHUNK_SIZE = 500
  for (let i = 0; i < rowsToUpdate.length; i += CHUNK_SIZE) {
    const chunk = rowsToUpdate.slice(i, i + CHUNK_SIZE)
    const ids = chunk.map(({ row }) => row.id)
    const slugs = chunk.map(({ finalSlug }) => finalSlug as string)
    const oldUrls = chunk.map(({ row }) => productPath(row, row.slug))
    const newUrls = chunk.map(({ row, finalSlug }) => productPath(row, finalSlug as string))

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        WITH data AS (
          SELECT * FROM UNNEST(
            ARRAY[${Prisma.join(ids)}]::int[],
            ARRAY[${Prisma.join(slugs)}]::text[]
          ) AS t(id, slug)
        )
        UPDATE products p
        SET slug = data.slug,
            updated_at = NOW()
        FROM data
        WHERE p.id = data.id
      `

      await tx.$executeRaw`
        WITH data AS (
          SELECT * FROM UNNEST(
            ARRAY[${Prisma.join(oldUrls)}]::text[],
            ARRAY[${Prisma.join(newUrls)}]::text[]
          ) AS t(old_url, new_url)
        )
        INSERT INTO redirects (old_url, new_url, status_code, is_active)
        SELECT old_url, new_url, 301, true
        FROM data
        ON CONFLICT (old_url) DO UPDATE
          SET new_url = EXCLUDED.new_url,
              status_code = 301,
              is_active = true
      `
    })

    updated += chunk.length
    console.log(`  updated ${updated}/${rowsToUpdate.length} products`)
  }

  const flattenedRedirects = await flattenRedirectChains()
  const finalRedirectMapCount = await exportRedirectMapFile(path.resolve(process.cwd(), 'src/data/product-redirect-map.json'))

  console.log(`✅ Canonical slug migration complete: ${updated} products updated`)
  console.log(`✅ Redirect chain flatten complete: ${flattenedRedirects} rows updated`)
  console.log(`✅ Redirect map exported: ${finalRedirectMapCount} entries → src/data/product-redirect-map.json`)
}

main()
  .catch((error) => {
    console.error('❌ Canonical slug migration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
