import { Metadata } from "next"
import type { Prisma } from "@prisma/client"
import { connection } from "next/server"
import prisma from "@/lib/prisma"
import { buildPublicListingVisibilityWhere } from "@/lib/public-product-visibility"
import { canonicalUrl } from "@/lib/site"
import { CategoryRootView } from "@/components/category/category-root-view"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Vật Liệu Nước",
    description: "Máy nước nóng, máy lọc nước, bồn chứa, máy bơm từ các thương hiệu uy tín tại Đà Lạt.",
    keywords: ["vật liệu nước", "máy nước nóng", "máy lọc nước", "Đà Lạt"],
    alternates: { canonical: canonicalUrl("/vat-lieu-nuoc") },
    openGraph: {
        title: "Vật Liệu Nước",
        description: "Máy nước nóng, máy lọc nước, bồn chứa, máy bơm từ các thương hiệu uy tín tại Đà Lạt.",
        url: canonicalUrl("/vat-lieu-nuoc"),
    },
}

const CATEGORY_SLUG = "vat-lieu-nuoc"
const CATEGORY_NAME = "Vật Liệu Nước"
const BASE_PATH = "/vat-lieu-nuoc"
const EMOJI_FALLBACK = "💧"
const LISTING_PRODUCT_WHERE = buildPublicListingVisibilityWhere()

interface PageProps {
    searchParams: Promise<{ brands?: string; price?: string }>
}

export default async function VatLieuNuocPage({ searchParams }: PageProps) {
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
        prisma.subcategories.findMany({
            where: { categories: { slug: CATEGORY_SLUG }, is_active: true },
            orderBy: { sort_order: "asc" },
            include: { _count: { select: { products: { where: LISTING_PRODUCT_WHERE } } } },
        }),
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
