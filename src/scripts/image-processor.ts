import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const prisma = new PrismaClient();
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET_NAME = 'dongphugia-images';
const FOLDER_NAME = 'tbvs';
const DELAY_BETWEEN_UPLOADS = 50; // ms

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getExtension(url, contentType) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('.png')) return '.png';
    if (lowerUrl.includes('.jpg') || lowerUrl.includes('.jpeg')) return '.jpg';
    if (lowerUrl.includes('.webp')) return '.webp';
    if (lowerUrl.includes('.gif')) return '.gif';
    
    if (contentType) {
        if (contentType.includes('png')) return '.png';
        if (contentType.includes('webp')) return '.webp';
        if (contentType.includes('gif')) return '.gif';
    }
    return '.jpg';
}

async function downloadImage(url) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    
    if (!res.ok) {
        throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }
    
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type');
    return { buffer, contentType };
}

async function uploadToSupabase(buffer, contentType, filename) {
    const filePath = `${FOLDER_NAME}/${filename}`;
    const { data, error } = await supabase.storage
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
}

async function processImageUrl(originalUrl, prefix = 'img') {
    if (!originalUrl) return null;
    const lower = originalUrl.toLowerCase();
    if (!lower.includes('tdm.vn') && !lower.includes('tuandat.vn')) {
        return originalUrl;
    }

    try {
        const { buffer, contentType } = await downloadImage(originalUrl);
        const ext = getExtension(originalUrl, contentType);
        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
        const publicUrl = await uploadToSupabase(buffer, contentType, filename);
        return publicUrl;
    } catch (e) {
        console.error(`  [X] Error processing ${originalUrl}:`, e.message);
        return originalUrl;
    }
}

async function main() {
    console.log("=== STARTING IMAGE PROCESSING ===");
    
    // 1. Process Main Images
    console.log("\\n1. Fetching products with tdm.vn main images...");
    const productsToProcess = await prisma.tbvs_products.findMany({
        where: { image_main_url: { contains: 'tdm.vn' } },
        select: { id: true, sku: true, image_main_url: true }
    });
    
    console.log(`Found ${productsToProcess.length} products to process main image.`);
    let idx = 0;
    for (const product of productsToProcess) {
        idx++;
        if (idx % 100 === 0) console.log(`Processed ${idx}/${productsToProcess.length} main images...`);
        const newUrl = await processImageUrl(product.image_main_url, `main_${product.id}`);
        
        if (newUrl && newUrl !== product.image_main_url) {
            await prisma.tbvs_products.update({
                where: { id: product.id },
                data: { image_main_url: newUrl }
            });
        }
        await sleep(DELAY_BETWEEN_UPLOADS);
    }

    // 2. Process Gallery Images
    console.log("\\n2. Fetching gallery images containing tdm.vn...");
    const imagesToProcess = await prisma.tbvs_product_images.findMany({
        where: { url: { contains: 'tdm.vn' } },
        select: { id: true, product_id: true, url: true }
    });
    
    console.log(`Found ${imagesToProcess.length} gallery images to process.`);
    idx = 0;
    for (const img of imagesToProcess) {
        idx++;
        if (idx % 100 === 0) console.log(`Processed ${idx}/${imagesToProcess.length} gallery images...`);
        const newUrl = await processImageUrl(img.url, `gal_${img.product_id}_${img.id}`);
        
        if (newUrl && newUrl !== img.url) {
            await prisma.tbvs_product_images.update({
                where: { id: img.id },
                data: { url: newUrl }
            });
        }
        await sleep(DELAY_BETWEEN_UPLOADS);
    }
    
    console.log("\\n=== IMAGE PROCESSING COMPLETE ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
