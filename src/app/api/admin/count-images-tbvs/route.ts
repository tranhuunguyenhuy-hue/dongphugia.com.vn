import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    const mainCount = await prisma.tbvs_products.count({
        where: { image_main_url: { contains: 'tdm.vn' } }
    });
    
    const galleryCount = await prisma.tbvs_product_images.count({
        where: { image_url: { contains: 'tdm.vn' } }
    });
    
    return NextResponse.json({
        mainImagesRemaining: mainCount,
        galleryImagesRemaining: galleryCount,
        totalRemaining: mainCount + galleryCount,
        timestamp: new Date().toISOString()
    });
}
