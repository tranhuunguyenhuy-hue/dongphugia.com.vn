const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== BẮT ĐẦU PHÂN TÍCH MÃ SKU INAX SO VỚI TÀI LIỆU ===');

    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        select: { id: true, sku: true, name: true, product_type: true }
    });

    let stats = {
        total: products.length,
        matched: 0,
        unmatched: 0,
        groups: {
            'Bàn Cầu': 0,
            'Lavabo': 0,
            'Sen Tắm & Vòi': 0,
            'Nắp Rửa': 0,
            'Bồn Tắm & Tiểu': 0,
        },
        mismatches: [] // Để lưu những trường hợp parse ra một đằng mà product_type một nẻo
    };

    let unmatchedSkus = [];

    for (const p of products) {
        if (!p.sku) continue;
        
        let sku = p.sku.toUpperCase();
        // Remove color code if exists
        sku = sku.split('/')[0];
        
        let matched = false;
        let detectedGroup = '';
        let detectedType = '';

        // 1. Bàn Cầu (C, AC, SATIS, G, S)
        if (/^(AC|C|SATIS|G|S)-?\d+/i.test(sku)) {
            matched = true;
            detectedGroup = 'Bàn Cầu';
            const numMatch = sku.match(/(?:AC|C|SATIS|G|S)-?(\d+)/i);
            if (numMatch) {
                const numStr = numMatch[1];
                if (numStr.startsWith('9') || numStr.startsWith('10') || numStr.startsWith('11')) detectedType = 'bon-cau-1-khoi';
                else if (/^[13578]/.test(numStr)) detectedType = 'bon-cau-2-khoi';
                else if (numStr.startsWith('2')) detectedType = 'bon-cau-treo-tuong';
                else detectedType = 'bon-cau';
            }
        }
        // 2. Lavabo (L, AL)
        else if (/^(AL|L)-?\d{3,4}/i.test(sku)) {
            matched = true;
            detectedGroup = 'Lavabo';
            const numMatch = sku.match(/(?:AL|L)-?(\d+)/i);
            if (numMatch) {
                const numStr = numMatch[1];
                if (numStr.startsWith('2')) detectedType = 'lavabo-treo-am-ban';
                else if (numStr.startsWith('4') || numStr.startsWith('6')) detectedType = 'lavabo-dat-ban';
                else detectedType = 'lavabo';
            }
        }
        // 3. Sen Tắm & Vòi (LFV, BFV, SFV, AMV, AFV)
        else if (/^(LFV|BFV|SFV|AMV|AFV)-?\d+/i.test(sku)) {
            matched = true;
            detectedGroup = 'Sen Tắm & Vòi';
            if (sku.startsWith('LFV')) detectedType = 'voi-chau';
            else if (sku.startsWith('BFV')) detectedType = 'sen-tam';
            else if (sku.startsWith('SFV')) detectedType = 'voi-rua-chen';
            else if (sku.startsWith('AMV') || sku.startsWith('AFV')) detectedType = 'voi-cam-ung';
        }
        // 4. Nắp Rửa (CW)
        else if (/^CW-?(S|H|KA|KB|RS|RW)/i.test(sku)) {
            matched = true;
            detectedGroup = 'Nắp Rửa';
            if (sku.includes('CW-S') || sku.includes('CWS')) detectedType = 'nap-rua-co';
            else detectedType = 'nap-dien-tu';
        }
        // 5. Bồn Tắm & Tiểu (FBV, MBV, U, AU, UF, OKUV)
        else if (/^(FBV|MBV|U-|AU|UF|OKUV)/i.test(sku)) {
            matched = true;
            detectedGroup = 'Bồn Tắm & Tiểu';
            if (sku.startsWith('FBV') || sku.startsWith('MBV')) detectedType = 'bon-tam';
            else detectedType = 'bon-tieu';
        }

        if (matched) {
            stats.matched++;
            stats.groups[detectedGroup]++;
            
            // Checking logic consistency (basic level)
            // if product_type exists, does it align somewhat with detectedGroup?
            if (p.product_type) {
                let isConflict = false;
                const pt = p.product_type;
                if (detectedGroup === 'Bàn Cầu' && !pt.includes('bon-cau') && !pt.includes('ket-nuoc') && !pt.includes('than-bon-cau')) isConflict = true;
                if (detectedGroup === 'Lavabo' && !pt.includes('lavabo') && !pt.includes('tu-chau')) isConflict = true;
                if (detectedGroup === 'Sen Tắm & Vòi' && !pt.includes('sen') && !pt.includes('voi')) isConflict = true;
                if (detectedGroup === 'Nắp Rửa' && !pt.includes('nap')) isConflict = true;
                if (detectedGroup === 'Bồn Tắm & Tiểu' && !pt.includes('bon-tam') && !pt.includes('bon-tieu') && !pt.includes('phu-kien-bon-tieu')) isConflict = true;
                
                if (isConflict) {
                    stats.mismatches.push({
                        sku: sku,
                        name: p.name,
                        detectedGroup: detectedGroup,
                        currentProductType: p.product_type
                    });
                }
            }
        } else {
            stats.unmatched++;
            unmatchedSkus.push(sku + " (" + p.name + ")");
        }
    }

    console.log(`\n📊 THỐNG KÊ KẾT QUẢ MAP THEO MÃ SKU`);
    console.log(`- Tổng số sản phẩm INAX: ${stats.total}`);
    console.log(`- Số lượng SKU khớp với công thức: ${stats.matched} (${((stats.matched/stats.total)*100).toFixed(1)}%)`);
    console.log(`- Số lượng SKU KHÔNG khớp công thức: ${stats.unmatched} (${((stats.unmatched/stats.total)*100).toFixed(1)}%)`);
    
    console.log(`\n📦 PHÂN BỔ THEO NHÓM DỰA TRÊN MÃ SKU:`);
    for (const [group, count] of Object.entries(stats.groups)) {
        console.log(`   - ${group}: ${count} sản phẩm`);
    }

    if (stats.mismatches.length > 0) {
        console.log(`\n⚠️ PHÁT HIỆN ${stats.mismatches.length} SẢN PHẨM CÓ SỰ XUNG ĐỘT GIỮA SKU VÀ CATEGORY TRONG DB:`);
        stats.mismatches.slice(0, 15).forEach(m => {
            console.log(`   - SKU: ${m.sku} | Detected: ${m.detectedGroup} | DB_Type: ${m.currentProductType} | Name: ${m.name}`);
        });
        if (stats.mismatches.length > 15) console.log(`     ... và ${stats.mismatches.length - 15} sản phẩm khác.`);
    }

    if (unmatchedSkus.length > 0) {
        console.log(`\n❓ MỘT SỐ MÃ SKU KHÔNG KHỚP CÔNG THỨC (Thường là phụ kiện hoặc chuẩn cũ):`);
        unmatchedSkus.slice(0, 20).forEach(s => console.log(`   - ${s}`));
        if (unmatchedSkus.length > 20) console.log(`     ... và ${unmatchedSkus.length - 20} mã khác.`);
    }

}

main().finally(() => prisma.$disconnect());
