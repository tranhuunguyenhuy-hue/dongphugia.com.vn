import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('--- BẮT ĐẦU RE-MAPPING CATEGORY CẤP 3 LẦN 2 ---');

    const products = await prisma.products.findMany({
        where: { brands: { slug: 'inax' } },
        select: { id: true, name: true, product_type: true, subcategories: { select: { slug: true } } }
    });

    console.log(`Kiểm tra lại ${products.length} sản phẩm INAX.`);
    let updateCount = 0;

    for (const p of products) {
        if (!p.name) continue;
        const nameLower = p.name.toLowerCase();
        let newType: string | null = null;
        const subcat = p.subcategories?.slug;

        // 1. Nhóm Bồn Cầu
        if (subcat === 'bon-cau') {
            if (nameLower.includes('phụ kiện') || nameLower.includes('khung thép') || nameLower.includes('nút nhấn') || nameLower.includes('van xả') || nameLower.includes('ốc') || nameLower.includes('gioăng')) newType = 'phu-kien-bon-cau';
            else if (nameLower.includes('két nước âm tường')) newType = 'ket-nuoc-am-tuong';
            else if (nameLower.includes('két nước')) newType = 'ket-nuoc';
            else if (nameLower.includes('thân bồn cầu') || nameLower.includes('thân cầu')) newType = 'than-bon-cau';
            else if (nameLower.includes('treo tường')) newType = 'bon-cau-treo-tuong'; // Priority over thông minh
            else if (nameLower.includes('điện tử') || nameLower.includes('thông minh') || nameLower.includes('cảm ứng') || nameLower.includes('satis')) newType = 'bon-cau-thong-minh';
            else if (nameLower.includes('1 khối') || nameLower.includes('một khối')) newType = 'bon-cau-1-khoi';
            else if (nameLower.includes('2 khối') || nameLower.includes('hai khối')) newType = 'bon-cau-2-khoi';
            else if (nameLower.includes('xổm')) newType = 'bon-cau-xom';
            else if (nameLower.includes('đặt sàn')) newType = 'bon-cau-dat-san';
            else newType = 'bon-cau-2-khoi'; // fallback default if just generic bồn cầu
        }
        // 2. Nhóm Lavabo
        else if (subcat === 'lavabo') {
            if (nameLower.includes('phụ kiện') || nameLower.includes('giá đỡ') || nameLower.includes('ống') || nameLower.includes('van') || nameLower.includes('nút chặn')) newType = 'phu-kien-lavabo';
            else if (nameLower.includes('đặt bàn')) newType = 'lavabo-dat-ban';
            else if (nameLower.includes('âm bàn')) newType = 'lavabo-am-ban';
            else if (nameLower.includes('bán âm')) newType = 'lavabo-ban-am';
            else if (nameLower.includes('dương vành')) newType = 'lavabo-duong-vanh';
            else if (nameLower.includes('treo tường')) newType = 'lavabo-treo-tuong';
            else if (nameLower.includes('tủ chậu')) newType = 'tu-chau';
        }
        // 3. Nhóm Sen Tắm
        else if (subcat === 'sen-tam') {
            if (nameLower.includes('âm tường')) newType = 'sen-am-tuong';
            else if (nameLower.includes('cây') || nameLower.includes('đứng')) newType = 'sen-dung';
            else if (nameLower.includes('bát sen trần') || nameLower.includes('gắn trần')) newType = 'bat-sen-tran';
            else if (nameLower.includes('bát sen')) newType = 'bat-sen-cam-tay';
            else if (nameLower.includes('tay sen')) newType = 'tay-sen';
            else if (nameLower.includes('bộ')) {
                if (nameLower.includes('nhiệt độ')) newType = 'sen-tam-nhiet-do';
                else newType = 'sen-tam-nong-lanh';
            }
            else if (nameLower.includes('sen tắm') || nameLower.includes('vòi sen') || nameLower.includes('củ sen')) {
                newType = 'cu-sen';
            }
            else {
                newType = 'phu-kien-sen-tam';
            }
        }
        // 4. Nhóm Phụ Kiện Phòng Tắm
        else if (subcat === 'phu-kien-phong-tam') {
            if (nameLower.includes('thoát sàn') || nameLower.includes('phễu')) newType = 'ga-thoat-san';
            else if (nameLower.includes('vòi xịt')) newType = 'voi-xit-ve-sinh';
            else if (nameLower.includes('lô giấy') || nameLower.includes('hộp giấy')) newType = 'lo-giay';
            else if (nameLower.includes('móc áo') || nameLower.includes('treo áo')) newType = 'moc-ao';
            else if (nameLower.includes('treo khăn') || nameLower.includes('vắt khăn')) newType = 'treo-khan';
            else if (nameLower.includes('gương')) newType = 'guong-phong-tam';
            else if (nameLower.includes('xà phòng')) newType = 'hop-xa-phong';
            else newType = 'phu-kien-phong-tam';
        }
        // 5. Nắp Bồn Cầu
        else if (subcat === 'nap-bon-cau') {
            if (nameLower.includes('điện tử')) newType = 'nap-dien-tu';
            else if (nameLower.includes('rửa cơ')) newType = 'nap-rua-co';
            else if (nameLower.includes('đóng êm') || nameLower.includes('nắp bồn cầu inax')) newType = 'nap-thuong-dong-em';
        }
        // 6. Nhóm Vòi và Tiểu nam
        else if (subcat === 'bon-tieu') {
            if (nameLower.includes('van') || nameLower.includes('phụ kiện') || nameLower.includes('ống') || nameLower.includes('cút') || nameLower.includes('nắp') || nameLower.includes('gioăng') || nameLower.includes('pin') || nameLower.includes('đầu phun') || nameLower.includes('vách ngăn')) newType = 'phu-kien-bon-tieu';
            else newType = 'bon-tieu-nam';
        }
        else if (subcat === 'voi-rua-chen' || subcat === 'voi-chau') {
            if (nameLower.includes('phụ kiện') || nameLower.includes('đai ốc') || nameLower.includes('ống') || nameLower.includes('van') || nameLower.includes('nút chặn') || nameLower.includes('giá đỡ') || nameLower.includes('cụm')) newType = 'phu-kien-voi';
            else if (nameLower.includes('cảm ứng')) newType = 'voi-cam-ung';
            else if (nameLower.includes('bán tự động')) newType = 'voi-ban-tu-dong';
            else if (nameLower.includes('cổ cao')) newType = 'voi-co-cao';
            else if (nameLower.includes('cổ trung')) newType = 'voi-co-trung';
            else if (nameLower.includes('gắn tường')) newType = 'voi-gan-tuong';
            else if (subcat === 'voi-rua-chen') newType = 'voi-rua-chen';
            else newType = 'voi-nong-lanh';
        }

        // Update if type determined and different from current
        if (newType && newType !== p.product_type) {
            await prisma.products.update({
                where: { id: p.id },
                data: { product_type: newType }
            });
            updateCount++;
            console.log(`✅ [Re-Map] [${p.id}] ${p.name.substring(0, 50)}... -> ${newType}`);
        }
    }

    console.log(`\n🎉 HOÀN TẤT RE-MAPPING! Đã điều chỉnh thành công ${updateCount} sản phẩm.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
