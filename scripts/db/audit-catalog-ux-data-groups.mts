import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as { default?: unknown }).default ??
  prismaModule) as {
  $queryRawUnsafe: <T = unknown>(query: string) => Promise<T>
  $disconnect: () => Promise<void>
}

type GroupConfig = {
  key: string
  label: string
  categorySlug: string
  subcategorySlugs: string[]
}

type CountRow = { key: string | null; count: number }

const GROUPS: GroupConfig[] = [
  {
    key: 'bon-cau',
    label: 'Bon cau',
    categorySlug: 'thiet-bi-ve-sinh',
    subcategorySlugs: ['bon-cau'],
  },
  {
    key: 'lavabo',
    label: 'Lavabo',
    categorySlug: 'thiet-bi-ve-sinh',
    subcategorySlugs: ['lavabo'],
  },
  {
    key: 'sen-voi',
    label: 'Sen voi',
    categorySlug: 'thiet-bi-ve-sinh',
    subcategorySlugs: ['sen-tam', 'voi-chau'],
  },
  {
    key: 'gach-op-lat',
    label: 'Gach op lat',
    categorySlug: 'gach-op-lat',
    subcategorySlugs: [
      'gach-op-lat',
      'gach-op-tuong',
      'gach-inax-ecocarat',
      'gach-trang-tri',
      'gach-thiet-ke-xi-mang',
      'gach-van-da-marble',
      'gach-van-da-tu-nhien',
      'gach-van-go',
    ],
  },
  {
    key: 'thiet-bi-bep',
    label: 'Thiet bi bep',
    categorySlug: 'thiet-bi-bep',
    subcategorySlugs: [
      'chau-rua-chen',
      'voi-rua-chen',
      'bep-dien-tu',
      'bep-gas',
      'may-hut-mui',
      'may-rua-chen',
      'lo-nuong',
      'phu-kien-bep',
      'phu-kien-chau-rua-chen',
      'thiet-bi-bep-khac',
    ],
  },
  {
    key: 'vat-lieu-nuoc',
    label: 'Vat lieu nuoc',
    categorySlug: 'vat-lieu-nuoc',
    subcategorySlugs: ['loc-nuoc', 'may-nuoc-nong', 'bon-chua-nuoc', 'may-bom-nuoc'],
  },
]

const OUTPUT_DIR = join(process.cwd(), 'docs', 'handoffs')

function sqlList(values: string[]) {
  return values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')
}

