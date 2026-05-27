import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  const isExecute = process.argv.includes('--execute');
  const csvPath = path.join(__dirname, '../../TOTO - TOTO.csv.csv');
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  TOTO CSV VARIANT IMPORT — ${isExecute ? '🚀 EXECUTE' : '🔍 DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Reading CSV: ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  
  // Parse CSV
  const records: any[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  let matchCount = 0;
  let updateCount = 0;
  let missingSkus: string[] = [];
  let totalProcessed = 0;
  
  const categoryStats: Record<string, { matched: number; expectedUpdate: number }> = {};
  const skuToCategory: Record<string, string> = {};
  
  for (const record of records as Record<string, string>[]) {
    const sku = record['Mã SP (SKU)'];
    const cat2 = record['Danh mục Cấp 2'];
    const variantGroup = record['Nhóm gia đình'];
    const brand = record['Thương hiệu'];
    
    if (brand !== 'TOTO') continue;
    if (!sku || !variantGroup || !cat2) continue;
    
    totalProcessed++;
    if (!categoryStats[cat2]) {
      categoryStats[cat2] = { matched: 0, expectedUpdate: 0 };
    }

    // Check DB
    const product = await prisma.products.findFirst({
      where: { sku: sku },
      select: { id: true, variant_group: true }
    });

    if (product) {
      matchCount++;
      categoryStats[cat2].matched++;
      skuToCategory[sku] = cat2;
      
      if (product.variant_group !== variantGroup) {
        if (isExecute) {
          await prisma.products.update({
            where: { id: product.id },
            data: { variant_group: variantGroup }
          });
        }
        updateCount++;
        categoryStats[cat2].expectedUpdate++;
      }
    } else {
      missingSkus.push(sku);
    }
    
    if (totalProcessed % 200 === 0) {
      console.log(`... Processed ${totalProcessed} valid records so far`);
    }
  }

  console.log(`\n${'-'.repeat(60)}`);
  console.log(`Total TOTO records processed from CSV: ${totalProcessed}`);
  console.log(`Matched in Database: ${matchCount}`);
  console.log(`Missing in Database: ${missingSkus.length}`);
  
  console.log(`\n📊 Expected Updates by Category:`);
  for (const [cat, stats] of Object.entries(categoryStats)) {
    console.log(`  - ${cat}: ${stats.expectedUpdate} expected updates (out of ${stats.matched} matched)`);
  }

  if (missingSkus.length > 0) {
    console.log(`\nFirst 10 missing SKUs:`, missingSkus.slice(0, 10));
  }

  if (isExecute) {
    console.log(`\n✅ Successfully updated ${updateCount} records in the database.`);
  } else {
    console.log(`\n⚠️ DRY RUN complete. Expected updates: ${updateCount}. Run with --execute to apply changes and export CSV.`);
  }
  
  if (isExecute) {
    const skusToExport = Object.keys(skuToCategory);
    
    // Fetch tracked TOTO products to export
    const allTotoProducts = await prisma.products.findMany({
      where: {
        sku: { in: skusToExport }
      },
      select: {
        sku: true,
        name: true,
        variant_group: true,
        is_combo: true,
        is_master: true,
        categories: { select: { name: true } },
        subcategories: { select: { name: true } },
        product_type: true
      },
      orderBy: { sku: 'asc' }
    });

    // Group by CSV category
    const groupedProducts = allTotoProducts.reduce((acc, product) => {
      const csvCat = skuToCategory[product.sku || ''] || 'uncategorized';
      const cleanSlug = csvCat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (!acc[cleanSlug]) acc[cleanSlug] = [];
      acc[cleanSlug].push(product);
      return acc;
    }, {} as Record<string, typeof allTotoProducts>);

    console.log(`\n📄 Exporting verification CSVs...`);
    for (const [catSlug, products] of Object.entries(groupedProducts)) {
      if (products.length === 0) continue;
      
      const exportPath = path.join(__dirname, `../../export_toto_${catSlug}_variants.csv`);
      const csvLines = ['SKU,Name,Variant_Group,Is_Combo,Is_Master,Category_Path'];
      
      for (const p of products) {
        const escapedName = p.name ? p.name.replace(/"/g, '""') : '';
        const cat1 = p.categories?.name || '';
        const cat2 = p.subcategories?.name || '';
        const cat3 = p.product_type || '';
        const catPath = `${cat1}/${cat2}/${cat3}`;
        csvLines.push(`"${p.sku}","${escapedName}","${p.variant_group || ''}",${p.is_combo},${p.is_master},"${catPath}"`);
      }
      
      fs.writeFileSync(exportPath, csvLines.join('\n'), 'utf8');
      console.log(`   - Created: ${exportPath} (${products.length} products)`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
