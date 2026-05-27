const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const products = await prisma.products.findMany({
        where: { sku: { contains: 'AL-294VEC' } },
        include: { product_images: true }
    });

    if (products.length > 0) {
        products.forEach(product => {
            console.log(`Product: ${product.name} (SKU: ${product.sku})`);
            console.log(`Variant Group: ${product.variant_group}`);
            console.log('Images:');
            product.product_images.forEach((img, i) => {
                console.log(`  [${i}] ${img.image_url}`);
            });
            console.log('---');
        });
    } else {
        console.log('Không tìm thấy sản phẩm nào chứa AL-294VEC');
    }
}
main().finally(() => prisma.$disconnect());
