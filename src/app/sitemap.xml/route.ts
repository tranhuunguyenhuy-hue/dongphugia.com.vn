import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.dongphugia.com.vn";
    const totalProducts = await prisma.products.count({ where: { is_active: true } });
    const itemsPerSitemap = 1000;
    const sitemapsCount = Math.ceil(totalProducts / itemsPerSitemap);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    // id = 0 (Static and Blog)
    xml += `  <sitemap>\n    <loc>${baseUrl}/sitemap-0.xml</loc>\n  </sitemap>\n`;

    // id = 1 to N (Products)
    for (let i = 1; i <= sitemapsCount; i++) {
        xml += `  <sitemap>\n    <loc>${baseUrl}/sitemap-${i}.xml</loc>\n  </sitemap>\n`;
    }

    xml += `</sitemapindex>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate'
        }
    });
}
