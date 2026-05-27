const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== BẮT ĐẦU GOM NHÓM BIẾN THỂ (VARIANT GROUPING) CHO INAX ===');

    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        select: { id: true, sku: true, name: true, product_type: true }
    });

    const groups = {};

    for (const p of products) {
        let core = p.sku; // Mặc định core là chính nó

        // Regex chung: Bắt "Chữ cái" - "Số". VD: AC-504, LFV-1112, BFV-3415
        // Nó sẽ tự động tách phần hậu tố chữ/tính năng phía sau số (như S, C, VAN, VRN, VFC...)
        const match = p.sku.match(/^([A-Za-z]+-\d+)/);
        
        if (match) {
            core = match[1];
        } else {
            // Đối với các mã đặc biệt không có dấu gạch ngang giữa chữ và số, VD: A703
            const match2 = p.sku.match(/^([A-Za-z]+\d+)/);
            if (match2) {
                core = match2[1];
            }
        }

        if (!groups[core]) {
            groups[core] = [];
        }
        groups[core].push(p);
    }

    let updateCount = 0;
    const updates = [];

    console.log('\n--- CÁC NHÓM SẼ ĐƯỢC GOM ---');
    let previewCount = 0;

    for (const core in groups) {
        // Chỉ gom nhóm nếu có từ 2 sản phẩm trở lên
        if (groups[core].length > 1) {
            if (previewCount < 10) {
                console.log(`\nCore: ${core} (${groups[core].length} items)`);
                groups[core].forEach(v => console.log(`  - ${v.sku}`));
                previewCount++;
            }

            for (const item of groups[core]) {
                updates.push(
                    prisma.products.update({
                        where: { id: item.id },
                        data: {
                            variant_group: core
                            // User request: "Bỏ tính năng master", nên không đụng đến is_master (mặc định đã là true hết)
                        }
                    })
                );
                updateCount++;
            }
        }
    }

    if (updates.length > 0) {
        console.log(`\nĐang Update ${updateCount} sản phẩm (thuộc ${Object.keys(groups).filter(k => groups[k].length > 1).length} nhóm) vào Database...`);
        const CHUNK_SIZE = 100;
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk);
        }
        console.log(`✅ Thành công! Đã thiết lập variant_group cho ${updateCount} sản phẩm.`);
    } else {
        console.log('✅ Không có nhóm nào cần gom.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
