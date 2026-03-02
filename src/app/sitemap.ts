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
        { url: `${baseUrl}/san-go`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
        { url: `${baseUrl}/lien-he`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
        { url: `${baseUrl}/gioi-thieu`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    ];

    // Gạch ốp lát (Pattern Types + Products)
    const patternTypes = await prisma.pattern_types.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true },
    });
    const patternPages: MetadataRoute.Sitemap = patternTypes.map((pt) => ({
        url: `${baseUrl}/gach-op-lat?pattern=${pt.slug}`,
        lastModified: pt.updated_at || new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));
    const products = await prisma.products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true, pattern_types: { select: { slug: true } } },
    });
    const productPages: MetadataRoute.Sitemap = products
        .filter((p) => p.pattern_types?.slug)
        .map((p) => ({
            url: `${baseUrl}/gach-op-lat/${p.pattern_types!.slug}/${p.slug}`,
            lastModified: p.updated_at || new Date(),
            changeFrequency: "monthly" as const, priority: 0.7,
        }));

    // Thiết bị vệ sinh
    const tbvsProducts = await prisma.tbvs_products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true, tbvs_product_types: { select: { slug: true } } },
    });
    const tbvsPages: MetadataRoute.Sitemap = tbvsProducts
        .filter((p) => p.tbvs_product_types?.slug)
        .map((p) => ({
            url: `${baseUrl}/thiet-bi-ve-sinh/${p.tbvs_product_types!.slug}/${p.slug}`,
            lastModified: p.updated_at || new Date(), changeFrequency: "monthly" as const, priority: 0.7,
        }));

    // Thiết bị bếp
    const bepProducts = await prisma.bep_products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true, bep_product_types: { select: { slug: true } } },
    });
    const bepPages: MetadataRoute.Sitemap = bepProducts
        .filter((p) => p.bep_product_types?.slug)
        .map((p) => ({
            url: `${baseUrl}/thiet-bi-bep/${p.bep_product_types!.slug}/${p.slug}`,
            lastModified: p.updated_at || new Date(), changeFrequency: "monthly" as const, priority: 0.7,
        }));

    // Vật liệu ngành nước
    const nuocProducts = await (prisma as any).nuoc_products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true, nuoc_product_types: { select: { slug: true } } },
    });
    const nuocPages: MetadataRoute.Sitemap = (nuocProducts || [])
        .filter((p: any) => p.nuoc_product_types?.slug)
        .map((p: any) => ({
            url: `${baseUrl}/vat-lieu-nuoc/${p.nuoc_product_types!.slug}/${p.slug}`,
            lastModified: p.updated_at || new Date(), changeFrequency: "monthly" as const, priority: 0.7,
        }));

    // Sàn gỗ
    const sangoProducts = await (prisma as any).sango_products.findMany({
        where: { is_active: true },
        select: { slug: true, updated_at: true, sango_product_types: { select: { slug: true } } },
    });
    const sangoPages: MetadataRoute.Sitemap = (sangoProducts || [])
        .filter((p: any) => p.sango_product_types?.slug)
        .map((p: any) => ({
            url: `${baseUrl}/san-go/${p.sango_product_types!.slug}/${p.slug}`,
            lastModified: p.updated_at || new Date(), changeFrequency: "monthly" as const, priority: 0.7,
        }));

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
        ...patternPages,
        ...productPages,
        ...tbvsPages,
        ...bepPages,
        ...nuocPages,
        ...sangoPages,
        ...blogPages
    ];
}
