import prisma from "@/lib/prisma";
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn";

    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
        { url: `${baseUrl}/gach-op-lat`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/thiet-bi-ve-sinh`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/thiet-bi-bep`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/vat-lieu-nuoc`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/lien-he`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
        { url: `${baseUrl}/gioi-thieu`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    ];

    // LEO-366: Legacy per-category product sitemap generation removed
    // Will be restored in Phase 3 with unified product schema
    // Only static pages and blog posts remain for now

    // Blog pages
    let blogPages: MetadataRoute.Sitemap = [
        { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.8 },
    ];
    try {
        const blogPosts = await (prisma as any).blog_posts.findMany({
            where: { status: 'published', published_at: { lte: new Date() } },
            select: { slug: true, updated_at: true, blog_categories: { select: { slug: true } } },
        })
        blogPages = [
            ...blogPages,
            ...(blogPosts || [])
                .filter((p: any) => p.blog_categories?.slug)
                .map((p: any) => ({
                    url: `${baseUrl}/blog/${p.blog_categories!.slug}/${p.slug}`,
                    lastModified: p.updated_at || new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.6,
                })),
        ]
    } catch (e) {
        console.warn("Blog posts table might not exist yet, skipping blog posts sitemap generation.");
    }

    return [
        ...staticPages,
        ...blogPages
    ];
}
