import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import axios from 'axios';
import path from 'path';

const prisma = new PrismaClient();

const BUNNY_ZONE = process.env.BUNNY_STORAGE_ZONE_NAME || 'dpg-products';
const BUNNY_KEY = process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com';
const BUNNY_CDN = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn';

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

async function downloadAndUpload(srcUrl: string, folder: string, sku: string, ext: string): Promise<string | null> {
    try {
        if (!srcUrl.startsWith('http')) srcUrl = 'https://hita.com.vn' + srcUrl;
        if (srcUrl.includes('data:image') || srcUrl.includes('placeholder')) return null;
        
        console.log(`    ⬇️  Downloading ${srcUrl.slice(0, 60)}...`);
        const res = await axios.get(srcUrl, { responseType: 'arraybuffer', timeout: 15000 });
        const buf = Buffer.from(res.data);
        
        const fileName = `${folder}/desc_${sku}_${Date.now()}.${ext}`;
        return await uploadToBunny(buf, fileName);
    } catch (e: any) {
        console.error(`    ❌ Download failed: ${e.message}`);
        return null;
    }
}

async function main() {
    console.log('--- BẮT ĐẦU MIGRATE ẢNH TRONG BÀI VIẾT (DESCRIPTION) ---');
    
    if (!BUNNY_KEY) {
        console.error('❌ LỖI: Thiếu BUNNY_STORAGE_API_KEY trong .env');
        return;
    }

    const products = await prisma.products.findMany({
        where: {
            brands: { slug: 'inax' },
            description: { contains: 'hita.com.vn' }
        },
        select: { id: true, sku: true, description: true }
    });

    console.log(`📊 Tìm thấy ${products.length} sản phẩm INAX chứa link hita trong bài viết.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (!p.description) continue;

        console.log(`\n[${i+1}/${products.length}] Xử lý SKU: ${p.sku}`);
        const $ = cheerio.load(p.description);
        let updated = false;

        const imgs = $('img').toArray();
        for (const el of imgs) {
            const img = $(el);
            let src = img.attr('src');
            
            if (src && src.includes('hita.com.vn')) {
                // Tách định dạng file (jpg, png, webp...)
                let ext = 'jpg';
                const match = src.match(/\.([a-zA-Z0-9]+)(\?|$)/);
                if (match && match[1]) {
                    ext = match[1].toLowerCase();
                }

                // Chạy script download và upload
                const cdnUrl = await downloadAndUpload(src, 'product_desc_images', p.sku || `sp-${p.id}`, ext);
                if (cdnUrl) {
                    img.attr('src', cdnUrl);
                    updated = true;
                    console.log(`    ✅ Đã thay link: ${cdnUrl}`);
                } else {
                    failCount++;
                }
            }
        }

        if (updated) {
            await prisma.products.update({
                where: { id: p.id },
                data: { description: $('body').html() }
            });
            successCount++;
        }
    }

    console.log(`\n🎉 HOÀN TẤT MIGRATE ẢNH BÀI VIẾT INAX!`);
    console.log(`✅ Cập nhật thành công: ${successCount} sản phẩm.`);
    console.log(`❌ Lỗi tải ảnh: ${failCount} tấm.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
