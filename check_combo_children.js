const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const relationships = await prisma.product_relationships.findMany({
    where: { relationship_type: 'component' },
    include: {
      child: true,
      parent: { select: { id: true, name: true, sku: true } }
    }
  });

  console.log(`Total component relationships: ${relationships.length}`);

  let missingPages = 0;
  let missingCategory = 0;
  let notActive = 0;

  for (const rel of relationships) {
    if (!rel.child) continue;
    
    // Check conditions that might mean "no separate page"
    const isActive = rel.child.is_active;
    const hasCategory = rel.child.category_id !== null;
    const hasSubcategory = rel.child.subcategory_id !== null;

    if (!isActive || !hasCategory) {
      missingPages++;
      console.log(`- Child ID: ${rel.child.id} | SKU: ${rel.child.sku} | Name: ${rel.child.name}`);
      console.log(`  > Parent: ${rel.parent.name} (SKU: ${rel.parent.sku})`);
      console.log(`  > is_active: ${isActive}, category_id: ${rel.child.category_id}`);
    }

    if (!isActive) notActive++;
    if (!hasCategory) missingCategory++;
  }

  console.log(`\nSummary:`);
  console.log(`- Child products not active: ${notActive}`);
  console.log(`- Child products missing category: ${missingCategory}`);
  console.log(`- Total distinct child products possibly lacking a separate page: ${missingPages}`);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
