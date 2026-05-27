const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const Decimal = require('decimal.js');

async function main() {
    console.log('=== BẮT ĐẦU CLEANUP DATA PRICE TOÀN BỘ DATABASE ===');

    const products = await prisma.products.findMany({
        select: { id: true, sku: true, name: true, original_price: true, price: true }
    });

    let syncCount = 0; // Số sản phẩm được đồng bộ giá gốc từ giá khuyến mãi
    let swapCount = 0; // Số sản phẩm được swap do giá khuyến mãi > giá gốc

    const updates = [];

    for (const p of products) {
        let op = p.original_price ? new Decimal(p.original_price) : new Decimal(0);
        let cp = p.price ? new Decimal(p.price) : new Decimal(0);
        let hasChange = false;

        let newOp = op;
        let newCp = cp;

        // Rule 1: Nếu original_price = 0 (hoặc null) và price > 0 -> original_price = price
        if (op.isZero() && cp.greaterThan(0)) {
            newOp = cp;
            hasChange = true;
            syncCount++;
            console.log(`🔄 SYNC [${p.sku}] - ${p.name}`);
            console.log(`   - Gốc cũ: 0, Bán cũ: ${cp}  -->  Gốc mới: ${newOp}, Bán mới: ${newCp}`);
        } 
        // Rule 2: Nếu price > original_price (và original_price > 0) -> swap 
        else if (cp.greaterThan(op) && op.greaterThan(0)) {
            newOp = cp;
            newCp = op;
            hasChange = true;
            swapCount++;
            console.log(`🔀 SWAP [${p.sku}] - ${p.name}`);
            console.log(`   - Gốc cũ: ${op}, Bán cũ: ${cp}  -->  Gốc mới: ${newOp}, Bán mới: ${newCp}`);
        }

        if (hasChange) {
            updates.push(
                prisma.products.update({
                    where: { id: p.id },
                    data: {
                        original_price: newOp.toNumber(),
                        price: newCp.toNumber()
                    }
                })
            );
        }
    }

    if (updates.length > 0) {
        console.log(`\nĐang tiến hành Update ${updates.length} records vào Database...`);
        // Batch execution
        const CHUNK_SIZE = 100;
        for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
            const chunk = updates.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk);
        }
        console.log(`✅ Thành công! Đã đồng bộ giá gốc cho ${syncCount} sản phẩm và Swap giá cho ${swapCount} sản phẩm.`);
    } else {
        console.log(`✅ Không tìm thấy sản phẩm nào cần xử lý giá.`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
