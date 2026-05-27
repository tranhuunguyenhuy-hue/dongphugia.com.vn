import { PrismaClient } from '@prisma/client';
import { chromium, Browser, Page } from 'playwright';
import * as cheerio from 'cheerio';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const INPUT_FILE = 'scripts/crawl-inax/output/inax-master-urls.json';
const PROGRESS_FILE = path.join(__dirname, 'output', 'phase2_progress.json');

const BUNNY_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products';
const BUNNY_KEY = process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com';
const BUNNY_CDN = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn';

const FORBIDDEN_DOMAINS = ['ytimg.com', 'youtube.com', 'youtu.be', 'vimeo.com'];

const HITA_PROMO_PATTERNS = [
    /nhấn nút mua ngay/i, /ship hàng/i, /miễn phí giao hàng/i, /lắp đặt tận nơi/i,
    /kinh dương vương/i, /0\d{2,3}[.\s]?\d{3}[.\s]?\d{3}/, /xem ngay những mẫu/i,
    /top những mẫu/i, /tìm hiểu ngay/i, /đại lý cấp/i, /cam kết hàng chính hãng/i,
    /tham khảo trực tiếp tại/i, /được lựa chọn nhiều nhất/i, /chiết khấu/i,
    /liên hệ.*tư vấn/i
];

async function uploadToBunny(buffer: Buffer, remotePath: string): Promise<string | null> {
    if (!BUNNY_KEY) return null; // Skip if no key
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
        console.error(`    ❌ Download failed: ${e.message}`);
        return null;
    }
}

const CAT_MAP: Record<string, string> = {
    'Bồn Cầu': 'bon-cau',
    'Lavabo': 'lavabo',
    'Sen Tắm': 'sen-tam',
    'Bồn Tắm': 'bon-tam',
    'Phụ Kiện': 'phu-kien-phong-tam',
    'Vòi Chậu': 'voi-chau',
    'Bồn Tiểu': 'bon-tieu',
    'Vòi Nước': 'voi-nuoc',
    'Nắp Bồn Cầu': 'nap-bon-cau'
};

async function scrapePage(page: Page, url: string, slug: string) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500)); // wait for lazy loads

    // Check 404
    const pageTitle = await page.title();
    if (pageTitle.includes('404') || pageTitle.includes('Không tìm thấy')) return null;

    const html = await page.content();
    const $ = cheerio.load(html);

    const title = $('h1').text().trim().replace(/hita|khali/gi, 'Đồng Phú Gia');
    if (!title) return null;

    const breadcrumbs: string[] = [];
    $('.breadcrumb li, .breadcrumbs li').each((i, el) => {
        breadcrumbs.push($(el).text().trim().replace(/[\n\r\/]/g, '').trim());
    });

    const priceText = $('.product-new-price-land, .product-price .price').first().text().replace(/\D/g, '');
    const oldPriceText = $('.product-old-price-land, .product-price .price-old').first().text().replace(/\D/g, '');
    const price = priceText ? parseInt(priceText) : 0;
    const oldPrice = oldPriceText ? parseInt(oldPriceText) : 0;
    
    const onlineDiscountStr = $('.gift-cashback').first().text().replace(/\D/g, '');
    const onlineDiscount = onlineDiscountStr ? parseInt(onlineDiscountStr) : 0;

    // Gallery
    const rawGallery: string[] = [];
    $('.picture-wrapper img, .product-detail-left img, .slick-slide img, #sync1 img').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && src.startsWith('http')) rawGallery.push(src);
    });
    const uniqueGallery = [...new Set(rawGallery.filter(src => !FORBIDDEN_DOMAINS.some(d => src.includes(d))))];

    // Specs
    const specsObj: any = {};
    let table = $('#tab-specification table, .product-specification table, .tech-specs table, .table-striped').first();
    if (table.length === 0) table = $('table').first();
    
    table.find('tr').each((i, el) => {
        const th = $(el).find('th, td').first().text().replace(/:/g, '').trim();
        const td = $(el).find('td').last().text().trim();
        if (th && td && th !== td) specsObj[th] = td;
    });

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

    // Accessories
    const accessories: string[] = [];
    $('h2, h3').each((i, el) => {
        if ($(el).text().toLowerCase().includes('nguyên hộp bao gồm')) {
            const container = $(el).closest('.title-common').next('.panel-body');
            if (container.length > 0) {
                container.find('div, p, li').each((j, div) => {
                    const txt = $(div).text().replace(/&nbsp;/g, ' ').trim();
                    if (txt) accessories.push(txt);
                });
            } else {
                let curr = $(el).parent();
                for (let step = 0; step < 3 && curr.length; step++) {
                    let next = curr.next('.panel-body');
                    if (next.length) {
                        next.find('div, p, li').each((j, div) => {
                            const txt = $(div).text().trim();
                            if (txt) accessories.push(txt);
                        });
                        break;
                    }
                    curr = curr.parent();
                }
            }
        }
    });

    // PDFs
    const pdfs: string[] = [];
    $('a[href$=".pdf"]').each((i, el) => {
        pdfs.push($(el).attr('href')!);
    });

    // Description
    let descHtml = $('.description-content').html() || $('.product-description').html() || $('#tab-description').html() || '';
    const extractedPdfs: { name: string; url: string }[] = [];
    $('a[href$=".pdf"]').each((i, el) => {
        let url = $(el).attr('href')!;
        if (!url.startsWith('http')) url = 'https://hita.com.vn' + url;
        const name = $(el).text().trim() || 'Tài liệu PDF';
        extractedPdfs.push({ name, url });
    });

    if (descHtml) {
        const $desc = cheerio.load(descHtml);
        $desc('iframe, video').remove();
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
        const removes = [/hita/gi, /khali/gi, /đại lý cấp 1/gi, /miễn phí giao hàng/gi];
        removes.forEach(regex => { descHtml = descHtml.replace(regex, 'Đồng Phú Gia'); });
        descHtml = descHtml.replace(/h_i_t_a/gi, 'hita');
    }

    // Process BunnyCDN Uploads
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

    return {
        title, breadcrumbs, price, oldPrice, mainImage, gallery: finalGallery, specs: specsObj, description: descHtml,
        onlineDiscount, exactSku
    };
}

