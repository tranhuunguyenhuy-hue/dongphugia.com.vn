const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== BẮT ĐẦU CLEANUP MÃ SKU INAX ===');

    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        select: { id: true, sku: true, name: true, source_url: true }
    });

    let successCount = 0;
    let duplicateCount = 0;
    const updates = [];

    for (const p of products) {
        if (!p.sku) continue;
        
        let originalSku = p.sku;
        let newSku = originalSku;

        const inaxMatch = newSku.match(/-(INAX)-/i);
        if (inaxMatch) {
            newSku = newSku.substring(inaxMatch.index + 6).trim();
        }

        const garbagePrefixes = [
            'BON-CAU-1-KHOI-', 'BON-CAU-2-KHOI-', 'BON-CAU-TREO-TUONG-', 'BON-CAU-THONG-MINH-', 'BON-CAU-',
            'LAVABO-DAT-BAN-', 'LAVABO-TREO-TUONG-', 'LAVABO-AM-BAN-', 'LAVABO-',
            'SEN-TAM-', 'VOI-CHAU-', 'VOI-RUA-CHEN-', 'BON-TAM-', 'BON-TIEU-',
            'PHEU-THOAT-SAN-', 'ONG-THAI-', 'ONG-XA-', 'HOP-DUNG-GIAY-', 'PHU-KIEN-'
        ];

        for (const prefix of garbagePrefixes) {
            if (newSku.toUpperCase().startsWith(prefix)) {
                newSku = newSku.substring(prefix.length).trim();
            }
        }

        if (newSku !== originalSku && newSku.length > 1) {
            newSku = newSku.toUpperCase();
            updates.push({ id: p.id, originalSku, newSku, name: p.name });
        }
    }

    if (updates.length > 0) {
        console.log(`\nĐang tiến hành Update ${updates.length} records vào Database...`);
        for (const update of updates) {
            try {
                await prisma.products.update({
                    where: { id: update.id },
                    data: { sku: update.newSku }
                });
                console.log(`✅ Cập nhật: ${update.originalSku} => ${update.newSku}`);
                successCount++;
            } catch (e: any) {
                if (e.code === 'P2002') {
                    console.log(`⚠️ Trùng lặp (P2002): Không thể đổi ${update.originalSku} thành ${update.newSku} vì đã tồn tại! Đang xóa bản nháp rác này...`);
                    // Xóa bản rác đi vì nó là duplicate
                    await prisma.products.delete({ where: { id: update.id } });
                    console.log(`🗑️ Đã xóa sản phẩm rác ID ${update.id}`);
                    duplicateCount++;
                } else {
                    console.error(`❌ Lỗi update ${update.originalSku}:`, e.message);
                }
            }
        }
        console.log(`\n🎉 HOÀN THÀNH! Thành công: ${successCount} | Xóa rác trùng lặp: ${duplicateCount}`);
    } else {
        console.log(`✅ Không tìm thấy SKU rác nào cần dọn dẹp.`);
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
