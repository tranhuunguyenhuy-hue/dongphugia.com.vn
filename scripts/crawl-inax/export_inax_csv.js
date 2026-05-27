const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    console.log('Đang truy xuất dữ liệu từ Database...');
    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        include: {
            categories: true,
            subcategories: true,
            _count: {
                select: { product_images: true }
            }
        }
    });

    const headers = [
        "Danh mục cấp 1",
        "Danh mục cấp 2",
        "Danh mục cấp 3",
        "Giá gốc",
        "Giá khuyến mãi",
        "Giá giảm thêm khi đặt online",
        "Tài liệu kèm theo",
        "Số ảnh trong gallery",
        "Tên sản phẩm",
        "Mã SKU"
    ];

    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return '"' + str.replace(/"/g, '""') + '"';
    };

    let csvContent = headers.join(",") + "\n";

    for (const p of products) {
        const cat1 = p.categories ? p.categories.name : "";
        const cat2 = p.subcategories ? p.subcategories.name : "";
        const cat3 = p.product_type || "";
        const originalPrice = p.original_price || "";
        const price = p.price || "";
        const discountOnline = p.online_discount_amount || "";
        
        let hasDoc = "Không";
        // Check docs in specs (tìm kiếm PDF hoặc từ khóa)
        if (p.specs && typeof p.specs === 'object') {
            const strSpecs = JSON.stringify(p.specs).toLowerCase();
            if (strSpecs.includes('.pdf') || strSpecs.includes('tài liệu') || strSpecs.includes('hướng dẫn')) {
                hasDoc = "Có";
            }
        }
        
        const imagesCount = p._count ? p._count.product_images : 0;
        
        const row = [
            cat1, cat2, cat3, originalPrice, price, discountOnline, hasDoc, imagesCount, p.name, p.sku
        ];

        csvContent += row.map(escapeCSV).join(",") + "\n";
    }

    // Đảm bảo thư mục output tồn tại
    if (!fs.existsSync('./output')) {
        fs.mkdirSync('./output');
    }

    fs.writeFileSync('./output/inax-export.csv', "\uFEFF" + csvContent, 'utf-8'); // Thêm BOM để Excel đọc tiếng Việt chuẩn
    console.log(`✅ Đã xuất thành công ${products.length} sản phẩm ra file output/inax-export.csv`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
