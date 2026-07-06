import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { Client } from 'pg'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ quiet: true })

type QueryRow = Record<string, unknown>

type RouteRiskSample = {
  id: number
  sku: string | null
  name: string
  slug: string
  category_slug: string
  subcategory_slug: string | null
  brand_slug: string | null
  product_type: string | null
  product_sub_type: string | null
  publication_status: string
  pdp_visibility: string
  listing_visibility: string
  source_url: string | null
  hita_product_id: string | null
}

type SuggestedTaxon = {
  product_id: number
  sku: string | null
  name: string
  category_slug: string
  current_subcategory_slug: string | null
  product_type: string | null
  product_sub_type: string | null
  suggested_category: string
  suggested_taxon: string
  confidence: number
  reason: string
}

const args = new Map<string, string | boolean>()
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--') && arg.includes('=')) {
    const [key, value] = arg.slice(2).split(/=(.*)/s)
    args.set(key, value)
  } else if (arg.startsWith('--')) {
    args.set(arg.slice(2), true)
  }
}

const sampleLimit = Number(args.get('sample-limit') || 50)
const defaultOut = 'scripts/output/catalog-taxonomy-v2-audit.json'
const outPath = String(args.get('out') || defaultOut)
const markdownPath = outPath.endsWith('.json') ? outPath.replace(/\.json$/, '.md') : `${outPath}.md`

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!connectionString) {
  console.error('Missing DIRECT_URL or DATABASE_URL. Check .env.local.')
  process.exit(1)
}

function numberValue(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') return Number(value)
  return 0
}

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function hasAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle))
}

