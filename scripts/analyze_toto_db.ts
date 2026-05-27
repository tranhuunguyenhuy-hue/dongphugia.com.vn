import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brand = await prisma.brands.findFirst({
    where: { name: { contains: 'TOTO', mode: 'insensitive' } }
  });

  if (!brand) {
    console.log('TOTO brand not found.');
    return;
  }

  const crawledCount = await prisma.products.count({
    where: { 
      brand_id: brand.id,
      source_url: {
        contains: 'hita',
        mode: 'insensitive'
      }
    }
  });

  const notCrawledCount = await prisma.products.count({
    where: {
      brand_id: brand.id,
      OR: [
        { source_url: null },
        { source_url: { not: { contains: 'hita' } } }
      ]
    }
  });
  console.log(`Number of TOTO products NOT from Hita: ${notCrawledCount}`);
  
  // Sample of crawled products
  const sample = await prisma.products.findFirst({
     where: { 
       brand_id: brand.id,
       source_url: {
         contains: 'hita',
         mode: 'insensitive'
       }
     },
     orderBy: { updated_at: 'desc' }
  });
  
  if (sample) {
    console.log('\nSample crawled product info:');
    console.log(`- ID: ${sample.id}`);
    console.log(`- Name: ${sample.name}`);
    console.log(`- Source URL: ${sample.source_url}`);
    console.log(`- Updated At: ${sample.updated_at}`);
  }

  // Count relationships (combos)
  const comboRels = await prisma.product_relationships.count({
    where: {
      parent: {
        brand_id: brand.id
      }
    }
  });
  console.log(`\nNumber of combo relationships for TOTO: ${comboRels}`);

}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
