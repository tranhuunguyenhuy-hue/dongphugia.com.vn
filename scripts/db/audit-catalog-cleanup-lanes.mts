import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import prismaModule from '@/lib/prisma'

const prisma = ((prismaModule as { default?: unknown }).default ??
  prismaModule) as {
  $queryRawUnsafe: <T = unknown>(query: string) => Promise<T>
  $disconnect: () => Promise<void>
}

const OUTPUT_DIR = join(process.cwd(), 'docs', 'handoffs')

type CandidateRow = {
  product_id: number
  sku: string | null
  name: string
  category_slug: string
  subcategory_slug: string | null
  brand_name: string | null
  product_type: string | null
  product_sub_type: string | null
  publication_status: string | null
  pdp_visibility: string | null
  listing_visibility: string | null
  search_visibility: string | null
  seo_indexing: string | null
  sitemap_include: boolean | null
  stock_status: string | null
  has_primary_taxon: boolean
}

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

async function queryVatLieuNuocCandidates() {
  return prisma.$queryRawUnsafe<CandidateRow[]>(`
    select
      p.id as product_id,
      p.sku,
      p.name,
      c.slug as category_slug,
      s.slug as subcategory_slug,
      b.name as brand_name,
      p.product_type,
      p.product_sub_type,
      p.publication_status,
      p.pdp_visibility,
      p.listing_visibility,
      p.search_visibility,
      p.seo_indexing,
      p.sitemap_include,
      p.stock_status,
      exists (
        select 1
        from product_taxon_assignments pta
        where pta.product_id = p.id
          and pta.is_primary = true
      ) as has_primary_taxon
    from products p
    join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    left join brands b on b.id = p.brand_id
    where c.slug = 'vat-lieu-nuoc'
      and p.product_type is null
    order by s.slug asc nulls last, b.name asc nulls last, p.name asc
  `)
}

async function queryGachOpLatCandidates() {
  return prisma.$queryRawUnsafe<CandidateRow[]>(`
    select
      p.id as product_id,
      p.sku,
      p.name,
      c.slug as category_slug,
      s.slug as subcategory_slug,
      b.name as brand_name,
      p.product_type,
      p.product_sub_type,
      p.publication_status,
      p.pdp_visibility,
      p.listing_visibility,
      p.search_visibility,
      p.seo_indexing,
      p.sitemap_include,
      p.stock_status,
      exists (
        select 1
        from product_taxon_assignments pta
        where pta.product_id = p.id
          and pta.is_primary = true
      ) as has_primary_taxon
    from products p
    join categories c on c.id = p.category_id
    left join subcategories s on s.id = p.subcategory_id
    left join brands b on b.id = p.brand_id
    where c.slug = 'gach-op-lat'
      and (
        p.product_type is null
        or not exists (
          select 1
          from product_taxon_assignments pta
          where pta.product_id = p.id
            and pta.is_primary = true
        )
      )
    order by s.slug asc nulls last, b.name asc nulls last, p.name asc
  `)
}

