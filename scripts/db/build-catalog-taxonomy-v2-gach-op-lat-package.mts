import fs from 'fs'
import path from 'path'

import { parse } from 'csv-parse/sync'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INPUT_CSV = path.resolve(
  process.cwd(),
  'docs/handoffs/catalog-taxonomy-v2-legacy-migration-69-cases.csv'
)
const OUTPUT_DIR = path.resolve(process.cwd(), 'scripts/output')
const PACKAGE_PREFIX = 'catalog-taxonomy-v2-gach-op-lat54'

type CsvRow = {
  migration_group: string
  old_root: string
  old_subcategory: string
  slug: string
  new_root: string
  new_subcategory: string
  old_url: string
  new_url: string
  product_id: string
  sku: string
  current_category_slug: string
  current_subcategory_slug: string
  target_taxonomy_path: string
  publication_status: string
  pdp_visibility: string
  listing_visibility: string
  seo_indexing: string
  sitemap_include: string
  search_state: string
  notes: string
  name: string
  current_category_name: string
  current_subcategory_name: string
  current_product_type: string
  current_product_sub_type: string
  target_taxon_slug: string
  target_taxon_name: string
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
}

type PackageRow = {
  productId: number
  sku: string
  name: string
  oldUrl: string
  newUrl: string
  currentCategoryId: number
  currentSubcategoryId: number | null
  currentCategorySlug: string | null
  currentSubcategorySlug: string | null
  targetCategoryId: number
  targetSubcategoryId: number
  targetSubcategorySlug: string
  targetTaxonomyPath: string
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`
}

function sqlNullableInt(value: number | null) {
  return value === null ? 'null' : String(value)
}

function readCsvRows(): CsvRow[] {
  const raw = fs.readFileSync(INPUT_CSV, 'utf8')
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[]
}

function writeFile(fileName: string, content: string) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT_DIR, fileName), content)
}

function buildValues(rows: PackageRow[]) {
  return rows
    .map(
      (row) =>
        `  (${row.productId}, ${sqlString(row.sku)}, ${row.currentCategoryId}, ${sqlNullableInt(
          row.currentSubcategoryId
        )}, ${row.targetCategoryId}, ${row.targetSubcategoryId}, ${sqlString(
          row.targetSubcategorySlug
        )}, ${sqlString(row.oldUrl)}, ${sqlString(row.newUrl)})`
    )
    .join(',\n')
}

function buildPreflightSql(rows: PackageRow[]) {
  const values = buildValues(rows)
  return `\\set ON_ERROR_STOP on

begin;

create temp table target_rows (
  product_id integer primary key,
  sku text not null,
  old_category_id integer not null,
  old_subcategory_id integer null,
  target_category_id integer not null,
  target_subcategory_id integer not null,
  target_subcategory_slug text not null,
  old_url text not null,
  expected_new_url text not null
) on commit drop;

insert into target_rows (
  product_id,
  sku,
  old_category_id,
  old_subcategory_id,
  target_category_id,
  target_subcategory_id,
  target_subcategory_slug,
  old_url,
  expected_new_url
) values
${values};

do $$
declare
  target_count integer;
  matched_count integer;
begin
  select count(*) into target_count from target_rows;
  if target_count <> ${rows.length} then
    raise exception 'Expected ${rows.length} target rows, got %', target_count;
  end if;

  select count(*)
  into matched_count
  from products p
  join target_rows t on t.product_id = p.id
  where p.sku = t.sku
    and p.category_id = t.old_category_id
    and coalesce(p.subcategory_id, -1) = coalesce(t.old_subcategory_id, -1);

  if matched_count <> ${rows.length} then
    raise exception 'Scope lock failed: expected ${rows.length} exact old-state matches, got %', matched_count;
  end if;
end $$;

select
  p.id as product_id,
  p.sku,
  p.category_id as old_category_id,
  p.subcategory_id as old_subcategory_id,
  t.target_category_id,
  t.target_subcategory_id,
  t.target_subcategory_slug
from products p
join target_rows t on t.product_id = p.id
order by p.id;

rollback;
`
}

function buildExecuteSql(rows: PackageRow[]) {
  const values = buildValues(rows)
  return `\\set ON_ERROR_STOP on

begin;

create temp table target_rows (
  product_id integer primary key,
  sku text not null,
  old_category_id integer not null,
  old_subcategory_id integer null,
  target_category_id integer not null,
  target_subcategory_id integer not null,
  target_subcategory_slug text not null,
  old_url text not null,
  expected_new_url text not null
) on commit drop;

insert into target_rows (
  product_id,
  sku,
  old_category_id,
  old_subcategory_id,
  target_category_id,
  target_subcategory_id,
  target_subcategory_slug,
  old_url,
  expected_new_url
) values
${values};

create temp table updated_rows on commit drop as
with updated as (
  update products p
  set category_id = t.target_category_id,
      subcategory_id = t.target_subcategory_id,
      updated_at = now()
  from target_rows t
  where p.id = t.product_id
    and p.sku = t.sku
    and p.category_id = t.old_category_id
    and coalesce(p.subcategory_id, -1) = coalesce(t.old_subcategory_id, -1)
  returning p.id
)
select id as product_id
from updated;

do $$
declare
  updated_count integer;
begin
  select count(*) into updated_count from updated_rows;
  if updated_count <> ${rows.length} then
    raise exception 'Expected to update ${rows.length} rows, updated %', updated_count;
  end if;
end $$;

select
  p.id as product_id,
  p.sku,
  p.category_id,
  p.subcategory_id
from products p
join target_rows t on t.product_id = p.id
order by p.id;

commit;
`
}

function buildRollbackSql(rows: PackageRow[]) {
  const values = rows
    .map(
      (row) =>
        `  (${row.productId}, ${sqlString(row.sku)}, ${row.currentCategoryId}, ${sqlNullableInt(
          row.currentSubcategoryId
        )})`
    )
    .join(',\n')

  return `\\set ON_ERROR_STOP on

begin;

create temp table rollback_rows (
  product_id integer primary key,
  sku text not null,
  rollback_category_id integer not null,
  rollback_subcategory_id integer null
) on commit drop;

insert into rollback_rows (
  product_id,
  sku,
  rollback_category_id,
  rollback_subcategory_id
) values
${values};

create temp table rolled_back_rows on commit drop as
with rolled_back as (
  update products p
  set category_id = r.rollback_category_id,
      subcategory_id = r.rollback_subcategory_id,
      updated_at = now()
  from rollback_rows r
  where p.id = r.product_id
    and p.sku = r.sku
  returning p.id
)
select id as product_id
from rolled_back;

do $$
declare
  updated_count integer;
begin
  select count(*) into updated_count from rolled_back_rows;
  if updated_count <> ${rows.length} then
    raise exception 'Expected to rollback ${rows.length} rows, rolled back %', updated_count;
  end if;
end $$;

commit;
`
}

async function main() {
  const rows = readCsvRows().filter(
    (row) => row.migration_group === 'thiet-bi-ve-sinh -> gach-op-lat'
  )

  const targetCategory = await prisma.categories.findFirst({
    where: { slug: 'gach-op-lat' },
    select: { id: true, slug: true },
  })
  if (!targetCategory) throw new Error('Missing category gach-op-lat')

  const targetSubcategories = await prisma.subcategories.findMany({
    where: {
      category_id: targetCategory.id,
      slug: { in: ['gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat'] },
    },
    select: { id: true, slug: true },
  })

  const targetSubcategoryMap = new Map(targetSubcategories.map((row) => [row.slug, row.id]))
  for (const slug of ['gach-op-lat', 'gach-op-tuong', 'gach-inax-ecocarat']) {
    if (!targetSubcategoryMap.has(slug)) {
      throw new Error(`Missing target subcategory ${slug}`)
    }
  }

  const products = await prisma.products.findMany({
    where: { id: { in: rows.map((row) => Number(row.product_id)) } },
    select: {
      id: true,
      sku: true,
      name: true,
      slug: true,
      category_id: true,
      subcategory_id: true,
      categories: { select: { slug: true } },
      subcategories: { select: { slug: true } },
    },
  })

  const productMap = new Map(products.map((row) => [row.id, row]))
  const packageRows: PackageRow[] = rows.map((row) => {
    const productId = Number(row.product_id)
    const product = productMap.get(productId)
    if (!product) throw new Error(`Missing product ${productId}`)
    const targetSubcategoryId = targetSubcategoryMap.get(row.new_subcategory)
    if (!targetSubcategoryId) {
      throw new Error(`No target subcategory id for ${row.new_subcategory}`)
    }

    return {
      productId,
      sku: product.sku,
      name: product.name,
      oldUrl: row.old_url,
      newUrl: row.new_url,
      currentCategoryId: product.category_id,
      currentSubcategoryId: product.subcategory_id,
      currentCategorySlug: product.categories?.slug ?? null,
      currentSubcategorySlug: product.subcategories?.slug ?? null,
      targetCategoryId: targetCategory.id,
      targetSubcategoryId,
      targetSubcategorySlug: row.new_subcategory,
      targetTaxonomyPath: row.target_taxonomy_path,
    }
  })

  packageRows.sort((a, b) => a.productId - b.productId)

  writeFile(`${PACKAGE_PREFIX}-preflight.sql`, buildPreflightSql(packageRows))
  writeFile(`${PACKAGE_PREFIX}-execute.sql`, buildExecuteSql(packageRows))
  writeFile(`${PACKAGE_PREFIX}-rollback.sql`, buildRollbackSql(packageRows))
  writeFile(
    `${PACKAGE_PREFIX}.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: packageRows.length,
        targetCategoryId: targetCategory.id,
        targetSubcategoryMap: Object.fromEntries(targetSubcategoryMap),
        rows: packageRows,
      },
      null,
      2
    )
  )
  writeFile(
    `${PACKAGE_PREFIX}.md`,
    [
      '# Catalog Taxonomy v2 Gach Op Lat Legacy Package',
      '',
      `- Rows: \`${packageRows.length}\``,
      `- Target category: \`${targetCategory.slug}\` (\`${targetCategory.id}\`)`,
      `- Target subcategories: \`${JSON.stringify(Object.fromEntries(targetSubcategoryMap))}\``,
      '',
      'Generated files:',
      `- \`${PACKAGE_PREFIX}-preflight.sql\``,
      `- \`${PACKAGE_PREFIX}-execute.sql\``,
      `- \`${PACKAGE_PREFIX}-rollback.sql\``,
      `- \`${PACKAGE_PREFIX}.json\``,
      '',
      'Sample rows:',
      ...packageRows.slice(0, 10).map(
        (row) =>
          `- ${row.productId} | ${row.sku} | ${row.currentCategorySlug}/${row.currentSubcategorySlug ?? 'null'} -> gach-op-lat/${row.targetSubcategorySlug}`
      ),
    ].join('\n')
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        count: packageRows.length,
        outputDir: OUTPUT_DIR,
        packagePrefix: PACKAGE_PREFIX,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
