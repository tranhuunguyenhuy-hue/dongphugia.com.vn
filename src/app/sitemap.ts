import prisma from "@/lib/prisma";
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn";

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
        { url: `${baseUrl}/tin-tuc`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ];

    // Categories
    const categories = await prisma.category.findMany({ select: { slug: true, updatedAt: true } });
    const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
        url: `${baseUrl}/danh-muc/${cat.slug}`,
        lastModified: cat.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }));

    // Products
    const products = await prisma.product.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
    });
    const productPages: MetadataRoute.Sitemap = products.map((p) => ({
        url: `${baseUrl}/san-pham/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
    }));

    // Collections
    const collections = await prisma.collection.findMany({ select: { slug: true, updatedAt: true } });
    const collectionPages: MetadataRoute.Sitemap = collections.map((c) => ({
        url: `${baseUrl}/bo-suu-tap/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
    }));

    // Blog posts
    const posts = await prisma.post.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
    });
    const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
        url: `${baseUrl}/tin-tuc/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
    }));

    return [...staticPages, ...categoryPages, ...productPages, ...collectionPages, ...postPages];
}
