import prisma from "@/lib/prisma";
import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn";

    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
        { url: `${baseUrl}/gach-op-lat`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ];

    // Pattern type pages — canonical URL is /gach-op-lat?pattern=[slug]
    // (the /gach-op-lat/[slug] route is a redirect to this)
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

    // Product detail pages — canonical URL is /gach-op-lat/[patternSlug]/[productSlug]
    const products = await prisma.products.findMany({
        where: { is_active: true },
        select: {
            slug: true,
            updated_at: true,
            pattern_types: { select: { slug: true } },
        },
    });
    const productPages: MetadataRoute.Sitemap = products
        .filter((p) => p.pattern_types?.slug)
        .map((p) => ({
            url: `${baseUrl}/gach-op-lat/${p.pattern_types!.slug}/${p.slug}`,
            lastModified: p.updated_at || new Date(),
            changeFrequency: "monthly" as const,
            priority: 0.7,
        }));

    return [...staticPages, ...patternPages, ...productPages];
}