async function main() {
    console.log('--- BẮT ĐẦU PHASE 2: DEEP CRAWL & UPSERT INAX ---');
    
    let brand = await prisma.brands.findFirst({ where: { slug: 'inax' } });
    if (!brand) {
        brand = await prisma.brands.create({ data: { name: 'INAX', slug: 'inax', is_active: true } });
        console.log('✅ Đã tạo Brand INAX');
    }

    const masterList = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    let progress = { completed: [], failed: [] } as { completed: string[], failed: string[] };
    if (fs.existsSync(PROGRESS_FILE)) {
        progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }

    const pending = masterList.filter((p: any) => !progress.completed.includes(p.url));
    console.log(`📊 Tổng URLs: ${masterList.length} | Đã xong: ${progress.completed.length} | Cần chạy: ${pending.length}`);

    const browser = await chromium.launch({ headless: true });
    let context = await browser.newContext();
    let page = await context.newPage();

    let count = 0;
    for (const item of pending) {
        count++;
        console.log(`\n[${count}/${pending.length}] Đang cào: ${item.url}`);
        
        try {
            const slugPart = item.url.split('/').pop()?.replace(/\.html$/, '') || `inax-${Date.now()}`;
            const slug = slugPart.replace(/-\d+$/, ''); // inax-ac-4005vn
            
            const data = await scrapePage(page, item.url, slug);
            
            if (!data) {
                console.log(`    ⚠️  Không lấy được dữ liệu. Bỏ qua.`);
                progress.failed.push(item.url);
                fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
                continue;
            }

            // Tìm SKU thông minh từ tiêu đề
            let sku = data.exactSku || slugPart.replace(/^inax-/, '').replace(/-\d+$/, '').toUpperCase(); // Fallback
            
            if (!data.exactSku) {
                // Refine SKU based on title
                const matches = data.title.match(/\b([A-Z0-9-]{4,})\b/g);
                if (matches) {
                    const filtered = matches.filter(m => !['INAX', 'TOTO'].includes(m.toUpperCase()));
                    if (filtered.length > 0) {
                        sku = filtered[0].toUpperCase();
                    }
                }
            }

            // Map Category
            let subcategorySlug = '';
            for (const bread of data.breadcrumbs) {
                if (CAT_MAP[bread]) subcategorySlug = CAT_MAP[bread];
            }
            
            let subcategory = null;
            let category = null;
            if (subcategorySlug) {
                subcategory = await prisma.subcategories.findFirst({ where: { slug: subcategorySlug } });
                if (subcategory) {
                    category = await prisma.categories.findFirst({ where: { id: subcategory.category_id } });
                }
            }

            // Upsert DB
            const existingProduct = await prisma.products.findFirst({ where: { sku: sku } });
            
            if (existingProduct) {
                await prisma.products.update({
                    where: { id: existingProduct.id },
                    data: {
                        name: data.title,
                        price: data.price > 0 ? data.price : existingProduct.price,
                        original_price: data.oldPrice > 0 ? data.oldPrice : existingProduct.original_price,
                        online_discount_amount: data.onlineDiscount > 0 ? data.onlineDiscount : existingProduct.online_discount_amount,
                        description: data.description || existingProduct.description,
                        specs: data.specs,
                        image_main_url: data.mainImage || existingProduct.image_main_url,
                        source_url: item.url
                    }
                });
                console.log(`    🔄 Đã UPDATE sản phẩm: ${sku}`);
            } else {
                const newProduct = await prisma.products.create({
                    data: {
                        name: data.title,
                        slug: slug,
                        sku: sku,
                        price: data.price,
                        original_price: data.oldPrice,
                        online_discount_amount: data.onlineDiscount > 0 ? data.onlineDiscount : null,
                        description: data.description,
                        specs: data.specs,
                        image_main_url: data.mainImage || '',
                        is_active: true,
                        is_combo: false,
                        brand_id: brand.id,
                        category_id: category?.id || 1,
                        subcategory_id: subcategory?.id || null,
                        source_url: item.url
                    }
                });
                console.log(`    ✨ Đã INSERT sản phẩm mới: ${sku}`);

                // Insert Gallery
                if (data.gallery.length > 0) {
                    const galleryData = data.gallery.map((url, i) => ({
                        product_id: newProduct.id,
                        image_url: url,
                        alt_text: data.title,
                        sort_order: i
                    }));
                    await prisma.product_images.createMany({ data: galleryData });
                    console.log(`    📸 Đã lưu ${data.gallery.length} ảnh gallery.`);
                }
            }

            progress.completed.push(item.url);
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));

        } catch (err: any) {
            console.error(`    ❌ LỖI: ${err.message}`);
            // Restart context on crash
            try { await context.close(); } catch {}
            context = await browser.newContext();
            page = await context.newPage();
            
            // Wait a bit
            await new Promise(r => setTimeout(r, 5000));
        }

        // Delay between requests
        await new Promise(r => setTimeout(r, 2000));
    }

    await browser.close();
    console.log('\n✅ HOÀN TẤT PHASE 2!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
