import { Metadata } from "next"
import type { Prisma } from "@prisma/client"
import { connection } from "next/server"
import prisma from "@/lib/prisma"
import { getPublicListingLeaves } from "@/lib/public-api-products"
import { buildPublicListingVisibilityWhere } from "@/lib/public-product-visibility"
import { canonicalUrl } from "@/lib/site"
import { CategoryRootView } from "@/components/category/category-root-view"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Gạch Ốp Lát",
    description: "Gạch ceramic, porcelain, đá ốp lát từ Vietceramics. Đa dạng kích thước.",
    keywords: ["gạch ốp lát", "gạch ceramic", "gạch porcelain", "Vietceramics", "Đà Lạt"],
    alternates: { canonical: canonicalUrl("/gach-op-lat") },
    openGraph: {
        title: "Gạch Ốp Lát",
        description: "Gạch ceramic, porcelain, đá ốp lát từ Vietceramics. Đa dạng kích thước.",
        url: canonicalUrl("/gach-op-lat"),
    },
}

const CATEGORY_SLUG = "gach-op-lat"
const CATEGORY_NAME = "Gạch Ốp Lát"
const BASE_PATH = "/gach-op-lat"
const EMOJI_FALLBACK = "🏠"
const LISTING_PRODUCT_WHERE = buildPublicListingVisibilityWhere()

interface PageProps {
    searchParams: Promise<{ brands?: string; price?: string }>
}

export default async function GachOpLatPage({ searchParams }: PageProps) {
    await connection()

    const params = await searchParams
    const activeBrands = params.brands?.split(",").filter(Boolean) ?? []
    const [priceMin, priceMax] = params.price?.split("-").map(Number) ?? []

    const featuredWhere: Prisma.productsWhereInput = {
        categories: { slug: CATEGORY_SLUG },
        is_featured: true,
        ...LISTING_PRODUCT_WHERE,
    }
    if (activeBrands.length > 0) featuredWhere.brands = { name: { in: activeBrands } }
    if (priceMin !== undefined && priceMax !== undefined)
        featuredWhere.price = { gte: priceMin, lte: priceMax }

    const [bannerResult, subcategories, featuredProducts, brands] = await Promise.all([
        prisma.$queryRaw<{ banner_url: string | null }[]>`SELECT banner_url FROM categories WHERE slug = ${CATEGORY_SLUG} LIMIT 1`,
        getPublicListingLeaves(CATEGORY_SLUG),
        prisma.products.findMany({
            where: featuredWhere,
            orderBy: { sort_order: "asc" },
            take: 8,
            include: {
                brands: { select: { name: true } },
                subcategories: { select: { name: true, slug: true } },
                colors: { select: { name: true, hex_code: true } },
                product_feature_values: { select: { product_features: { select: { name: true, icon_name: true } } } },
            },
        }),
        prisma.brands.findMany({
            where: { is_active: true, products: { some: { categories: { slug: CATEGORY_SLUG }, ...LISTING_PRODUCT_WHERE } } },
            select: { id: true, name: true, slug: true },
            orderBy: { sort_order: "asc" },
            take: 20,
        }),
    ])

    const bannerUrl = bannerResult[0]?.banner_url ?? null

    return (
        <CategoryRootView
            categoryName={CATEGORY_NAME}
            basePath={BASE_PATH}
            emojiFallback={EMOJI_FALLBACK}
            bannerUrl={bannerUrl}
            subcategories={subcategories}
            featuredProducts={featuredProducts}
            brands={brands}
            isFiltered={activeBrands.length > 0 || Boolean(params.price)}
        />
    )
}
