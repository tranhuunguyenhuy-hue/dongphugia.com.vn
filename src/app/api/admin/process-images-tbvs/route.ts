import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET_NAME = 'dongphugia-images';
const FOLDER_NAME = 'tbvs';
const BATCH_SIZE = 50;

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getExtension(url: string, contentType: string | null) {
    const lower = url.toLowerCase();
    if (lower.includes('.png')) return '.png';
    if (lower.includes('.jpg') || lower.includes('.jpeg')) return '.jpg';
    if (lower.includes('.webp')) return '.webp';
    if (lower.includes('.gif')) return '.gif';
    
    if (contentType) {
        if (contentType.includes('png')) return '.png';
        if (contentType.includes('webp')) return '.webp';
        if (contentType.includes('gif')) return '.gif';
    }
    return '.jpg';
}

async function processImageUrl(originalUrl: string, prefix = 'img'): Promise<string> {
    if (!originalUrl) return originalUrl;
    const lower = originalUrl.toLowerCase();
    if (!lower.includes('tdm.vn') && !lower.includes('tuandat.vn')) {
        return originalUrl;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(originalUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const buffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type');
        const ext = getExtension(originalUrl, contentType);
        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
        const filePath = `${FOLDER_NAME}/${filename}`;

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: contentType || 'image/jpeg',
                upsert: true
            });
            
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
            
        return publicUrl;
    } catch (e: any) {
        console.error(`[X] Error processing ${originalUrl}:`, e.message);
        return originalUrl.replace('tdm.vn', 'tdm.vn_failed');
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'main'; // 'main' or 'gallery'
    const limit = parseInt(searchParams.get('limit') || String(BATCH_SIZE));

    let processedCount = 0;
    
    if (type === 'main') {
        const productsToProcess = await prisma.tbvs_products.findMany({
            where: { image_main_url: { contains: 'tdm.vn' } },
            select: { id: true, sku: true, image_main_url: true },
            take: limit
        });
        
        if (productsToProcess.length === 0) {
            return NextResponse.redirect(new URL('/api/admin/process-images-tbvs?type=gallery', request.url));
        }
        
        for (const product of productsToProcess) {
            if (!product.image_main_url) continue;
            const newUrl = await processImageUrl(product.image_main_url, `main_${product.id}`);
            if (newUrl && newUrl !== product.image_main_url) {
                await prisma.tbvs_products.update({
                    where: { id: product.id },
                    data: { image_main_url: newUrl }
                });
                processedCount++;
            }
        }
        
        // Auto-redirect to process next batch
        return NextResponse.redirect(new URL(`/api/admin/process-images-tbvs?type=main&ts=${Date.now()}`, request.url));
        
    } else {
        const imagesToProcess = await prisma.tbvs_product_images.findMany({
            where: { image_url: { contains: 'tdm.vn' } },
            select: { id: true, product_id: true, image_url: true },
            take: limit
        });
        
        if (imagesToProcess.length === 0) {
            return NextResponse.json({ status: 'done', message: 'All images processed successfully!' });
        }
        
        for (const img of imagesToProcess) {
            if (!img.image_url) continue;
            const newUrl = await processImageUrl(img.image_url, `gal_${img.product_id}_${img.id}`);
            if (newUrl && newUrl !== img.image_url) {
                await prisma.tbvs_product_images.update({
                    where: { id: img.id },
                    data: { image_url: newUrl }
                });
                processedCount++;
            }
        }
        
        // Auto-redirect to process next batch
        return NextResponse.redirect(new URL(`/api/admin/process-images-tbvs?type=gallery&ts=${Date.now()}`, request.url));
    }
}
