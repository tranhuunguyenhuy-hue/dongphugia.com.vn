import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const ROOT_PROJECT = '/Users/m-ac/Projects/dongphugia'

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalIndex = trimmed.indexOf('=')
    if (equalIndex < 0) continue
    const key = trimmed.slice(0, equalIndex).trim()
    let value = trimmed.slice(equalIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

loadEnvFile(path.join(ROOT_PROJECT, '.env'))
loadEnvFile(path.join(ROOT_PROJECT, '.env.local'), true)
loadEnvFile(path.resolve(process.cwd(), '.env'))
loadEnvFile(path.resolve(process.cwd(), '.env.local'), true)

const rootRequire = createRequire(path.join(ROOT_PROJECT, 'package.json'))
const { Client } = rootRequire('pg') as typeof import('pg')

const ROOT_CATEGORY_NAMES: Record<string, string> = {
  'thiet-bi-ve-sinh': 'Thiết bị vệ sinh',
  'thiet-bi-bep': 'Thiết bị bếp',
  'vat-lieu-nuoc': 'Vật liệu nước',
  'gach-op-lat': 'Gạch ốp lát',
}

type RedirectInputRow = {
  migration_group: string
  old_root: string
  old_subcategory: string
  slug: string
  new_root: string
  new_subcategory: string
  old_url: string
  new_url: string
}

type InventoryRow = RedirectInputRow & {
  product_id: string
  sku: string
  name: string
  current_category_slug: string
  current_subcategory_slug: string
  current_category_name: string
  current_subcategory_name: string
  current_product_type: string
  current_product_sub_type: string
  target_taxonomy_path: string
  target_taxon_slug: string
  target_taxon_name: string
  publication_status: string
  pdp_visibility: string
  listing_visibility: string
  search_state: string
  seo_indexing: string
  sitemap_include: string
  is_active: string
  stock_status: string
  canonical_runtime_url: string
  old_url_matches_legacy_shape: string
  new_url_matches_taxonomy_shape: string
  redirect_db_exact_old_url: string
  redirect_db_exact_to_expected_new_url: string
  redirect_collision: string
  redirect_chain_risk: string
  redirect_loop_risk: string
  root_listing_impact: string
  featured_block_impact: string
  filter_derivation_impact: string
  admin_query_impact: string
  breadcrumb_label_risk: string
  migrate_readiness: string
  action_needed: string
  notes: string
}

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function parseCsv(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf8').trim()
  const lines = text.split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const cells: string[] = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (quoted) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else if (char === '"') {
          quoted = false
        } else {
          current += char
        }
      } else if (char === ',') {
        cells.push(current)
        current = ''
      } else if (char === '"') {
        quoted = true
      } else {
        current += char
      }
    }
    cells.push(current)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])) as RedirectInputRow
  })
}

function canonicalRuntimeUrl(categorySlug: string, subcategorySlug: string, slug: string) {
  return `/${categorySlug}/${subcategorySlug}/${slug}`
}

function buildMarkdownTable(rows: string[][]) {
  if (rows.length === 0) return '_No rows_'
  const separator = rows[0].map(() => '---')
  return [rows[0], separator, ...rows.slice(1)].map((row) => `| ${row.join(' | ')} |`).join('\n')
}

