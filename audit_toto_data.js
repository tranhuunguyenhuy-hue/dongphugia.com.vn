const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } });
  
  const products = await prisma.products.findMany({
    where: { brand_id: brand.id },
    include: {
      product_images: true
    },
    take: 1000 // Sample 1000 products
  });

  const stats = {
    total: products.length,
    missingDescription: 0,
    missingSpecs: 0,
    missingDrawingImage: 0,
    hasPdfManuals: 0,
    hasInstallationGuides: 0,
    hasFeatures: 0
  };

  products.forEach(p => {
    if (!p.description || p.description.length < 50) stats.missingDescription++;
    
    let specsObj = typeof p.specs === 'object' ? p.specs : {};
    if (!specsObj || Object.keys(specsObj).length === 0) {
      stats.missingSpecs++;
    } else {
       // Check for documents in specs
       const specsStr = JSON.stringify(specsObj).toLowerCase();
       if (specsStr.includes('.pdf') || specsStr.includes('hướng dẫn')) {
           stats.hasPdfManuals++;
       }
    }

    // Check images for drawing
    const hasDrawing = p.product_images.some(img => img.image_type === 'drawing' || img.image_url.toLowerCase().includes('ban-ve'));
    if (!hasDrawing) stats.missingDrawingImage++;

  });

  console.log("=== TOTO PRODUCTS DATA AUDIT (Sample: 1000 items) ===");
  console.log(`Total checked: ${stats.total}`);
  console.log(`Missing Description: ${stats.missingDescription} (${(stats.missingDescription/stats.total*100).toFixed(1)}%)`);
  console.log(`Missing Specs: ${stats.missingSpecs} (${(stats.missingSpecs/stats.total*100).toFixed(1)}%)`);
  console.log(`Missing Technical Drawing Image: ${stats.missingDrawingImage} (${(stats.missingDrawingImage/stats.total*100).toFixed(1)}%)`);
  console.log(`Has PDF Manuals / Docs in specs: ${stats.hasPdfManuals} (${(stats.hasPdfManuals/stats.total*100).toFixed(1)}%)`);
}

run().finally(() => prisma.$disconnect());