function groupCounts(rows: CandidateRow[], field: keyof CandidateRow) {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = String(row[field] ?? '(null)')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function renderSection(title: string, rows: CandidateRow[], notes: string[]) {
  const lines: string[] = []
  lines.push(`## ${title}`)
  lines.push('')
  lines.push(`- Candidate rows: ${rows.length}`)
  lines.push(`- Missing product_type: ${rows.filter((row) => !row.product_type).length}`)
  lines.push(`- Missing primary taxon: ${rows.filter((row) => !row.has_primary_taxon).length}`)
  lines.push(`- Public PDP rows: ${rows.filter((row) => row.publication_status === 'public' && row.pdp_visibility === 'public').length}`)
  lines.push(`- Listing-visible rows: ${rows.filter((row) => ['default', 'low_priority'].includes(row.listing_visibility ?? '')).length}`)
  lines.push('')
  lines.push('### Breakdown by subcategory')
  lines.push('')
  for (const [key, count] of groupCounts(rows, 'subcategory_slug')) {
    lines.push(`- ${key}: ${count}`)
  }
  lines.push('')
  lines.push('### Breakdown by brand')
  lines.push('')
  for (const [key, count] of groupCounts(rows, 'brand_name').slice(0, 12)) {
    lines.push(`- ${key}: ${count}`)
  }
  lines.push('')
  lines.push('### Notes')
  lines.push('')
  for (const note of notes) {
    lines.push(`- ${note}`)
  }
  lines.push('')
  lines.push('### Sample rows')
  lines.push('')
  for (const row of rows.slice(0, 12)) {
    lines.push(
      `- [${row.product_id}] ${row.sku ?? '(no sku)'} | ${row.subcategory_slug ?? '(null)'} | ${row.brand_name ?? '(no brand)'} | type=${row.product_type ?? '(null)'} | primary_taxon=${row.has_primary_taxon ? 'yes' : 'no'} | ${row.name}`
    )
  }
  lines.push('')
  return lines.join('\n')
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const [vatLieuNuocRows, gachOpLatRows] = await Promise.all([
    queryVatLieuNuocCandidates(),
    queryGachOpLatCandidates(),
  ])

  const md = [
    '# Catalog Cleanup Lanes',
    '',
    'Updated: 2026-07-09',
    '',
    'This report turns the remaining weak data lanes into execution-ready cleanup buckets.',
    '',
    renderSection('Vật liệu nước', vatLieuNuocRows, [
      'Ưu tiên 1: fill product_type cho máy nước nóng, máy lọc nước, bồn chứa nước, máy bơm nước.',
      'Ưu tiên 2: sau khi có product_type, mới cân nhắc mở product-type UI hoặc spec filters.',
      'Hiện không nên bật spec filter runtime cho lane này.',
    ]),
    renderSection('Gạch ốp lát', gachOpLatRows, [
      'Ưu tiên 1: backfill primary taxon cho toàn bộ rows còn thiếu.',
      'Ưu tiên 2: xác định có cần product_type riêng cho từng line gạch hay chỉ bám subcategory/taxon leaf.',
      'Hiện không nên bật spec filter UX sâu cho lane này dù đã có một vài spec candidate.',
    ]),
  ].join('\n')

  const csvHeaders = [
    'lane',
    'product_id',
    'sku',
    'name',
    'category_slug',
    'subcategory_slug',
    'brand_name',
    'product_type',
    'product_sub_type',
    'publication_status',
    'pdp_visibility',
    'listing_visibility',
    'search_visibility',
    'seo_indexing',
    'sitemap_include',
    'stock_status',
    'has_primary_taxon',
  ]

  const allRows = [
    ...vatLieuNuocRows.map((row) => ({ lane: 'vat-lieu-nuoc', ...row })),
    ...gachOpLatRows.map((row) => ({ lane: 'gach-op-lat', ...row })),
  ]

  const csv = [csvHeaders, ...allRows.map((row) => [
    row.lane,
    row.product_id,
    row.sku,
    row.name,
    row.category_slug,
    row.subcategory_slug,
    row.brand_name,
    row.product_type,
    row.product_sub_type,
    row.publication_status,
    row.pdp_visibility,
    row.listing_visibility,
    row.search_visibility,
    row.seo_indexing,
    row.sitemap_include,
    row.stock_status,
    row.has_primary_taxon,
  ])]
    .map((row) => row.map(toCsvCell).join(','))
    .join('\n')

  const mdPath = join(OUTPUT_DIR, 'catalog-ux-data-cleanup-lanes.md')
  const csvPath = join(OUTPUT_DIR, 'catalog-ux-data-cleanup-lanes.csv')

  writeFileSync(mdPath, `${md}\n`, 'utf8')
  writeFileSync(csvPath, `${csv}\n`, 'utf8')

  console.log(JSON.stringify({
    mdPath,
    csvPath,
    vatLieuNuocCandidates: vatLieuNuocRows.length,
    gachOpLatCandidates: gachOpLatRows.length,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
