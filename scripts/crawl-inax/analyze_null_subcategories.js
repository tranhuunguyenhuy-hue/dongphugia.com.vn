const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nullSubcats = await prisma.products.findMany({
    where: {
      brands: { slug: 'inax' },
      subcategory_id: null
    },
    take: 20,
    select: {
      id: true,
      name: true,
      specs: true,
      source_url: true,
      description: true
    }
  });

  console.log('=== PHÂN TÍCH 20 SẢN PHẨM BỊ NULL SUBCATEGORY_ID ===');
  nullSubcats.forEach((p, i) => {
    console.log(`${i+1}. [ID: ${p.id}] ${p.name}`);
    console.log(`   - Specs: ${JSON.stringify(p.specs)}`);
    console.log(`   - Source URL: ${p.source_url}`);
    
    // Thử trích xuất từ description nếu có thông tin "Sản phẩm thuộc nhóm"
    const matchGroup = p.description ? p.description.match(/Sản phẩm thuộc nhóm:.*href=".*">(.*)<\/a>/i) : null;
    console.log(`   - Description Group Match: ${matchGroup ? matchGroup[1] : 'Không tìm thấy'}`);
    console.log('');
  });
}

main().finally(() => prisma.$disconnect());