function suggestTaxon(row: RouteRiskSample): SuggestedTaxon {
  const haystack = normalizeText([
    row.category_slug,
    row.subcategory_slug,
    row.product_type,
    row.product_sub_type,
    row.name,
    row.source_url,
  ].join(' '))

  const base = {
    product_id: row.id,
    sku: row.sku,
    name: row.name,
    category_slug: row.category_slug,
    current_subcategory_slug: row.subcategory_slug,
    product_type: row.product_type,
    product_sub_type: row.product_sub_type,
  }

  if (hasAny(haystack, ['ecocarat', 'gach ', ' gach-', 'gach-op', 'gach-lat', 'gach-trang-tri'])) {
    return { ...base, suggested_category: 'gach-op-lat', suggested_taxon: 'gach-op-lat', confidence: 85, reason: 'tile keyword' }
  }

  if (hasAny(haystack, ['chau rua chen', 'chau-rua-chen', 'bon rua chen', 'sink'])) {
    return { ...base, suggested_category: 'thiet-bi-bep', suggested_taxon: 'chau-rua-chen', confidence: 85, reason: 'kitchen sink keyword' }
  }

  if (hasAny(haystack, ['voi rua chen', 'voi-rua-chen', 'voi bep', 'voi-bep'])) {
    return { ...base, suggested_category: 'thiet-bi-bep', suggested_taxon: 'voi-rua-chen', confidence: 85, reason: 'kitchen faucet keyword' }
  }

  if (hasAny(haystack, ['phu kien voi rua chen', 'phu-kien-voi-rua-chen', 'phu kien chau rua chen', 'bo xa chau', 'ro rac', 'thot rac'])) {
    return { ...base, suggested_category: 'thiet-bi-bep', suggested_taxon: 'phu-kien-chau-rua-chen', confidence: 80, reason: 'sink accessory keyword' }
  }

  if (hasAny(haystack, ['may nuoc nong', 'may-nuoc-nong', 'binh nuoc nong', 'water heater'])) {
    return { ...base, suggested_category: 'vat-lieu-nuoc', suggested_taxon: 'may-nuoc-nong', confidence: 80, reason: 'water heater keyword' }
  }

  if (hasAny(haystack, ['bon cau', 'bon-cau', 'nap rua dien tu', 'nap dien tu'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: hasAny(haystack, ['nap rua', 'nap dien tu', 'nap dong em']) ? 'nap-bon-cau' : 'bon-cau', confidence: 75, reason: 'toilet keyword' }
  }

  if (hasAny(haystack, ['lavabo', 'chau lavabo', 'chau rua mat'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'lavabo', confidence: 75, reason: 'lavabo keyword' }
  }

  if (hasAny(haystack, ['voi chau', 'voi lavabo', 'voi rua mat'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'voi-chau', confidence: 75, reason: 'basin faucet keyword' }
  }

  if (hasAny(haystack, ['sen tam', 'sen cay', 'tay sen', 'bat sen', 'cu sen'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'sen-tam', confidence: 75, reason: 'shower keyword' }
  }

  if (hasAny(haystack, ['bon tam', 'bathtub'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'bon-tam', confidence: 75, reason: 'bathtub keyword' }
  }

  if (hasAny(haystack, ['bon tieu', 'tieu nam'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'bon-tieu', confidence: 75, reason: 'urinal keyword' }
  }

  if (hasAny(haystack, ['ga thoat san', 'thoat san'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'ga-thoat-san', confidence: 70, reason: 'floor drain keyword' }
  }

  if (hasAny(haystack, ['may say tay', 'say tay'])) {
    return { ...base, suggested_category: 'thiet-bi-ve-sinh', suggested_taxon: 'may-say-tay', confidence: 70, reason: 'hand dryer keyword' }
  }

  return {
    ...base,
    suggested_category: row.category_slug,
    suggested_taxon: row.subcategory_slug || 'manual-review',
    confidence: row.subcategory_slug ? 60 : 20,
    reason: row.subcategory_slug ? 'current subcategory fallback' : 'needs manual review',
  }
}

function table(rows: QueryRow[], columns: string[]) {
  const header = `| ${columns.join(' | ')} |`
  const sep = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${columns.map((column) => String(row[column] ?? '')).join(' | ')} |`)
  return [header, sep, ...body].join('\n')
}

async function run() {
  const client = new Client({ connectionString })
  await client.connect()

  async function q<T extends QueryRow = QueryRow>(sql: string, values: unknown[] = []): Promise<T[]> {
    const result = await client.query(sql, values)
    return result.rows as T[]
  }

  try {
    await client.query('BEGIN READ ONLY')
    await client.query(`SET LOCAL statement_timeout = '120s'`)

    const generatedAt = new Date().toISOString()

    const totals = (await q(`
      SELECT
        COUNT(*)::int AS products,
        COUNT(*) FILTER (WHERE is_active)::int AS active_products,
        COUNT(*) FILTER (WHERE publication_status = 'public' AND pdp_visibility = 'public')::int AS public_pdp,
        COUNT(*) FILTER (
          WHERE publication_status = 'public'
            AND pdp_visibility = 'public'
            AND listing_visibility NOT IN ('hidden', 'search_only')
        )::int AS listable,
        COUNT(*) FILTER (WHERE subcategory_id IS NULL)::int AS null_subcategory,
        COUNT(*) FILTER (WHERE product_type IS NULL)::int AS null_product_type,
        COUNT(*) FILTER (WHERE source_url ILIKE '%hita.com.vn%' OR hita_product_id IS NOT NULL)::int AS hita_mapped,
        COUNT(*) FILTER (WHERE image_main_url IS NOT NULL)::int AS has_main_image,
        COUNT(*) FILTER (WHERE specs <> '{}'::jsonb)::int AS has_specs
      FROM products
    `))[0]

    const categorySummary = await q(`
      SELECT
        c.slug AS category_slug,
        c.name AS category_name,
        COUNT(p.id)::int AS total,
        COUNT(p.id) FILTER (WHERE p.is_active)::int AS active,
        COUNT(p.id) FILTER (WHERE p.publication_status = 'public' AND p.pdp_visibility = 'public')::int AS public_pdp,
        COUNT(p.id) FILTER (
          WHERE p.publication_status = 'public'
            AND p.pdp_visibility = 'public'
            AND p.listing_visibility NOT IN ('hidden', 'search_only')
        )::int AS listable,
        COUNT(p.id) FILTER (WHERE p.subcategory_id IS NULL)::int AS null_subcategory,
        COUNT(p.id) FILTER (WHERE p.product_type IS NULL)::int AS null_product_type,
        COUNT(p.id) FILTER (WHERE p.source_url ILIKE '%hita.com.vn%' OR p.hita_product_id IS NOT NULL)::int AS hita_mapped,
        COUNT(p.id) FILTER (WHERE p.image_main_url IS NOT NULL)::int AS has_main_image,
        COUNT(p.id) FILTER (WHERE p.specs <> '{}'::jsonb)::int AS has_specs
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.slug, c.name
      ORDER BY total DESC, c.slug
    `)

    const subcategorySummary = await q(`
      SELECT
        c.slug AS category_slug,
        s.slug AS subcategory_slug,
        s.name AS subcategory_name,
        COUNT(p.id)::int AS total,
        COUNT(p.id) FILTER (WHERE p.publication_status = 'public' AND p.pdp_visibility = 'public')::int AS public_pdp,
        COUNT(p.id) FILTER (
          WHERE p.publication_status = 'public'
            AND p.pdp_visibility = 'public'
            AND p.listing_visibility NOT IN ('hidden', 'search_only')
        )::int AS listable,
        COUNT(p.id) FILTER (WHERE p.product_type IS NULL)::int AS null_product_type,
        COUNT(fd.id)::int AS filter_definitions
      FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      LEFT JOIN products p ON p.subcategory_id = s.id
      LEFT JOIN filter_definitions fd ON fd.subcategory_id = s.id AND fd.is_active = true
      GROUP BY c.slug, s.slug, s.name
      ORDER BY c.slug, total DESC, s.slug
    `)

    const routeRiskSamples = await q<RouteRiskSample>(`
      SELECT
        p.id,
        p.sku,
        p.name,
        p.slug,
        c.slug AS category_slug,
        s.slug AS subcategory_slug,
        b.slug AS brand_slug,
        p.product_type,
        p.product_sub_type,
        p.publication_status,
        p.pdp_visibility,
        p.listing_visibility,
        p.source_url,
        p.hita_product_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.publication_status = 'public'
        AND p.pdp_visibility = 'public'
        AND p.subcategory_id IS NULL
      ORDER BY c.slug, b.slug NULLS LAST, p.id
      LIMIT $1
    `, [sampleLimit])

    const suggestedTaxons = routeRiskSamples.map(suggestTaxon)

    const duplicatePathRisk = await q(`
      SELECT
        c.slug AS category_slug,
        COALESCE(s.slug, 'NULL') AS subcategory_slug,
        p.slug AS product_slug,
        COUNT(*)::int AS total,
        ARRAY_AGG(p.id ORDER BY p.id) AS product_ids
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE p.publication_status = 'public' AND p.pdp_visibility = 'public'
      GROUP BY c.slug, COALESCE(s.slug, 'NULL'), p.slug
      HAVING COUNT(*) > 1
      ORDER BY total DESC
      LIMIT 100
    `)

    const productTypeDistribution = await q(`
      WITH grouped AS (
        SELECT
          c.slug AS category_slug,
          COALESCE(s.slug, 'NULL') AS subcategory_slug,
          COALESCE(p.product_type, 'NULL') AS product_type,
          COUNT(*)::int AS total
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        GROUP BY c.slug, COALESCE(s.slug, 'NULL'), COALESCE(p.product_type, 'NULL')
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY category_slug ORDER BY total DESC, product_type) AS rn
        FROM grouped
      )
      SELECT category_slug, subcategory_slug, product_type, total
      FROM ranked
      WHERE rn <= 40
      ORDER BY category_slug, total DESC, product_type
    `)

    const productTypesAcrossCategories = await q(`
      SELECT
        p.product_type,
        COUNT(*)::int AS total,
        ARRAY_AGG(DISTINCT c.slug ORDER BY c.slug) AS category_slugs
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.product_type IS NOT NULL
      GROUP BY p.product_type
      HAVING COUNT(DISTINCT c.slug) > 1
      ORDER BY total DESC, p.product_type
    `)

    const specKeyFrequencyRows = await q(`
      WITH keys AS (
        SELECT
          c.slug AS category_slug,
          COALESCE(s.slug, 'NULL') AS subcategory_slug,
          key AS spec_key,
          COUNT(*)::int AS total
        FROM products p
        JOIN categories c ON c.id = p.category_id
        LEFT JOIN subcategories s ON s.id = p.subcategory_id
        CROSS JOIN LATERAL jsonb_object_keys(p.specs) AS key
        GROUP BY c.slug, COALESCE(s.slug, 'NULL'), key
      ),
      ranked AS (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY category_slug ORDER BY total DESC, spec_key) AS rn
        FROM keys
      )
      SELECT category_slug, subcategory_slug, spec_key, total
      FROM ranked
      WHERE rn <= 60
      ORDER BY category_slug, total DESC, spec_key
    `)

    const filterDefinitionCoverage = await q(`
      SELECT
        c.slug AS category_slug,
        s.slug AS subcategory_slug,
        s.name AS subcategory_name,
        s.sort_order AS subcategory_sort_order,
        COUNT(fd.id)::int AS filter_definitions,
        COALESCE(ARRAY_AGG(fd.filter_key ORDER BY fd.sort_order, fd.filter_key) FILTER (WHERE fd.id IS NOT NULL), ARRAY[]::varchar[]) AS filter_keys
      FROM subcategories s
      JOIN categories c ON c.id = s.category_id
      LEFT JOIN filter_definitions fd ON fd.subcategory_id = s.id AND fd.is_active = true
      GROUP BY c.slug, s.slug, s.name, s.sort_order
      ORDER BY c.slug, s.sort_order, s.slug
    `)

    const seoVisibilitySummary = await q(`
      SELECT
        c.slug AS category_slug,
        p.publication_status,
        p.pdp_visibility,
        p.listing_visibility,
        p.search_visibility,
        p.seo_indexing,
        p.sitemap_include,
        COUNT(*)::int AS total
      FROM products p
      JOIN categories c ON c.id = p.category_id
      GROUP BY c.slug, p.publication_status, p.pdp_visibility, p.listing_visibility, p.search_visibility, p.seo_indexing, p.sitemap_include
      ORDER BY c.slug, total DESC
    `)

    const variantSeoSummary = await q(`
      SELECT
        c.slug AS category_slug,
        COALESCE(s.slug, 'NULL') AS subcategory_slug,
        COUNT(*) FILTER (WHERE p.variant_group IS NOT NULL OR p.variant_group_id IS NOT NULL)::int AS variant_products,
        COUNT(DISTINCT COALESCE(p.variant_group, p.variant_group_id::text)) FILTER (WHERE p.variant_group IS NOT NULL OR p.variant_group_id IS NOT NULL)::int AS variant_groups,
        COUNT(*) FILTER (WHERE p.seo_indexing = 'index')::int AS seo_index,
        COUNT(*) FILTER (WHERE p.seo_indexing = 'canonical_to_parent')::int AS canonical_to_parent,
        COUNT(*) FILTER (WHERE p.seo_indexing = 'noindex')::int AS noindex
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      GROUP BY c.slug, COALESCE(s.slug, 'NULL')
      HAVING COUNT(*) FILTER (WHERE p.variant_group IS NOT NULL OR p.variant_group_id IS NOT NULL) > 0
      ORDER BY variant_products DESC
    `)

    const sourceCoverage = await q(`
      SELECT
        c.slug AS category_slug,
        COALESCE(b.slug, 'NULL') AS brand_slug,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE p.source_url ILIKE '%hita.com.vn%')::int AS hita_source_url,
        COUNT(*) FILTER (WHERE p.hita_product_id IS NOT NULL)::int AS hita_product_id,
        COUNT(*) FILTER (WHERE p.source_url ILIKE '%hita.com.vn%' AND p.hita_product_id IS NULL)::int AS hita_url_without_hita_id
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      GROUP BY c.slug, COALESCE(b.slug, 'NULL')
      ORDER BY total DESC, c.slug, brand_slug
    `)

    const brandCategoryMatrix = await q(`
      SELECT
        COALESCE(b.slug, 'NULL') AS brand_slug,
        c.slug AS category_slug,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE p.publication_status = 'public' AND p.pdp_visibility = 'public')::int AS public_pdp,
        COUNT(*) FILTER (WHERE p.subcategory_id IS NULL)::int AS null_subcategory
      FROM products p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      GROUP BY COALESCE(b.slug, 'NULL'), c.slug
      ORDER BY total DESC, brand_slug
    `)

    const blockers = [
      numberValue(totals.null_subcategory) > 0 ? `${totals.null_subcategory} products have null subcategory` : null,
      routeRiskSamples.length > 0 ? `${routeRiskSamples.length} sampled public PDP products have null subcategory route risk` : null,
      duplicatePathRisk.length > 0 ? `${duplicatePathRisk.length} duplicate canonical path risks found` : null,
    ].filter(Boolean)

    const warnings = [
      productTypesAcrossCategories.length > 0 ? `${productTypesAcrossCategories.length} product_type values are used across multiple root categories` : null,
      filterDefinitionCoverage.some((row) => numberValue(row.filter_definitions) === 0) ? 'Some subcategories have no active filter definitions' : null,
      sourceCoverage.some((row) => numberValue(row.hita_url_without_hita_id) > 0) ? 'Some Hita source URLs do not have hita_product_id' : null,
    ].filter(Boolean)

    const report = {
      generated_at: generatedAt,
      mode: 'read_only',
      sample_limit: sampleLimit,
      totals,
      readiness: {
        blockers,
        warnings,
        can_start_schema_phase: duplicatePathRisk.length === 0,
        can_backfill_without_review: blockers.length === 0,
      },
      category_summary: categorySummary,
      subcategory_summary: subcategorySummary,
      route_risk_samples: routeRiskSamples,
      suggested_taxon_candidates_for_route_risks: suggestedTaxons,
      duplicate_path_risk: duplicatePathRisk,
      product_type_distribution: productTypeDistribution,
      product_types_across_categories: productTypesAcrossCategories,
      spec_key_frequency: specKeyFrequencyRows,
      filter_definition_coverage: filterDefinitionCoverage,
      seo_visibility_summary: seoVisibilitySummary,
      variant_seo_summary: variantSeoSummary,
      source_coverage: sourceCoverage,
      brand_category_matrix: brandCategoryMatrix,
    }

    const markdown = [
      '# Catalog Taxonomy v2 Audit',
      '',
      `Generated at: ${generatedAt}`,
      '',
      'Mode: read-only',
      '',
      '## Totals',
      '',
      table([totals], ['products', 'active_products', 'public_pdp', 'listable', 'null_subcategory', 'null_product_type', 'hita_mapped', 'has_main_image', 'has_specs']),
      '',
      '## Readiness',
      '',
      `Blockers: ${blockers.length ? blockers.join('; ') : 'none'}`,
      '',
      `Warnings: ${warnings.length ? warnings.join('; ') : 'none'}`,
      '',
      '## Category Summary',
      '',
      table(categorySummary, ['category_slug', 'total', 'active', 'public_pdp', 'listable', 'null_subcategory', 'null_product_type', 'hita_mapped']),
      '',
      '## Public PDP Route Risk Samples',
      '',
      routeRiskSamples.length
        ? table(routeRiskSamples.slice(0, 20), ['id', 'sku', 'category_slug', 'brand_slug', 'product_type', 'listing_visibility'])
        : 'No sampled route-risk rows.',
      '',
      '## Suggested Taxon Candidates For Route Risks',
      '',
      suggestedTaxons.length
        ? table(suggestedTaxons.slice(0, 20), ['product_id', 'sku', 'category_slug', 'suggested_category', 'suggested_taxon', 'confidence', 'reason'])
        : 'No suggestions needed for sampled rows.',
      '',
      '## Duplicate Path Risk',
      '',
      duplicatePathRisk.length
        ? table(duplicatePathRisk.slice(0, 20), ['category_slug', 'subcategory_slug', 'product_slug', 'total'])
        : 'No duplicate public path risks found.',
      '',
      '## Product Types Used Across Categories',
      '',
      productTypesAcrossCategories.length
        ? table(productTypesAcrossCategories.slice(0, 30), ['product_type', 'total', 'category_slugs'])
        : 'No cross-category product_type reuse found.',
      '',
      '## Output',
      '',
      `Full JSON: ${path.resolve(outPath)}`,
    ].join('\n')

    await mkdir(path.dirname(outPath), { recursive: true })
    await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`)
    await writeFile(markdownPath, `${markdown}\n`)

    await client.query('COMMIT')

    console.log(`Catalog Taxonomy v2 audit complete.`)
    console.log(`JSON: ${path.resolve(outPath)}`)
    console.log(`Markdown: ${path.resolve(markdownPath)}`)
    console.log(`Blockers: ${blockers.length ? blockers.join('; ') : 'none'}`)
    console.log(`Warnings: ${warnings.length ? warnings.join('; ') : 'none'}`)
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    throw error
  } finally {
    await client.end()
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
