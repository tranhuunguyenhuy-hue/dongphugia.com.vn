import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request, context: any) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.dongphugia.com.vn";
    
    // In Next.js 15+, params is asynchronous. We await it to extract the id.
    const params = await context.params;
    const sitemapId = parseInt(params.id, 10);
    
    if (isNaN(sitemapId) || sitemapId < 0) {
        return new NextResponse("Not Found", { status: 404 });
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const addUrl = (url: string, lastMod: string, changeFreq: string, priority: number) => {
        xml += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>${changeFreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>\n`;
    };

    if (sitemapId === 0) {
        // Static pages
        const now = new Date().toISOString();
        addUrl(baseUrl, now, "daily", 1.0);
        addUrl(`${baseUrl}/gach-op-lat`, now, "weekly", 0.9);
        addUrl(`${baseUrl}/thiet-bi-ve-sinh`, now, "weekly", 0.9);
        addUrl(`${baseUrl}/thiet-bi-bep`, now, "weekly", 0.9);
        addUrl(`${baseUrl}/vat-lieu-nuoc`, now, "weekly", 0.9);
        addUrl(`${baseUrl}/lien-he`, now, "monthly", 0.7);
        addUrl(`${baseUrl}/gioi-thieu`, now, "monthly", 0.7);
        addUrl(`${baseUrl}/blog`, now, "daily", 0.8);
        addUrl(`${baseUrl}/dich-vu-lap-dat`, now, "monthly", 0.7);

        try {
            const blogPosts = await (prisma as any).blog_posts.findMany({
                where: { status: 'published', published_at: { lte: new Date() } },
                select: { slug: true, updated_at: true, blog_categories: { select: { slug: true } } },
            });
            for (const p of blogPosts) {
                if (p.blog_categories?.slug) {
                    addUrl(`${baseUrl}/blog/${p.blog_categories.slug}/${p.slug}`, (p.updated_at || new Date()).toISOString(), "weekly", 0.6);
                }
            }
        } catch (e) {
            console.warn("Blog posts not available");
        }
    } else {
        const limit = 1000;
        const skip = (sitemapId - 1) * limit;

        const products = await prisma.products.findMany({
            where: { is_active: true },
            select: { slug: true, updated_at: true, categories: { select: { slug: true } }, subcategories: { select: { slug: true } } },
            skip,
            take: limit,
            orderBy: { id: 'asc' }
        });

        if (products.length === 0) {
            return new NextResponse("Not Found", { status: 404 });
        }

        for (const p of products) {
            let url = `${baseUrl}/${p.categories.slug}/${p.slug}`;
            if (p.subcategories?.slug) {
                url = `${baseUrl}/${p.categories.slug}/${p.subcategories.slug}/${p.slug}`;
            }
            addUrl(url, (p.updated_at || new Date()).toISOString(), "weekly", 0.6);
        }
    }

    xml += `</urlset>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate'
        }
    });
}
