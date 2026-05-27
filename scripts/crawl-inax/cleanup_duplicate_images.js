const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== BẮT ĐẦU DỌN DẸP ẢNH TRÙNG LẶP CHO INAX ===');
    
    // Lấy tất cả sản phẩm INAX kèm theo ảnh
    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        include: { 
            product_images: { 
                orderBy: { id: 'asc' } 
            } 
        }
    });

    let totalImages = 0;
    let garbageIds = [];
    let processedProducts = 0;

    for (const product of products) {
        if (product.product_images.length <= 1) continue;

        processedProducts++;
        const seenBaseNames = new Set();
        let keptCount = 0;
        let removedCount = 0;

        for (const img of product.product_images) {
            totalImages++;
            // Trích xuất base_name, ví dụ: chau-rua-lavabo-al-662_1778779952480.jpg -> chau-rua-lavabo-al-662
            let baseName = img.image_url;
            const match = img.image_url.match(/([^\/]+)_(\d{13,})\.(jpg|jpeg|png|webp|gif)/i);
            
            if (match) {
                baseName = match[1];
            } else {
                // Thử cắt theo tên file thường nếu không có timestamp
                const filenameMatch = img.image_url.match(/([^\/]+)\.(jpg|jpeg|png|webp|gif)/i);
                if (filenameMatch) baseName = filenameMatch[1];
            }

            if (seenBaseNames.has(baseName)) {
                // Đã có base_name này rồi -> Là ảnh copy / rác do crawler tạo ra -> Xóa
                garbageIds.push(img.id);
                removedCount++;
            } else {
                // Chưa có -> Ảnh gốc hợp lệ -> Giữ lại
                seenBaseNames.add(baseName);
                keptCount++;
            }
        }
    }

    console.log(`Đã quét xong:`);
    console.log(`- Tổng số sản phẩm INAX có nhiều ảnh: ${processedProducts}`);
    console.log(`- Tổng số ID ảnh trùng lặp (rác) cần xóa: ${garbageIds.length}`);

    if (garbageIds.length > 0) {
        console.log('\nThực hiện xóa...');
        // Xóa batch
        const CHUNK_SIZE = 500;
        let deletedCount = 0;
        
        for (let i = 0; i < garbageIds.length; i += CHUNK_SIZE) {
            const chunk = garbageIds.slice(i, i + CHUNK_SIZE);
            const res = await prisma.product_images.deleteMany({
                where: { id: { in: chunk } }
            });
            deletedCount += res.count;
            console.log(` Đã xóa chunk... (${deletedCount}/${garbageIds.length})`);
        }
        console.log(`✅ Thành công! Đã xóa vĩnh viễn ${deletedCount} hình ảnh rác.`);
    } else {
        console.log('✅ Không có ảnh rác nào cần dọn dẹp.');
    }
}

main().finally(() => prisma.$disconnect());
