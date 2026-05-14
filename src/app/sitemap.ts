import prisma from "@/lib/prisma";
import { MetadataRoute } from "next";

export async function generateSitemaps() {
    // Generate sitemaps dynamically based on total products
    const totalProducts = await prisma.products.count({ where: { is_active: true } });
    const itemsPerSitemap = 1000;
    const sitemapsCount = Math.ceil(totalProducts / itemsPerSitemap);
    
    // sitemap id 0 is for static pages and blog posts
    // id 1 to N are for products
    const sitemaps = [];
    for (let i = 0; i <= sitemapsCount; i++) {
        sitemaps.push({ id: i });
    }
    return sitemaps;
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.dongphugia.com.vn";

    // Static pages and Blog posts (id = 0)
    if (id === 0) {
        const staticPages: MetadataRoute.Sitemap = [
            { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
            { url: `${baseUrl}/gach-op-lat`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
            { url: `${baseUrl}/thiet-bi-ve-sinh`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
            { url: `${baseUrl}/thiet-bi-bep`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
            { url: `${baseUrl}/vat-lieu-nuoc`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
            { url: `${baseUrl}/lien-he`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
            { url: `${baseUrl}/gioi-thieu`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
            { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
            { url: `${baseUrl}/dich-vu-lap-dat`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        ];

        let blogPages: MetadataRoute.Sitemap = [];
        try {
            const blogPosts = await (prisma as any).blog_posts.findMany({
                where: { status: 'published', published_at: { lte: new Date() } },
                select: { slug: true, updated_at: true, blog_categories: { select: { slug: true } } },
            })
            blogPages = (blogPosts || [])
                .filter((p: any) => p.blog_categories?.slug)
                .map((p: any) => ({
                    url: `${baseUrl}/blog/${p.blog_categories!.slug}/${p.slug}`,
                    lastModified: p.updated_at || new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.6,
                }))
        } catch (e) {
            console.warn("Blog posts table might not exist yet, skipping blog posts sitemap generation.");
        }

        return [...staticPages, ...blogPages];
    }

    // Product pages (id > 0)
    const limit = 1000;
    const skip = (id - 1) * limit;

    const products = await prisma.products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true, categories: { select: { slug: true } }, subcategories: { select: { slug: true } } },
        skip,
        take: limit,
        orderBy: { id: 'asc' }
    });

    const productPages: MetadataRoute.Sitemap = products.map((p) => {
        let url = `${baseUrl}/${p.categories.slug}/${p.slug}`;
        if (p.subcategories?.slug) {
            url = `${baseUrl}/${p.categories.slug}/${p.subcategories.slug}/${p.slug}`;
        }
        return {
            url,
            lastModified: p.updated_at || new Date(),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        }
    });

    return productPages;
}
