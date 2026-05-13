const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.products.findFirst({
    where: {
      sku: {
        contains: 'MS636CDRW23'
      }
    },
    select: {
      sku: true,
      name: true,
      specs: true,
      is_combo: true,
      parent_relationships: {
        include: {
          child: {
            select: {
              sku: true,
              specs: true
            }
          }
        }
      }
    }
  });

  if (product) {
    console.log("SKU:", product.sku);
    console.log("Specs:", JSON.stringify(product.specs, null, 2));
    if (product.parent_relationships && product.parent_relationships.length > 0) {
      console.log("\nThis is a combo product. Checking child specs:");
      for (const rel of product.parent_relationships) {
        if (rel.child) {
          console.log(`\nChild SKU: ${rel.child.sku}`);
          console.log(`Child Specs:`, JSON.stringify(rel.child.specs, null, 2));
        } else {
          console.log(`\nChild SKU: ${rel.child_sku} (NOT FOUND IN DB)`);
        }
      }
    }
  } else {
    console.log("Product not found");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
