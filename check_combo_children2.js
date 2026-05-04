const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const relationships = await prisma.product_relationships.findMany({
    where: { relationship_type: 'component' },
  });

  console.log(`Total component relationships: ${relationships.length}`);
  
  const nullChildren = relationships.filter(r => !r.child_id);
  console.log(`Relationships with NULL child_id: ${nullChildren.length}`);
  
  if (nullChildren.length > 0) {
    console.log(nullChildren.slice(0, 5));
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
