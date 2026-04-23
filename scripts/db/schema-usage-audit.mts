import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Feature system usage
  const featureCount = await p.product_features.count();
  const pfvCount = await p.product_feature_values.count();
  const filterDefs = await p.filter_definitions.count();
  const productsWithPFV = await p.products.count({
    where: { product_feature_values: { some: {} } }
  });

  // Specs JSON
  const totalActive = await p.products.count({ where: { is_active: true } });
  const specsNotEmpty = await p.products.count({
    where: { is_active: true, NOT: { specs: {} } }
  });
  const withProductType = await p.products.count({
    where: { is_active: true, product_type: { not: null } }
  });

  // Filter definitions sample
  const filters = await p.filter_definitions.findMany({ take: 10 });

  // product_features list  
  const features = await p.product_features.findMany({
    select: { id: true, name: true, slug: true, _count: { select: { product_feature_values: true } } },
    orderBy: { id: 'asc' },
    take: 20
  });

  // Check slug uniqueness issue in products
  const dupSlugs = await p.$queryRaw`
    SELECT slug, category_id, COUNT(*) as cnt 
    FROM products 
    WHERE is_active = true 
    GROUP BY slug, category_id 
    HAVING COUNT(*) > 1 
    LIMIT 5
  ` as any[];

  // Check products without slug
  const noSlug = await p.products.count({ where: { is_active: true, slug: '' } });

  // Check product_type index coverage (is there an index?)
  const productTypeIndex = await p.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'products' 
    ORDER BY indexname
  ` as any[];

  console.log('\n=== SCHEMA USAGE AUDIT ===\n');
  console.log('FEATURE SYSTEM:');
  console.log(`  product_features defined:  ${featureCount}`);
  console.log(`  product_feature_values:    ${pfvCount} values`);
  console.log(`  Products using features:   ${productsWithPFV}/${totalActive}`);
  console.log(`  filter_definitions:        ${filterDefs} rows`);
  console.log('\nDATA QUALITY:');
  console.log(`  specs JSON populated:      ${specsNotEmpty}/${totalActive}`);
  console.log(`  product_type populated:    ${withProductType}/${totalActive} (${Math.round(withProductType/totalActive*100)}%)`);
  console.log(`  Products with empty slug:  ${noSlug}`);
  console.log(`  Duplicate slugs:           ${dupSlugs.length} groups`);

  console.log('\nFEATURES DEFINED:');
  features.forEach(f => console.log(`  [${f._count.product_feature_values.toString().padStart(4)} values] ${f.slug}: ${f.name}`));

  console.log('\nFILTER DEFINITIONS:');
  if (filters.length === 0) {
    console.log('  ⚠️  EMPTY — nobody has populated filter_definitions!');
  } else {
    filters.forEach(f => console.log(`  cat=${f.category_id} sub=${f.subcategory_id} key=${f.filter_key} label=${f.filter_label}`));
  }

  console.log('\nDB INDEXES ON products:');
  productTypeIndex.forEach((idx: any) => console.log(`  ${idx.indexname}`));
}
main().catch(console.error).finally(() => p.$disconnect());
