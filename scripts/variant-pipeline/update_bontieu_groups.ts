import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updates = [
    // Nhóm USWN900
    { sku: 'USWN900A#XW/HHF90603', newGroup: 'USWN900' },
    { sku: 'USWN900AE#XW/HHF90603', newGroup: 'USWN900' },
    { sku: 'USWN900AS#XW/HHF90603', newGroup: 'USWN900' },
    
    // Nhóm USWN902
    { sku: 'USWN902AEV#XW', newGroup: 'USWN902' },
    { sku: 'USWN902ASV#XW', newGroup: 'USWN902' },
    
    // Nhóm USWN925
    { sku: 'USWN925AEV#XW', newGroup: 'USWN925' },
    
    // Nhóm UT904
    { sku: 'UT904HN#XW', newGroup: 'UT904' },
    { sku: 'UT904HR#XW', newGroup: 'UT904' },
    { sku: 'UT904N#W', newGroup: 'UT904' },
    { sku: 'UT904R#XW', newGroup: 'UT904' },

    // Nhóm UT447
    { sku: 'UT447HR#W', newGroup: 'UT447' },
    { sku: 'UT447S#W', newGroup: 'UT447' }
  ];

  console.log('🔄 Bắt đầu cập nhật Variant Group cho danh mục Bồn Tiểu...');
  
  for (const { sku, newGroup } of updates) {
    const product = await prisma.products.findFirst({ where: { sku } });
    if (product) {
      await prisma.products.update({
        where: { id: product.id },
        data: { variant_group: newGroup }
      });
      console.log(`✅ Cập nhật SKU: ${sku} -> Variant Group mới: ${newGroup}`);
    } else {
      console.log(`❌ Không tìm thấy SKU: ${sku}`);
    }
  }

  console.log('🎉 Hoàn tất cập nhật!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
