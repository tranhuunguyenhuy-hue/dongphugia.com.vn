import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import fs from 'fs';

const PILOT_URLS = [
    'https://hita.com.vn/bon-cau-1-khoi-inax-ac-4005vn-537.html', // Bồn cầu
    'https://hita.com.vn/chau-rua-duong-vanh-inax-l-2397v-1515.html', // Chậu rửa
    'https://hita.com.vn/voi-lavabo-inax-lfv-1111s-2166.html' // URL tồn tại thay cho sen tắm cũ
];

async function pilotCrawl() {
    console.log('--- BẮT ĐẦU CHẠY PILOT CRAWL (TEST 3 SẢN PHẨM) ---');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const results = [];

    for (const url of PILOT_URLS) {
        console.log(`\nĐang cào: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // Wait 2s for potential dynamic blocks
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const html = await page.content();
        const $ = cheerio.load(html);

        // 1. Tên & Breadcrumbs
        const title = $('h1').text().trim();
        const breadcrumbs = [];
        $('.breadcrumb li, .breadcrumbs li').each((i, el) => {
            breadcrumbs.push($(el).text().trim().replace(/[\n\r\/]/g, '').trim());
        });

        // 2. Giá cả
        const newPrice = $('.product-new-price-land, .product-price .price').first().text().trim();
        const oldPrice = $('.product-old-price-land, .product-price .price-old').first().text().trim();

        // 3. Hình ảnh Gallery
        const rawGallery = [];
        $('.picture-wrapper img, .product-detail-left img, .slick-slide img, #sync1 img, #sync2 img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src');
            if (src && src.startsWith('http')) {
                rawGallery.push(src);
            }
        });
        
        const forbiddenDomains = ['ytimg.com', 'youtube.com', 'youtu.be', 'vimeo.com'];
        const cleanGallery = rawGallery.filter(src => {
            return !forbiddenDomains.some(domain => src.includes(domain));
        });
        const uniqueGallery = [...new Set(cleanGallery)];

        // 4. Thông số kỹ thuật
        const specsObj = {};
        let table = $('#tab-specification table, .product-specification table, .tech-specs table, .table-striped').first();
        if (table.length === 0) table = $('table').first();
        
        table.find('tr').each((i, el) => {
            const th = $(el).find('th, td').first().text().replace(/:/g, '').trim();
            const td = $(el).find('td').last().text().trim();
            if (th && td && th !== td) {
                specsObj[th] = td;
            }
        });

        // 5. Phụ kiện Nguyên Hộp
        const accessories = [];
        $('h2, h3').each((i, el) => {
            if ($(el).text().toLowerCase().includes('nguyên hộp bao gồm')) {
                // Find nearest panel body after this h2
                const container = $(el).closest('.title-common').next('.panel-body');
                if (container.length > 0) {
                    container.find('div, p, li').each((j, div) => {
                        const txt = $(div).text().replace(/&nbsp;/g, ' ').trim();
                        if (txt) accessories.push(txt);
                    });
                } else {
                    // Alternative fallback: grab all sibling elements or next sibling
                    let curr = $(el).parent();
                    while (curr.length > 0 && !curr.hasClass('panel-body')) {
                        let next = curr.next('.panel-body');
                        if (next.length) {
                            next.find('div, p, li').each((j, div) => {
                                const txt = $(div).text().replace(/&nbsp;/g, ' ').trim();
                                if (txt) accessories.push(txt);
                            });
                            break;
                        }
                        // go up
                        if (curr[0].tagName === 'body') break;
                        curr = curr.parent();
                    }
                }
            }
        });

        // 6. Tài liệu PDF
        const pdfs = [];
        $('a[href$=".pdf"]').each((i, el) => {
            pdfs.push($(el).attr('href'));
        });

        // 7. Bài viết Mô tả
        let descHtml = $('.content-desc, .product-description, #tab-description').html() || '';
        let containsIframe = false;
        
        if (descHtml) {
            const $desc = cheerio.load(descHtml);
            $desc('iframe, video').remove();
            
            $desc('img').each((i, img) => {
                const src = $desc(img).attr('src') || '';
                if (forbiddenDomains.some(d => src.includes(d))) {
                    $desc(img).remove();
                }
            });

            descHtml = $desc.html();
            containsIframe = descHtml.includes('<iframe');
            
            // Clean text
            const removes = [/hita/gi, /khali/gi, /đại lý cấp 1/gi, /miễn phí giao hàng/gi];
            removes.forEach(regex => {
                descHtml = descHtml.replace(regex, 'Đồng Phú Gia');
            });
        }

        results.push({
            url,
            productInfo: {
                title: title.replace(/hita/gi, 'Đồng Phú Gia').trim(),
                categories: breadcrumbs.filter(b => b.length > 0),
                price: newPrice,
                originalPrice: oldPrice,
                galleryCount: uniqueGallery.length,
                gallerySample: uniqueGallery.slice(0, 2),
                techSpecs: Object.keys(specsObj).length > 0 ? specsObj : "Không có bảng TS",
                accessories: accessories.length > 0 ? accessories : "Không có phụ kiện",
                documents: pdfs,
                descriptionCleanedLength: descHtml.length,
                containsIframeAfterClean: containsIframe
            }
        });
    }

    await browser.close();

    const outFile = 'scripts/crawl-inax/output/pilot-results.json';
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    console.log(`\n✅ Pilot Crawl hoàn tất. Kết quả lưu tại: ${outFile}`);
}

pilotCrawl().catch(console.error);
