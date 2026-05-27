const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    console.log('Đang truy xuất các variant_group từ Database...');
    const products = await prisma.products.findMany({
        where: { 
            brands: { slug: 'inax' },
            variant_group: { not: null } 
        },
        select: { 
            variant_group: true,
            sku: true,
            name: true
        }
    });

    // Grouping
    const groups = {};
    for (const p of products) {
        const vg = p.variant_group;
        if (!groups[vg]) groups[vg] = [];
        groups[vg].push(p);
    }

    const headers = [
        "Mã Nhóm (Variant Group)",
        "Số lượng sản phẩm",
        "Danh sách SKU",
        "Danh sách Tên Sản Phẩm"
    ];

    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return '"' + str.replace(/"/g, '""') + '"';
    };

    let csvContent = headers.join(",") + "\n";

    for (const vg in groups) {
        const items = groups[vg];
        const count = items.length;
        const skus = items.map(i => i.sku).join("; ");
        const names = items.map(i => i.name).join("; ");
        
        const row = [vg, count, skus, names];
        csvContent += row.map(escapeCSV).join(",") + "\n";
    }

    // Ghi file
    if (!fs.existsSync('./output')) fs.mkdirSync('./output');
    const outputPath = './output/inax-variant-groups.csv';
    fs.writeFileSync(outputPath, "\uFEFF" + csvContent, 'utf-8');
    
    console.log(`✅ Xuất thành công ${Object.keys(groups).length} nhóm biến thể ra file ${outputPath}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