function summarizeBy(items: string[]) {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })
  await client.connect()

  const inventoryPath = path.resolve(
    process.cwd(),
    'docs/handoffs/catalog-taxonomy-v2-legacy-migration-69-cases.csv'
  )
  const outputDir = path.resolve(process.cwd(), 'scripts/output')
  const outputCsvPath = path.join(outputDir, 'catalog-taxonomy-v2-legacy-migration-69-cases-audited.csv')
  const outputJsonPath = path.join(outputDir, 'catalog-taxonomy-v2-legacy-migration-audit.json')
  const outputMdPath = path.join(outputDir, 'catalog-taxonomy-v2-legacy-migration-audit.md')

  const inputRows = parseCsv(inventoryPath)
  const redirectFileMap = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), 'src/data/catalog-taxonomy-v2-redirect-map.json'),
      'utf8'
    )
  ) as Record<string, string>

  const productsResult = await client.query<{
    id: number
    sku: string
    name: string
    slug: string
    product_type: string | null
    product_sub_type: string | null
    is_active: boolean
    stock_status: string
    publication_status: string
    pdp_visibility: string
    listing_visibility: string
    search_visibility: string
    seo_indexing: string
    sitemap_include: boolean
    category_slug: string
    category_name: string
    subcategory_slug: string | null
    subcategory_name: string | null
    taxon_slug: string | null
    taxon_name: string | null
    taxon_canonical_path: string | null
  }>(
    `
      select
        p.id,
        p.sku,
        p.name,
        p.slug,
        p.product_type,
        p.product_sub_type,
        p.is_active,
        p.stock_status,
        p.publication_status,
        p.pdp_visibility,
        p.listing_visibility,
        p.search_visibility,
        p.seo_indexing,
        p.sitemap_include,
        c.slug as category_slug,
        c.name as category_name,
        s.slug as subcategory_slug,
        s.name as subcategory_name,
        ct.slug as taxon_slug,
        ct.name as taxon_name,
        ct.canonical_path as taxon_canonical_path
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      left join product_taxon_assignments pta
        on pta.product_id = p.id
       and pta.is_primary is true
      left join catalog_taxons ct
        on ct.id = pta.taxon_id
      where p.slug = any($1::text[])
      order by p.id asc
    `,
    [inputRows.map((row) => row.slug)]
  )

  const redirectsResult = await client.query<{
    old_url: string
    new_url: string
    status_code: number | null
  }>(
    `
      select old_url, new_url, status_code
      from redirects
      where coalesce(is_active, true) is true
    `
  )

  const products = productsResult.rows
  const redirects = redirectsResult.rows

  const productBySlug = new Map<string, typeof products[number][]>()
  for (const product of products) {
    const list = productBySlug.get(product.slug) ?? []
    list.push(product)
    productBySlug.set(product.slug, list)
  }

  const dbRedirectByOldUrl = new Map<string, { new_url: string; status_code: number | null }>()
  for (const redirect of redirects) {
    dbRedirectByOldUrl.set(redirect.old_url, {
      new_url: redirect.new_url,
      status_code: redirect.status_code ?? 301,
    })
  }

  const combinedRedirectMap = new Map<string, string>()
  for (const redirect of redirects) {
    if (redirect.old_url && redirect.new_url) combinedRedirectMap.set(redirect.old_url, redirect.new_url)
  }
  for (const [oldUrl, newUrl] of Object.entries(redirectFileMap)) {
    combinedRedirectMap.set(oldUrl, newUrl)
  }

  const unresolved: string[] = []
  const rows: InventoryRow[] = inputRows.map((input) => {
    const matches = (productBySlug.get(input.slug) ?? []).filter((product) => {
      const primaryPath = product.taxon_canonical_path ?? null
      return primaryPath === input.target_taxonomy_path
    })

    const product = matches[0] ?? null
    if (!product) unresolved.push(input.slug)

    const categorySlug = product?.category_slug ?? input.current_category_slug ?? input.old_root
    const subcategorySlug = product?.subcategory_slug ?? input.current_subcategory_slug ?? input.old_subcategory
    const primaryTaxon = product
      ? {
          canonical_path: product.taxon_canonical_path,
          slug: product.taxon_slug,
          name: product.taxon_name,
        }
      : null
    const runtimeUrl = product && primaryTaxon
      ? canonicalRuntimeUrl(input.new_root, input.new_subcategory, input.slug)
      : ''

    const exactDbRedirect = dbRedirectByOldUrl.get(input.old_url)
    const exactDbRedirectTarget = exactDbRedirect?.new_url ?? ''
    const exactDbRedirectMatches = exactDbRedirectTarget === input.new_url ? 'yes' : exactDbRedirect ? 'no' : 'missing'

    const sameOldUrlDifferentTarget = exactDbRedirect && exactDbRedirectTarget !== input.new_url
    const sameNewUrlExistingOldUrls = redirects
      .filter((redirect) => redirect.new_url === input.new_url && redirect.old_url !== input.old_url)
      .map((redirect) => redirect.old_url)

    const chainNext = combinedRedirectMap.get(input.new_url)
    const chainRisk = chainNext ? `yes:${chainNext}` : 'no'
    const loopRisk = chainNext === input.old_url ? 'yes' : 'no'

    const categoryMismatch = product?.category_slug !== input.new_root
    const subcategoryMismatch = (product?.subcategory_slug ?? null) !== input.new_subcategory

    let readiness = 'safe_if_app_accepts_current_legacy_reads'
    let action = 'can_migrate_after_app_review'
    let notes = ''

    if (!product) {
      readiness = 'blocked_missing_product_match'
      action = 'manual_row_resolution'
      notes = 'No unique DB product matched slug + target taxonomy path'
    } else if (sameOldUrlDifferentTarget) {
      readiness = 'blocked_redirect_collision'
      action = 'resolve_redirect_collision_first'
      notes = `DB redirect old_url already points to ${exactDbRedirectTarget}`
    } else if (chainNext) {
      readiness = 'patch_before_migrate'
      action = 'resolve_redirect_chain_risk'
      notes = `new_url already redirects to ${chainNext}`
    } else if (categoryMismatch || subcategoryMismatch) {
      readiness = 'patch_before_migrate'
      action = 'legacy_fields_not_aligned_with_target'
      notes = [
        categoryMismatch ? `category=${product.category_slug}` : '',
        subcategoryMismatch ? `subcategory=${product.subcategory_slug ?? '(null)'}` : '',
      ].filter(Boolean).join('; ')
    }

    const targetRootLegacySensitive = product?.category_slug === input.old_root ? 'high' : 'medium'
    const breadcrumbRisk = product?.subcategory_slug === input.new_subcategory ? 'low' : 'medium'

    return {
      ...input,
      product_id: product ? String(product.id) : '',
      sku: product?.sku ?? '',
      name: product?.name ?? '',
      current_category_slug: product?.category_slug ?? '',
      current_subcategory_slug: product?.subcategory_slug ?? '',
      current_category_name: product?.category_name ?? '',
      current_subcategory_name: product?.subcategory_name ?? '',
      current_product_type: product?.product_type ?? '',
      current_product_sub_type: product?.product_sub_type ?? '',
      target_taxonomy_path: primaryTaxon?.canonical_path ?? input.target_taxonomy_path,
      target_taxon_slug: primaryTaxon?.slug ?? input.new_subcategory,
      target_taxon_name: primaryTaxon?.name ?? '',
      publication_status: product?.publication_status ?? '',
      pdp_visibility: product?.pdp_visibility ?? '',
      listing_visibility: product?.listing_visibility ?? '',
      search_state: product?.search_visibility ?? '',
      seo_indexing: product?.seo_indexing ?? '',
      sitemap_include: product ? String(product.sitemap_include) : '',
      is_active: product ? String(product.is_active) : '',
      stock_status: product?.stock_status ?? '',
      canonical_runtime_url: runtimeUrl,
      old_url_matches_legacy_shape: product ? String(input.old_url === canonicalRuntimeUrl(input.old_root, input.old_subcategory, input.slug)) : '',
      new_url_matches_taxonomy_shape: product ? String(input.new_url === canonicalRuntimeUrl(input.new_root, input.new_subcategory, input.slug)) : '',
      redirect_db_exact_old_url: exactDbRedirect ? 'yes' : 'no',
      redirect_db_exact_to_expected_new_url: exactDbRedirectMatches,
      redirect_collision: sameOldUrlDifferentTarget
        ? 'old_url_points_elsewhere'
        : sameNewUrlExistingOldUrls.length > 0
          ? `shared_new_url:${sameNewUrlExistingOldUrls.length}`
          : 'none',
      redirect_chain_risk: chainRisk,
      redirect_loop_risk: loopRisk,
      root_listing_impact: targetRootLegacySensitive,
      featured_block_impact: targetRootLegacySensitive,
      filter_derivation_impact: targetRootLegacySensitive,
      admin_query_impact: 'high',
      breadcrumb_label_risk: breadcrumbRisk,
      migrate_readiness: readiness,
      action_needed: action,
      notes,
    }
  })

  const rootListingDeps = [
    'src/app/(public)/thiet-bi-ve-sinh/page.tsx',
    'src/app/(public)/thiet-bi-bep/page.tsx',
    'src/app/(public)/vat-lieu-nuoc/page.tsx',
    'src/app/(public)/gach-op-lat/page.tsx',
    'src/lib/public-api-products.ts:getAvailableFilters',
  ]

  const featuredDeps = [
    'src/app/(public)/thiet-bi-ve-sinh/page.tsx',
    'src/app/(public)/thiet-bi-bep/page.tsx',
    'src/app/(public)/vat-lieu-nuoc/page.tsx',
    'src/app/(public)/gach-op-lat/page.tsx',
    'src/lib/public-api-products.ts:getFeaturedProductsByCategorySlug',
  ]

  const filterDeps = [
    'src/lib/public-api-products.ts:getAvailableFilters',
    'src/lib/public-api-products.ts:getAvailableFiltersBySubcategory',
    'src/lib/public-api-products.ts:getProductTypeFiltersBySubcategory',
  ]

  const adminDeps = [
    'src/lib/admin-product-queries.ts:getAdminProducts',
    'src/lib/admin-product-queries.ts:getProductTypeOptions',
    'src/lib/admin-product-queries.ts:getSubcategoriesByCategory',
    'src/lib/admin-product-queries.ts:getBrandsByCategory',
    'src/lib/product-actions.ts',
  ]

  const breadcrumbDeps = [
    'src/app/(public)/thiet-bi-ve-sinh/[sub]/[slug]/page.tsx',
    'src/app/(public)/thiet-bi-bep/[sub]/[slug]/page.tsx',
    'src/app/(public)/vat-lieu-nuoc/[sub]/[slug]/page.tsx',
    'src/app/(public)/gach-op-lat/[sub]/[slug]/page.tsx',
  ]

  const summary = {
    totalRows: rows.length,
    unresolvedProducts: unresolved.length,
    migrateReadiness: Object.fromEntries(summarizeBy(rows.map((row) => row.migrate_readiness))),
    actionNeeded: Object.fromEntries(summarizeBy(rows.map((row) => row.action_needed))),
    redirectCollision: Object.fromEntries(summarizeBy(rows.map((row) => row.redirect_collision))),
    redirectChainRisk: Object.fromEntries(summarizeBy(rows.map((row) => row.redirect_chain_risk))),
    groups: Object.fromEntries(summarizeBy(rows.map((row) => row.migration_group))),
  }

  const headers = Object.keys(rows[0] ?? {}) as Array<keyof InventoryRow>
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n')

  const safeRows = rows.filter((row) => row.migrate_readiness === 'safe_if_app_accepts_current_legacy_reads')
  const patchRows = rows.filter((row) => row.migrate_readiness === 'patch_before_migrate')
  const blockedRows = rows.filter((row) => row.migrate_readiness.startsWith('blocked_'))

  const md = [
    '# Catalog Taxonomy v2 Legacy Migration DB-Backed Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    buildMarkdownTable([
      ['Metric', 'Value'],
      ['Total rows', String(summary.totalRows)],
      ['Unresolved products', String(summary.unresolvedProducts)],
      ['Safe to migrate after current review', String(safeRows.length)],
      ['Needs patch before migrate', String(patchRows.length)],
      ['Blocked', String(blockedRows.length)],
    ]),
    '',
    '## Group Breakdown',
    '',
    ...summarizeBy(rows.map((row) => row.migration_group)).map(([group, count]) => `- ${group}: ${count}`),
    '',
    '## Redirect Risk Breakdown',
    '',
    ...summarizeBy(rows.map((row) => row.redirect_collision)).map(([key, count]) => `- collision ${key}: ${count}`),
    ...summarizeBy(rows.map((row) => row.redirect_chain_risk)).map(([key, count]) => `- chain ${key}: ${count}`),
    '',
    '## Case Buckets',
    '',
    buildMarkdownTable([
      ['Bucket', 'Count'],
      ...summarizeBy(rows.map((row) => row.migrate_readiness)).map(([key, count]) => [key, String(count)]),
    ]),
    '',
    '## App Dependencies Still Reading Legacy Fields',
    '',
    `- Root listing: ${rootListingDeps.join(', ')}`,
    `- Featured blocks: ${featuredDeps.join(', ')}`,
    `- Filter derivation: ${filterDeps.join(', ')}`,
    `- Admin queries: ${adminDeps.join(', ')}`,
    `- Breadcrumb/subcategory labels: ${breadcrumbDeps.join(', ')}`,
    '',
    '## Cases Needing Patch Before Migrate',
    '',
    buildMarkdownTable([
      ['SKU', 'Old URL', 'New URL', 'Readiness', 'Action', 'Notes'],
      ...patchRows.slice(0, 25).map((row) => [
        row.sku || row.slug,
        row.old_url,
        row.new_url,
        row.migrate_readiness,
        row.action_needed,
        row.notes || '(none)',
      ]),
    ]),
    '',
    '## Blocked Cases',
    '',
    buildMarkdownTable([
      ['SKU', 'Old URL', 'New URL', 'Readiness', 'Action', 'Notes'],
      ...blockedRows.slice(0, 25).map((row) => [
        row.sku || row.slug,
        row.old_url,
        row.new_url,
        row.migrate_readiness,
        row.action_needed,
        row.notes || '(none)',
      ]),
    ]),
    '',
    '## Execute Order Recommendation',
    '',
    '1. Migrate rows with `migrate_readiness = safe_if_app_accepts_current_legacy_reads`, starting with `thiet-bi-ve-sinh -> thiet-bi-bep`, then `-> vat-lieu-nuoc`, then `-> gach-op-lat`.',
    '2. Patch root listing / featured / filter derivation queries to include taxonomy-primary membership before migrating any row marked `patch_before_migrate`.',
    '3. Keep blocked rows for a later phase until their redirect or product matching issue is resolved.',
    '',
    `CSV: \`${path.relative(process.cwd(), outputCsvPath)}\``,
    `JSON: \`${path.relative(process.cwd(), outputJsonPath)}\``,
  ].join('\n')

  const json = {
    generatedAt: new Date().toISOString(),
    summary,
    rootListingDeps,
    featuredDeps,
    filterDeps,
    adminDeps,
    breadcrumbDeps,
    rows,
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputCsvPath, `${csv}\n`)
  fs.writeFileSync(outputJsonPath, `${JSON.stringify(json, null, 2)}\n`)
  fs.writeFileSync(outputMdPath, `${md}\n`)

  console.log(JSON.stringify({
    outputCsvPath,
    outputJsonPath,
    outputMdPath,
    summary,
  }, null, 2))

  await client.end()
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
