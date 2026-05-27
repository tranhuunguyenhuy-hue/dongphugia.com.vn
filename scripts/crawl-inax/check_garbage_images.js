const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Kiểm tra ảnh sản phẩm AL-662VFC/BW1 ---');
    const product = await prisma.products.findFirst({
        where: { sku: 'AL-662VFC/BW1' },
        include: { product_images: { orderBy: { id: 'asc' } } }
    });

    if (product) {
        console.log(`Product: ${product.name}`);
        console.log(`Total images: ${product.product_images.length}`);
        product.product_images.forEach((img, i) => {
            console.log(`[${i}] ${img.image_url}`);
        });
    } else {
        console.log('Không tìm thấy sản phẩm!');
    }
}
main().finally(() => prisma.$disconnect());