function pct(part: number, total: number) {
  if (!total) return 0
  return Number(((part / total) * 100).toFixed(1))
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

async function queryCounts(
  categorySlug: string,
  subSlugs: string[],
  column: string,
  extraWhere = ''
) {
  const rows = await prisma.$queryRawUnsafe<CountRow[]>(`
    select coalesce(${column}::text, '(null)') as key, count(*)::int as count
    from products p
    left join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    where c.slug = '${categorySlug}'
      and s.slug in (${sqlList(subSlugs)})
      ${extraWhere}
    group by 1
    order by count desc, key asc
  `)

  return rows
}

async function queryTopSpecs(categorySlug: string, subSlugs: string[]) {
  return prisma.$queryRawUnsafe<
    Array<{
      label: string
      coverage_count: number
      distinct_values: number
    }>
  >(`
    select
      sd.label as label,
      count(distinct p.id)::int as coverage_count,
      count(distinct coalesce(so.value, psv.value_text, psv.raw_value, '(empty)'))::int as distinct_values
    from product_spec_values psv
    join spec_definitions sd on sd.id = psv.spec_definition_id
    left join spec_options so on so.id = psv.option_id
    join products p on p.id = psv.product_id
    join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    where c.slug = '${categorySlug}'
      and s.slug in (${sqlList(subSlugs)})
      and coalesce(sd.is_pdp_visible, true) = true
    group by sd.label
    order by coverage_count desc, sd.label asc
    limit 20
  `)
}

async function queryFilterDefinitions(categorySlug: string, subSlugs: string[]) {
  return prisma.$queryRawUnsafe<
    Array<{
      filter_key: string
      filter_label: string
      filter_type: string
      sub_slug: string | null
    }>
  >(`
    select
      fd.filter_key,
      fd.filter_label,
      fd.filter_type,
      s.slug as sub_slug
    from filter_definitions fd
    left join categories c on c.id = fd.category_id
    left join subcategories s on s.id = fd.subcategory_id
    where fd.is_active = true
      and (
        c.slug = '${categorySlug}'
        or s.slug in (${sqlList(subSlugs)})
      )
    order by fd.sort_order asc, fd.filter_label asc
  `)
}

async function queryBrands(categorySlug: string, subSlugs: string[]) {
  return prisma.$queryRawUnsafe<Array<{ brand: string; count: number }>>(`
    select b.name as brand, count(*)::int as count
    from products p
    join brands b on b.id = p.brand_id
    join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    where c.slug = '${categorySlug}'
      and s.slug in (${sqlList(subSlugs)})
    group by b.name
    order by count desc, b.name asc
    limit 12
  `)
}

function classifySpec(
  label: string,
  coverageCount: number,
  distinctValues: number,
  publicCount: number
) {
  const coveragePct = pct(coverageCount, publicCount)
  const lower = label.toLowerCase()

  if (coveragePct >= 35 && distinctValues >= 2 && distinctValues <= 12) {
    return 'filter-ready'
  }

  if (
    lower.includes('kích thước') ||
    lower.includes('bao gồm') ||
    lower.includes('quy cách') ||
    lower.includes('trọng lượng')
  ) {
    return 'pdp-only'
  }

  if (coveragePct >= 20) {
    return 'pdp-only'
  }

  return 'not-ready'
}

async function auditGroup(group: GroupConfig) {
  const baseWhere = `
    and publication_status = 'public'
    and pdp_visibility = 'public'
  `

  const [
    totalRows,
    publicRows,
    listingRows,
    searchRows,
    seoRows,
    stockRows,
    productTypeRows,
    productSubTypeRows,
    primaryTaxonRows,
    topSpecs,
    filterDefs,
    brands,
    subcategoryCounts,
    relationCoverageRows,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      select count(*)::int as count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}'
        and s.slug in (${sqlList(group.subcategorySlugs)})
    `),
    prisma.$queryRawUnsafe<Array<{ count: number }>>(`
      select count(*)::int as count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}'
        and s.slug in (${sqlList(group.subcategorySlugs)})
        ${baseWhere}
    `),
    queryCounts(group.categorySlug, group.subcategorySlugs, 'listing_visibility', baseWhere),
    queryCounts(group.categorySlug, group.subcategorySlugs, 'search_visibility', baseWhere),
    prisma.$queryRawUnsafe<Array<{ seo_indexing: string; sitemap_include: boolean; count: number }>>(`
      select seo_indexing, sitemap_include, count(*)::int as count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}'
        and s.slug in (${sqlList(group.subcategorySlugs)})
        ${baseWhere}
      group by seo_indexing, sitemap_include
      order by count desc, seo_indexing asc
    `),
    queryCounts(group.categorySlug, group.subcategorySlugs, 'stock_status', baseWhere),
    queryCounts(group.categorySlug, group.subcategorySlugs, 'product_type', ''),
    queryCounts(group.categorySlug, group.subcategorySlugs, 'product_sub_type', ''),
    prisma.$queryRawUnsafe<Array<{ has_primary_taxon: string; count: number }>>(`
      select
        case when exists (
          select 1
          from product_taxon_assignments pta
          where pta.product_id = p.id
            and pta.is_primary = true
        ) then 'yes' else 'no' end as has_primary_taxon,
        count(*)::int as count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}'
        and s.slug in (${sqlList(group.subcategorySlugs)})
      group by 1
      order by count desc
    `),
    queryTopSpecs(group.categorySlug, group.subcategorySlugs),
    queryFilterDefinitions(group.categorySlug, group.subcategorySlugs),
    queryBrands(group.categorySlug, group.subcategorySlugs),
    prisma.$queryRawUnsafe<Array<{ sub_slug: string; count: number }>>(`
      select s.slug as sub_slug, count(*)::int as count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}'
        and s.slug in (${sqlList(group.subcategorySlugs)})
      group by s.slug
      order by count desc, s.slug asc
    `),
    prisma.$queryRawUnsafe<
      Array<{
        field: string
        populated_count: number
      }>
    >(`
      select 'brand' as field, count(*) filter (where p.brand_id is not null)::int as populated_count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}' and s.slug in (${sqlList(group.subcategorySlugs)})
      union all
      select 'origin' as field, count(*) filter (where p.origin_id is not null)::int as populated_count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}' and s.slug in (${sqlList(group.subcategorySlugs)})
      union all
      select 'color' as field, count(*) filter (where p.color_id is not null)::int as populated_count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}' and s.slug in (${sqlList(group.subcategorySlugs)})
      union all
      select 'material' as field, count(*) filter (where p.material_id is not null)::int as populated_count
      from products p
      join categories c on c.id = p.category_id
      left join subcategories s on s.id = p.subcategory_id
      where c.slug = '${group.categorySlug}' and s.slug in (${sqlList(group.subcategorySlugs)})
    `),
  ])

  const total = totalRows[0]?.count ?? 0
  const publicCount = publicRows[0]?.count ?? 0
  const listingEligible = listingRows
    .filter((row) => ['default', 'low_priority'].includes(row.key ?? ''))
    .reduce((sum, row) => sum + row.count, 0)
  const searchVisible = searchRows
    .filter((row) => row.key === 'visible')
    .reduce((sum, row) => sum + row.count, 0)

  const relationCoverage = Object.fromEntries(
    relationCoverageRows.map((row) => [row.field, { count: row.populated_count, pct: pct(row.populated_count, total) }])
  )

  const specCandidates = topSpecs.map((row) => ({
    label: row.label,
    coverage_count: row.coverage_count,
    coverage_pct: pct(row.coverage_count, publicCount),
    distinct_values: row.distinct_values,
    recommendation: classifySpec(row.label, row.coverage_count, row.distinct_values, publicCount),
  }))

  const filterReadySpecs = specCandidates.filter((row) => row.recommendation === 'filter-ready')
  const pdpOnlySpecs = specCandidates.filter((row) => row.recommendation === 'pdp-only')
  const notReadySpecs = specCandidates.filter((row) => row.recommendation === 'not-ready')

  let status: 'ready-for-backend-refactor' | 'data-cleanup-first' | 'policy-decision-first' = 'ready-for-backend-refactor'
  if (filterReadySpecs.length < 3 || publicCount === 0) status = 'data-cleanup-first'
  if (listingEligible === 0 || searchVisible === 0) status = 'policy-decision-first'
  if (group.key === 'gach-op-lat') status = 'data-cleanup-first'

  return {
    group: group.key,
    label: group.label,
    category_slug: group.categorySlug,
    subcategory_slugs: group.subcategorySlugs,
    totals: {
      total,
      public_pdp: publicCount,
      listing_eligible: listingEligible,
      search_visible: searchVisible,
      search_only_gap: Math.max(searchVisible - listingEligible, 0),
    },
    taxonomy: {
      subcategory_counts: subcategoryCounts,
      product_types: productTypeRows.slice(0, 20),
      product_sub_types: productSubTypeRows.slice(0, 20),
      primary_taxon_coverage: primaryTaxonRows,
    },
    relations: relationCoverage,
    visibility: {
      listing_visibility: listingRows,
      search_visibility: searchRows,
      seo: seoRows,
      stock_status: stockRows,
    },
    attributes: {
      filter_definitions: filterDefs,
      spec_candidates: specCandidates,
      filter_ready_specs: filterReadySpecs,
      pdp_only_specs: pdpOnlySpecs,
      not_ready_specs: notReadySpecs,
      top_brands: brands,
    },
    use_case_layer: {
      modeled: false,
      note: 'Chua co field use-case/intent normalized trong DB hien tai. Can them o phase sau neu muon dung quick chips va merchandising theo nhu cau.',
    },
    recommendation: {
      status,
      note:
        status === 'ready-for-backend-refactor'
          ? 'Du du lieu nen de bat dau refactor helper listing/search/filter.'
          : status === 'data-cleanup-first'
            ? 'Can don data/mapping truoc khi sua UI listing de tranh filter vo nghia.'
            : 'Can chot lai policy visibility truoc khi sua runtime.',
    },
  }
}

function renderMarkdown(report: Awaited<ReturnType<typeof auditGroup>>[]) {
  const lines: string[] = []
  lines.push('# Phase B Audit - Catalog UX + Data')
  lines.push('')
  lines.push('Updated: 2026-07-09')
  lines.push('')
  lines.push('Scope: bon-cau, lavabo, sen-voi, gach-op-lat, thiet-bi-bep, vat-lieu-nuoc')
  lines.push('')

  for (const group of report) {
    lines.push(`## ${group.label}`)
    lines.push('')
    lines.push(`- Category: \`${group.category_slug}\``)
    lines.push(`- Subcategories: \`${group.subcategory_slugs.join('`, `')}\``)
    lines.push(`- Status: \`${group.recommendation.status}\``)
    lines.push(`- Note: ${group.recommendation.note}`)
    lines.push('')
    lines.push('### Totals')
    lines.push('')
    lines.push(`- Total rows: ${group.totals.total}`)
    lines.push(`- Public PDP: ${group.totals.public_pdp}`)
    lines.push(`- Listing eligible: ${group.totals.listing_eligible}`)
    lines.push(`- Search visible: ${group.totals.search_visible}`)
    lines.push(`- Search-only gap: ${group.totals.search_only_gap}`)
    lines.push('')
    lines.push('### Taxonomy inventory')
    lines.push('')
    lines.push(`- Primary taxon coverage: ${group.taxonomy.primary_taxon_coverage.map((row) => `${row.has_primary_taxon}=${row.count}`).join(', ')}`)
    lines.push(`- Product types (top): ${group.taxonomy.product_types.slice(0, 8).map((row) => `${row.key}=${row.count}`).join(', ')}`)
    lines.push(`- Product sub-types (top): ${group.taxonomy.product_sub_types.slice(0, 8).map((row) => `${row.key}=${row.count}`).join(', ')}`)
    lines.push('')
    lines.push('### Visibility inventory')
    lines.push('')
    lines.push(`- listing_visibility: ${group.visibility.listing_visibility.map((row) => `${row.key}=${row.count}`).join(', ')}`)
    lines.push(`- search_visibility: ${group.visibility.search_visibility.map((row) => `${row.key}=${row.count}`).join(', ')}`)
    lines.push(`- stock_status: ${group.visibility.stock_status.map((row) => `${row.key}=${row.count}`).join(', ')}`)
    lines.push(`- seo states: ${group.visibility.seo.map((row) => `${row.seo_indexing}/${row.sitemap_include}=${row.count}`).join(', ')}`)
    lines.push('')
    lines.push('### Attribute inventory')
    lines.push('')
    lines.push(`- Relation coverage: brand=${group.relations.brand.count} (${group.relations.brand.pct}%), origin=${group.relations.origin.count} (${group.relations.origin.pct}%), color=${group.relations.color.count} (${group.relations.color.pct}%), material=${group.relations.material.count} (${group.relations.material.pct}%)`)
    lines.push(`- Filter-ready spec candidates: ${group.attributes.filter_ready_specs.slice(0, 8).map((row) => `${row.label} (${row.coverage_pct}% / ${row.distinct_values} values)`).join('; ') || 'none'}`)
    lines.push(`- PDP-only spec candidates: ${group.attributes.pdp_only_specs.slice(0, 8).map((row) => `${row.label} (${row.coverage_pct}% / ${row.distinct_values} values)`).join('; ') || 'none'}`)
    lines.push(`- Not-ready specs: ${group.attributes.not_ready_specs.slice(0, 6).map((row) => `${row.label} (${row.coverage_pct}% / ${row.distinct_values} values)`).join('; ') || 'none'}`)
    lines.push(`- Existing filter definitions: ${group.attributes.filter_definitions.slice(0, 10).map((row) => `${row.filter_label}[${row.filter_key}]`).join(', ') || 'none'}`)
    lines.push(`- Top brands: ${group.attributes.top_brands.slice(0, 8).map((row) => `${row.brand}=${row.count}`).join(', ') || 'none'}`)
    lines.push('')
    lines.push('### Use-case layer')
    lines.push('')
    lines.push(`- Modeled: ${group.use_case_layer.modeled ? 'yes' : 'no'}`)
    lines.push(`- Note: ${group.use_case_layer.note}`)
    lines.push('')
  }

  return lines.join('\n')
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const report = []
  for (const group of GROUPS) {
    report.push(await auditGroup(group))
  }

  const mdPath = join(OUTPUT_DIR, 'catalog-ux-data-phase-b-audit.md')
  const jsonPath = join(OUTPUT_DIR, 'catalog-ux-data-phase-b-audit.json')
  const csvPath = join(OUTPUT_DIR, 'catalog-ux-data-phase-b-audit-summary.csv')

  writeFileSync(mdPath, `${renderMarkdown(report)}\n`, 'utf8')
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const csvHeaders = [
    'group',
    'category_slug',
    'subcategory_slugs',
    'total',
    'public_pdp',
    'listing_eligible',
    'search_visible',
    'search_only_gap',
    'primary_taxon_yes',
    'primary_taxon_no',
    'status',
    'top_filter_ready_specs',
  ]

  const csvRows = report.map((group) => {
    const yes = group.taxonomy.primary_taxon_coverage.find((row) => row.has_primary_taxon === 'yes')?.count ?? 0
    const no = group.taxonomy.primary_taxon_coverage.find((row) => row.has_primary_taxon === 'no')?.count ?? 0
    return [
      group.group,
      group.category_slug,
      group.subcategory_slugs.join('|'),
      group.totals.total,
      group.totals.public_pdp,
      group.totals.listing_eligible,
      group.totals.search_visible,
      group.totals.search_only_gap,
      yes,
      no,
      group.recommendation.status,
      group.attributes.filter_ready_specs.slice(0, 5).map((row) => row.label).join(' | '),
    ]
  })

  const csv = [csvHeaders, ...csvRows].map((row) => row.map(toCsvCell).join(',')).join('\n')
  writeFileSync(csvPath, `${csv}\n`, 'utf8')

  console.log(JSON.stringify({ mdPath, jsonPath, csvPath }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
