import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCanonicalSiteUrl } from '@/lib/site';

export const revalidate = 86400; // 24 hours

export async function GET() {
    const baseUrl = getCanonicalSiteUrl();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const addUrl = (url: string, lastMod: string, changeFreq: string, priority: number) => {
        xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>${changeFreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>\n`;
    };

    const now = new Date().toISOString();
    addUrl(baseUrl, now, 'daily', 1.0);
    addUrl(`${baseUrl}/gach-op-lat`, now, 'weekly', 0.9);
    addUrl(`${baseUrl}/thiet-bi-ve-sinh`, now, 'weekly', 0.9);
    addUrl(`${baseUrl}/thiet-bi-bep`, now, 'weekly', 0.9);
    addUrl(`${baseUrl}/vat-lieu-nuoc`, now, 'weekly', 0.9);
    addUrl(`${baseUrl}/lien-he`, now, 'monthly', 0.7);
    addUrl(`${baseUrl}/gioi-thieu`, now, 'monthly', 0.7);
    addUrl(`${baseUrl}/blog`, now, 'daily', 0.8);
    addUrl(`${baseUrl}/dich-vu-lap-dat`, now, 'monthly', 0.7);

    try {
        const blogPosts = await prisma.blog_posts.findMany({
            where: { status: 'published', published_at: { lte: new Date() } },
            select: { slug: true, updated_at: true, blog_categories: { select: { slug: true } } },
        });
        blogPosts.forEach(p => {
            if (p.blog_categories?.slug) {
                addUrl(`${baseUrl}/blog/${p.blog_categories.slug}/${p.slug}`, (p.updated_at || new Date()).toISOString(), 'weekly', 0.6);
            }
        });
    } catch (e) {
        console.warn("Blog posts error:", e);
    }

    xml += `</urlset>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'text/xml',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate'
        }
    });
}
