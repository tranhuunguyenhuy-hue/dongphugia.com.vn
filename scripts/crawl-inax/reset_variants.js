const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== ĐANG UNGROUP TOÀN BỘ BIẾN THỂ TRONG DATABASE ===');
    
    // Cập nhật tất cả sản phẩm: set variant_group = null, is_master = true
    const result = await prisma.products.updateMany({
        where: {
            OR: [
                { variant_group: { not: null } },
                { is_master: false }
            ]
        },
        data: {
            variant_group: null,
            is_master: true
        }
    });

    console.log(`✅ Thành công! Đã ungroup và reset trạng thái is_master cho ${result.count} sản phẩm.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
