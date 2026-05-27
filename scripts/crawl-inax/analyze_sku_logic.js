const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeSKUs() {
    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        select: { sku: true, name: true, product_type: true }
    });

    const groups = {};
    for (const p of products) {
        let core = '';
        let variantType = '';
        const type = p.product_type || 'unknown';

        if (type.includes('bon-cau')) {
            // Regex tìm Tiền tố (C, AC, GC) + Số series. 
            // VD: AC-909VRN -> AC-909
            const match = p.sku.match(/^([A-Za-z]+-\d+)/);
            if (match) {
                core = match[1];
                variantType = p.sku.replace(core, '');
            }
        } else if (type.includes('sen-tam')) {
            // VD: BFV-1113S-3C -> Core: BFV-1113S, Variant: -3C, -4C, -8C
            const match = p.sku.match(/^(BFV-\d+[A-Za-z]?)/);
            if (match) {
                core = match[1];
                variantType = p.sku.replace(core, '');
            }
        } else if (type.includes('chau-rua')) {
            // VD: AL-288VFC, L-288VEC -> Core: AL-288V
            const match = p.sku.match(/^([A-Za-z]+-\d+[A-Za-z]?)/);
            if (match) {
                core = match[1];
                variantType = p.sku.replace(core, '');
            }
        }

        if (core) {
            if (!groups[type]) groups[type] = {};
            if (!groups[type][core]) groups[type][core] = [];
            groups[type][core].push({ sku: p.sku, name: p.name, variant: variantType });
        }
    }

    // Print summary
    for (const type in groups) {
        console.log(`\n=================== ${type} ===================`);
        let count = 0;
        for (const core in groups[type]) {
            if (groups[type][core].length > 1 && count < 3) {
                console.log(`\nCORE: ${core}`);
                groups[type][core].forEach(v => {
                    console.log(`  - SKU: ${v.sku} | Variant: ${v.variant} | Name: ${v.name}`);
                });
                count++;
            }
        }
    }
}

analyzeSKUs().finally(() => prisma.$disconnect());
