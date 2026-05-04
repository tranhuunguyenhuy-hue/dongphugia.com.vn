const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();
const LOG_FILE = 'crawl_tbvs_advanced.log';

function logMsg(msg) {
    const output = `[${new Date().toISOString()}] ${msg}`;
    console.log(output);
    fs.appendFileSync(LOG_FILE, output + '\n');
}

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateSlug(text) {
    return text.toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

async function crawlProductDetail(page, productUrl) {
    try {
        await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(1500); // Allow JS to load variants

        const name = await page.$eval('h1, h1.product-name, .title-product', el => el.innerText.trim()).catch(() => null);
        
        // Cố gắng tìm SKU trong nhiều selector khác nhau
        let sku = await page.$eval('.sku, .product-sku, .item-sku, span[itemprop="sku"]', el => el.innerText.replace(/SKU:?\s*/i, '').trim()).catch(() => null);
        if (!sku) {
             // Fallback tìm SKU trong đoạn text bất kỳ chứa SKU
             const textContent = await page.$eval('body', el => el.innerText);
             const skuMatch = textContent.match(/SKU:\s*([A-Za-z0-9-]+)/i);
             if (skuMatch) sku = skuMatch[1];
        }

        let priceStr = await page.$eval('.special-price, .price, .product-price, .current-price', el => el.innerText.replace(/[^\d]/g, '')).catch(() => null);
        const image = await page.$eval('.product-image img, .img-box img, .main-image img', el => el.src).catch(() => null);

        if (!name || !sku) {
            logMsg(`   [!] Bỏ qua (Thiếu Name hoặc SKU): ${productUrl}`);
            return;
        }

        const price = priceStr ? parseInt(priceStr) : null;

        // Lưu vào Database (Draft mode)
        const existing = await prisma.products.findFirst({ where: { sku } });
        if (!existing) {
            const newProduct = await prisma.products.create({
                data: {
                    sku,
                    name,
                    slug: generateSlug(name) + '-' + sku.toLowerCase(),
                    price: price,
                    image_main_url: image,
                    category_id: 1, // 1: Thiết bị vệ sinh
                    is_active: false, // DRAFT
                    stock_status: 'in_stock'
                }
            });
            logMsg(`   [+] TẠO MỚI (Draft): [${sku}] ${name} - Giá: ${price} - ID: ${newProduct.id}`);

            // Vá lỗi liên kết (Mapping)
            const updated = await prisma.product_relationships.updateMany({
                where: { child_sku: sku, child_id: null },
                data: { child_id: newProduct.id }
            });
            if (updated.count > 0) {
                logMsg(`       -> Đã MAP thành công ${updated.count} liên kết bị thiếu cho SKU ${sku}`);
            }
        } else {
            logMsg(`   [-] Bỏ qua (Đã tồn tại): [${sku}] ${name}`);
        }

        // Lấy thêm các biến thể phụ (Phụ kiện, Component đi kèm nếu Hita có hiển thị trong bảng)
        // Hita thường hiển thị bảng phụ kiện
        const componentSkus = await page.$$eval('.table-component tr, .accessories .item-sku', els => {
            return els.map(el => el.innerText.replace(/SKU:?\s*/i, '').trim()).filter(Boolean);
        }).catch(() => []);

        // Nêu tìm thấy SKU phụ kiện mà chưa có, chúng ta cũng ghi nhận (nhưng không có tên nên chỉ log lại để xử lý sau)
        if (componentSkus.length > 0) {
            logMsg(`       -> Tìm thấy ${componentSkus.length} SKU phụ kiện đi kèm trong trang này.`);
        }

    } catch (e) {
        logMsg(`   [X] Lỗi khi cào ${productUrl}: ${e.message}`);
    }
}

async function runPipeline() {
    logMsg("=== BẮT ĐẦU CHIẾN DỊCH CÀN QUÉT THIẾT BỊ VỆ SINH ===");
    fs.writeFileSync(LOG_FILE, ''); // Reset log
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    const baseUrls = [
        'https://hita.com.vn/thuong-hieu-thiet-bi-ve-sinh-toto.html',
        'https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html',
        'https://hita.com.vn/thiet-bi-ve-sinh-caesar-383.html'
    ];
    const MAX_PAGES = 100; // Quét tối đa 100 trang

    try {
        for (const baseUrl of baseUrls) {
            logMsg(`\n========== BẮT ĐẦU CÀO DANH MỤC: ${baseUrl} ==========`);
            let currentPage = 1;
            while (currentPage <= MAX_PAGES) {
            logMsg(`\n--- ĐANG QUÉT TRANG ${currentPage} ---`);
            const pageUrl = currentPage === 1 ? baseUrl : `${baseUrl}?p=${currentPage}`;
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await delay(2000);

            // Tìm toàn bộ link sản phẩm trên trang
            const productLinks = await page.$$eval('a', anchors => {
                return [...new Set(anchors.map(a => a.href).filter(h => h.includes('.html') && h.includes('https://hita.com.vn/') && !h.includes('thiet-bi-ve-sinh-231')))];
            });

            if (productLinks.length === 0) {
                logMsg("Không tìm thấy link sản phẩm nào. Có thể đã hết trang hoặc bị chặn. Dừng cào.");
                break;
            }

            logMsg(`Tìm thấy ${productLinks.length} sản phẩm trên trang ${currentPage}. Bắt đầu bóc tách...`);

            // Mở 1 page phụ để quét chi tiết từng sản phẩm
            const detailPage = await context.newPage();
            for (let i = 0; i < productLinks.length; i++) {
                await crawlProductDetail(detailPage, productLinks[i]);
            }
            await detailPage.close();

            // Chuyển sang trang tiếp theo
            currentPage++;
            await delay(2000); // Nghỉ 2s trước khi sang trang mới
        }
    }

    } catch (e) {
        logMsg(`Lỗi nghiêm trọng: ${e.message}`);
    } finally {
        await browser.close();
        await prisma.$disconnect();
        logMsg("=== KẾT THÚC CHIẾN DỊCH CÀN QUÉT ===");
    }
}

runPipeline();
