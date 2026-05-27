import { PrismaClient } from '@prisma/client';
import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';

const prisma = new PrismaClient();

const BUNNY_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products';
const BUNNY_KEY = process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com';
const BUNNY_CDN = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn';

const FORBIDDEN_DOMAINS = ['ytimg.com', 'youtube.com', 'youtu.be', 'vimeo.com'];

async function uploadToBunny(buffer: Buffer, remotePath: string): Promise<string | null> {
    if (!BUNNY_KEY) {
        console.warn('⚠️ No BUNNY_KEY provided, simulating upload.');
        return `https://${BUNNY_CDN}/${remotePath}`;
    }
    try {
        const url = `https://${BUNNY_STORAGE}/${BUNNY_ZONE}/${remotePath}`;
        await axios.put(url, buffer, {
            headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'application/octet-stream' }
        });
        return `https://${BUNNY_CDN}/${remotePath}`;
    } catch (e: any) {
        console.error(`    ❌ Upload BunnyCDN failed: ${e.message}`);
        return null;
    }
}

async function downloadAndUpload(srcUrl: string, folder: string, slug: string, ext: string): Promise<string | null> {
    try {
        if (!srcUrl.startsWith('http')) srcUrl = 'https://hita.com.vn' + srcUrl;
        if (srcUrl.includes('data:image') || srcUrl.includes('placeholder')) return null;
        
        console.log(`    ⬇️  Downloading ${srcUrl.slice(0, 60)}...`);
        const res = await axios.get(srcUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const buf = Buffer.from(res.data);
        
        const fileName = `${folder}/${slug}_${Date.now()}.${ext}`;
        return await uploadToBunny(buf, fileName);
    } catch (e: any) {
        console.error(`    ❌ Download failed for ${srcUrl.slice(0, 50)}: ${e.message}`);
        return null;
    }
}

// BREADCRUMB MAPPING TO DPG DATABASE SLUGS
const BREADCRUMB_MAP: Record<string, string> = {
    'Bồn Cầu 1 Khối': 'bon-cau',
    'Bồn Cầu 2 Khối': 'bon-cau',
    'Bồn Cầu Treo Tường': 'bon-cau',
    'Bồn Cầu Thông Minh': 'bon-cau',
    'Bồn Cầu': 'bon-cau',
    'Lavabo Dương Vành': 'lavabo',
    'Lavabo Âm Bàn': 'lavabo',
    'Lavabo Đặt Bàn': 'lavabo',
    'Lavabo Treo Tường': 'lavabo',
    'Tủ Lavabo': 'lavabo',
    'Lavabo': 'lavabo',
    'Sen Tắm': 'sen-tam',
    'Sen Cây': 'sen-tam',
    'Sen Tắm Nóng Lạnh': 'sen-tam',
    'Bồn Tắm': 'bon-tam',
    'Phụ Kiện Phòng Tắm': 'phu-kien-phong-tam',
    'Vòi Chậu': 'voi-chau',
    'Vòi Lavabo': 'voi-chau',
    'Bồn Tiểu': 'bon-tieu',
    'Vòi Nước': 'voi-nuoc',
    'Nắp Bồn Cầu': 'nap-bon-cau',
    'Nắp Rửa Điện Tử': 'nap-bon-cau'
};

const HITA_PROMO_PATTERNS = [
    /nhấn nút mua ngay/i, /ship hàng/i, /miễn phí giao hàng/i, /lắp đặt tận nơi/i,
    /kinh dương vương/i, /0\d{2,3}[.\s]?\d{3}[.\s]?\d{3}/, /xem ngay những mẫu/i,
    /top những mẫu/i, /tìm hiểu ngay/i, /đại lý cấp/i, /cam kết hàng chính hãng/i,
    /tham khảo trực tiếp tại/i, /được lựa chọn nhiều nhất/i, /chiết khấu/i,
    /liên hệ.*tư vấn/i
];

async function testAc4005() {
    console.log('--- BẮT ĐẦU TEST SẢN PHẨM: AC-4005VN ---');
    const url = 'https://hita.com.vn/bon-cau-1-khoi-inax-ac-4005vn-537.html';
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Đang cào: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Evaluate to scroll down and trigger lazy images
    await page.evaluate(async () => {
        await new Promise<void>(resolve => {
            let scrolled = 0;
            const interval = setInterval(() => {
                window.scrollBy(0, 300);
                scrolled += 300;
                if (scrolled >= document.body.scrollHeight) {
                    clearInterval(interval); resolve();
                }
            }, 50);
        });
    });
    
    await new Promise(r => setTimeout(r, 1500));

    const html = await page.content();
    const $ = cheerio.load(html);

    // 1. Tên & Breadcrumbs
    const title = $('h1').text().trim().replace(/hita|khali/gi, 'Đồng Phú Gia');
    const breadcrumbs: string[] = [];
    $('.breadcrumb li, .breadcrumbs li').each((i, el) => {
        breadcrumbs.push($(el).text().trim().replace(/[\n\r\/]/g, '').trim());
    });

    // 2. Map Subcategory based on Breadcrumbs
    let mappedSubSlug = null;
    for (const b of breadcrumbs) {
        if (BREADCRUMB_MAP[b]) mappedSubSlug = BREADCRUMB_MAP[b];
    }
    console.log(`   📍 Breadcrumbs: [${breadcrumbs.join(' > ')}] -> Mapped Subcategory Slug: ${mappedSubSlug}`);

    // 3. Giá & Online Discount
    const price = parseInt($('.product-new-price-land, .product-price .price').first().text().replace(/\D/g, '')) || 0;
    const oldPrice = parseInt($('.product-old-price-land, .product-price .price-old').first().text().replace(/\D/g, '')) || 0;
    const onlineDiscountStr = $('.gift-cashback').first().text().replace(/\D/g, '');
    const onlineDiscount = onlineDiscountStr ? parseInt(onlineDiscountStr) : 0;

    // 4. Specs & Extract Exact SKU
    const specsObj: any = {};
    let table = $('#tab-specification table, .product-specification table, .tech-specs table, .table-striped').first();
    if (table.length === 0) table = $('table').first();
    
    table.find('tr').each((i, el) => {
        const th = $(el).find('th, td').first().text().replace(/:/g, '').trim();
        const td = $(el).find('td').last().text().trim();
        if (th && td && th !== td) specsObj[th] = td;
    });

    // Exact SKU extraction logic
    let exactSku = $('.sku').first().text().replace(/Mã sản phẩm:|Mã SP:|Mã bồn cầu:|Mã chậu:|Mã vòi:/gi, '').trim();
    if (!exactSku) {
        const skuKeys = ['Mã sản phẩm', 'Mã SP', 'Thân cầu', 'Mã bồn cầu', 'Mã chậu', 'Mã vòi'];
        for (const key of skuKeys) {
            if (specsObj[key]) {
                exactSku = specsObj[key].toUpperCase().trim();
                break;
            }
        }
    }
    if (!exactSku) {
        const matches = title.match(/\b([A-Z0-9-]{4,})\b/g);
        if (matches) {
            const filtered = matches.filter(m => !['INAX', 'TOTO'].includes(m.toUpperCase()));
            if (filtered.length > 0) exactSku = filtered[0].toUpperCase();
        }
    }
    const sku = exactSku || 'UNKNOWN-SKU';
    console.log(`   🏷️  Exact SKU Extracted: ${sku}`);

    // 5. Gallery
    const rawGallery: string[] = [];
    $('.picture-wrapper img, .product-detail-left img, .slick-slide img, #sync1 img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.startsWith('http')) rawGallery.push(src);
    });
    const uniqueGallery = [...new Set(rawGallery.filter(src => !FORBIDDEN_DOMAINS.some(d => src.includes(d))))];

    // 6. Accessories
    const accessories: string[] = [];
    $('h2, h3').each((i, el) => {
        if ($(el).text().toLowerCase().includes('nguyên hộp bao gồm')) {
            const container = $(el).closest('.title-common').next('.panel-body');
            if (container.length > 0) {
                container.find('div, p, li').each((j, div) => {
                    const txt = $(div).text().replace(/&nbsp;/g, ' ').trim();
                    if (txt) accessories.push(txt);
                });
            }
        }
    });

    // 7. Extract Documents from Description & Clean Description
    let descHtml = $('.description-content').html() || $('.product-description').html() || $('#tab-description').html() || '';
    const extractedPdfs: { name: string; url: string }[] = [];

    // EXTRACT PDFS (Must do it on the global $ before it gets removed)
    $('a[href$=".pdf"]').each((i, el) => {
        let url = $(el).attr('href')!;
        if (!url.startsWith('http')) url = 'https://hita.com.vn' + url;
        const name = $(el).text().trim() || 'Tài liệu PDF';
        extractedPdfs.push({ name, url });
    });

    if (descHtml) {
        const $desc = cheerio.load(descHtml);
        
        // Remove Iframe/Videos
        $desc('iframe, video').remove();
        // Process Images
        $desc('img').each((i, img) => {
            const dataSrc = $desc(img).attr('data-src');
            if (dataSrc) $desc(img).attr('src', dataSrc);

            let src = $desc(img).attr('src') || '';
            if (FORBIDDEN_DOMAINS.some(d => src.includes(d))) {
                $desc(img).remove();
            } else if (src.startsWith('/')) {
                $desc(img).attr('src', 'https://hita.com.vn' + src);
            }

            src = $desc(img).attr('src') || '';
            if (src) {
                $desc(img).attr('src', src.replace(/hita/gi, 'h_i_t_a'));
            }
            $desc(img).removeAttr('data-src');
            $desc(img).removeClass('lazy');
        });

        // Protect hrefs
        $desc('a').each((i, a) => {
            let href = $desc(a).attr('href') || '';
            if (href) {
                $desc(a).attr('href', href.replace(/hita/gi, 'h_i_t_a'));
            }
        });

        // Remove "Xem thêm" / "Thu gọn"
        $desc('.description-show-more, .btn-show-more, .show-more').remove();
        $desc('.description-collapse').removeClass('description-collapse description-blur');
        $desc('div, p, span, a').each((i, el) => {
            const text = $desc(el).text().toLowerCase().trim();
            if (text === 'xem thêm' || text === 'thu gọn' || text === 'hiển thị thêm') {
                $desc(el).remove();
            }
        });

        // Remove Hita promotional text
        $desc('p, li').each((i, el) => {
            const text = $desc(el).text().trim();
            if (text.length < 250 && HITA_PROMO_PATTERNS.some(p => p.test(text))) {
                $desc(el).remove();
            }
        });

        // Remove attachment blocks
        $desc('.description-attachments, #package-attachments').remove();
        $desc('h2, h3, h4').each((i, el) => {
            if ($desc(el).text().toLowerCase().includes('tài liệu đính kèm') || $desc(el).text().toLowerCase().includes('tải về')) {
                let curr = $desc(el);
                let next = curr.next();
                while (next.length && !next.is('h2, h3, h4')) {
                    let temp = next.next();
                    next.remove();
                    next = temp;
                }
                curr.remove();
            }
        });

        descHtml = $desc('body').html() || '';
        // Global replace for Hita names
        descHtml = descHtml.replace(/hita/gi, 'Đồng Phú Gia').replace(/khali/gi, 'Đồng Phú Gia');
        descHtml = descHtml.replace(/h_i_t_a/gi, 'hita');
    }

    // Process Uploads
    const slug = url.split('/').pop()?.replace(/\.html$/, '').replace(/-\d+$/, '') || sku.toLowerCase();
    
    console.log(`   🚀 Bắt đầu Upload lên BunnyCDN...`);
    const finalGallery: string[] = [];
    for (const imgUrl of uniqueGallery) {
        const cdnUrl = await downloadAndUpload(imgUrl, 'product_images', slug, 'jpg');
        if (cdnUrl) finalGallery.push(cdnUrl);
    }
    const mainImage = finalGallery.length > 0 ? finalGallery[0] : null;

    const finalPdfs: { name: string; url: string }[] = [];
    for (const doc of extractedPdfs) {
        const cdnUrl = await downloadAndUpload(doc.url, 'product_docs', slug, 'pdf');
        if (cdnUrl) finalPdfs.push({ name: doc.name, url: cdnUrl });
    }

    if (accessories.length > 0) specsObj['Phụ kiện đi kèm'] = accessories;
    if (finalPdfs.length > 0) specsObj['documents'] = finalPdfs;

    // Database Update
    console.log(`   💾 Cập nhật vào Database...`);
    
    let subcategory = null;
    let category = null;
    if (mappedSubSlug) {
        subcategory = await prisma.subcategories.findFirst({ where: { slug: mappedSubSlug } });
        if (subcategory) {
            category = await prisma.categories.findFirst({ where: { id: subcategory.category_id } });
        }
    }

    const existingProduct = await prisma.products.findFirst({ where: { sku: sku } });
            
    let productId;
    if (existingProduct) {
        await prisma.products.update({
            where: { id: existingProduct.id },
            data: {
                name: title,
                price: price > 0 ? price : existingProduct.price,
                original_price: oldPrice > 0 ? oldPrice : existingProduct.original_price,
                online_discount_amount: onlineDiscount > 0 ? onlineDiscount : existingProduct.online_discount_amount,
                description: descHtml || existingProduct.description,
                specs: specsObj,
                image_main_url: mainImage || existingProduct.image_main_url,
                source_url: url
            }
        });
        productId = existingProduct.id;
        console.log(`    🔄 Đã UPDATE sản phẩm ID: ${productId}`);
    } else {
        const brand = await prisma.brands.findFirst({ where: { slug: 'inax' } });
        const newProduct = await prisma.products.create({
            data: {
                name: title,
                slug: slug,
                sku: sku,
                price: price,
                original_price: oldPrice,
                online_discount_amount: onlineDiscount > 0 ? onlineDiscount : null,
                description: descHtml,
                specs: specsObj,
                image_main_url: mainImage || '',
                is_active: true,
                is_combo: false,
                brand_id: brand?.id || 2,
                category_id: category?.id || 1,
                subcategory_id: subcategory?.id || null,
                source_url: url
            }
        });
        productId = newProduct.id;
        console.log(`    ✨ Đã INSERT sản phẩm mới ID: ${productId}`);
    }

    // Insert Gallery
    if (finalGallery.length > 0) {
        // Clear old images for this product to avoid duplicates
        await prisma.product_images.deleteMany({ where: { product_id: productId } });
        
        const galleryData = finalGallery.map((imgUrl, i) => ({
            product_id: productId,
            image_url: imgUrl,
            alt_text: title,
            sort_order: i
        }));
        await prisma.product_images.createMany({ data: galleryData });
        console.log(`    📸 Đã lưu ${finalGallery.length} ảnh gallery vào DB.`);
    }

    await browser.close();
    console.log('\n✅ TEST HOÀN TẤT!');
    console.log(`Bạn có thể xem sản phẩm trên UI với slug: /products/${slug} (hoặc đường dẫn tương ứng)`);
}

testAc4005().catch(console.error).finally(() => prisma.$disconnect());
