const axios = require('axios');
const cheerio = require('cheerio');

async function explorePDP(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        
        console.log(`\n=== KẾT QUẢ KHẢO SÁT PDP: ${url} ===\n`);
        
        // 1. Basic Info
        const name = $('h1').text().trim();
        const sku = $('.product-sku').text().trim() || $('[itemprop="sku"]').text().trim() || $('th:contains("Mã sản phẩm")').next('td').text().trim();
        console.log(`📌 Tên SP: ${name}`);
        console.log(`🔖 SKU: ${sku}`);
        
        // 2. Pricing
        const priceOrigin = $('.price-old').text().trim();
        const priceSale = $('.price-new').text().trim() || $('.product-price').text().trim();
        console.log(`💰 Giá gốc: ${priceOrigin}`);
        console.log(`🔥 Giá bán: ${priceSale}`);
        
        // 3. Category/Breadcrumb
        const breadcrumbs = [];
        $('.breadcrumb li').each((i, el) => {
            breadcrumbs.push($(el).text().trim());
        });
        console.log(`📂 Danh mục (Breadcrumbs): ${breadcrumbs.join(' > ')}`);
        
        // 4. Images
        const mainImage = $('.main-product-slider img').first().attr('src') || $('.main-product-slider img').first().attr('data-src');
        const galleryLength = $('.main-product-slider img').length;
        console.log(`🖼️ Ảnh chính: ${mainImage}`);
        console.log(`📸 Tổng số ảnh Gallery: ${galleryLength}`);
        
        // 5. Short Description / Highlights
        const shortDesc = $('.product-summary').text().replace(/\s+/g, ' ').trim();
        console.log(`📝 Mô tả ngắn: ${shortDesc.substring(0, 100)}...`);
        
        // 6. Full Description
        const fullDescHtml = $('#tab-description').html();
        const hasFullDesc = !!fullDescHtml;
        console.log(`📄 Bài viết chi tiết (HTML): ${hasFullDesc ? 'CÓ' : 'KHÔNG'}`);
        
        // 7. Technical Specs (Table)
        console.log(`\n⚙️ THÔNG SỐ KỸ THUẬT (Table):`);
        $('.product-specs table tr').each((i, el) => {
            const key = $(el).find('th').text().trim() || $(el).find('td').first().text().trim();
            const val = $(el).find('td').last().text().trim();
            if(key && val && key !== val) {
                 console.log(`  - ${key}: ${val}`);
            }
        });
        
        // 8. Documents / PDF / Phụ kiện đi kèm
        console.log(`\n📁 TÀI LIỆU & PHỤ KIỆN:`);
        const accessories = $('#tab-accessories').text().replace(/\s+/g, ' ').trim() || $('.accessories-box').text().replace(/\s+/g, ' ').trim();
        if(accessories) console.log(`  - Phụ kiện: ${accessories.substring(0, 100)}...`);
        
        const downloads = [];
        $('a[href$=".pdf"]').each((i, el) => downloads.push($(el).attr('href')));
        console.log(`  - File đính kèm (PDF): ${downloads.length > 0 ? downloads.join(', ') : 'Không có'}`);

        // 9. Relational Data (Related Products, Combo)
        const relatedCount = $('.related-products .product-item').length || $('.product-related .item').length;
        console.log(`\n🔗 Sản phẩm liên quan/Combo: ${relatedCount} sản phẩm`);

    } catch (e) {
        console.error("Lỗi khi fetch:", e.message);
    }
}

async function main() {
    console.log("Đang lấy link sản phẩm INAX...");
    try {
        const { data } = await axios.get('https://hita.com.vn/bon-cau-inax-120.html');
        const $ = cheerio.load(data);
        const link = $('.product-item a').first().attr('href') || $('.grid-products a.product-image').first().attr('href') || $('.product-grid a').first().attr('href');
        
        if (link) {
            const fullUrl = link.startsWith('http') ? link : 'https://hita.com.vn' + link;
            await explorePDP(fullUrl);
        } else {
            console.log("Không tìm thấy link sản phẩm trên trang danh mục.");
        }
    } catch (e) {
        console.error("Lỗi lấy danh sách SP:", e.message);
    }
}

main();
