import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCanonicalSiteUrl } from '@/lib/site';
import { buildPublicProductVisibilityWhere } from '@/lib/public-product-visibility';

export const revalidate = 86400; // 24 hours

export async function GET() {
    const baseUrl = getCanonicalSiteUrl();
    const where = buildPublicProductVisibilityWhere();
    const totalProducts = await prisma.products.count({ where });
    const PAGE_SIZE = 2000;
    const sitemapsCount = Math.ceil(totalProducts / PAGE_SIZE);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static Sitemap
    xml += `  <sitemap>\n    <loc>${baseUrl}/sitemap_static.xml</loc>\n  </sitemap>\n`;

    // Product Sitemaps
    for (let i = 1; i <= sitemapsCount; i++) {
        xml += `  <sitemap>\n    <loc>${baseUrl}/sitemap_product_${i}.xml</loc>\n  </sitemap>\n`;
    }

    xml += `</sitemapindex>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'text/xml',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate'
        }
    });
}
