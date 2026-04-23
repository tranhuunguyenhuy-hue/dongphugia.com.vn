import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPublicProducts, getAvailableFilters } from "@/lib/public-api-products"
import prisma from "@/lib/prisma"
import { ProductCard } from "@/components/ui/product-card"
import { ProductPagination } from "@/components/ui/product-pagination"
import { AdvancedSidebarFilter } from "@/components/category/advanced-sidebar-filter"
import { ActiveFilters, ActiveFilterDict } from "@/components/category/active-filters"
import { CategoryMobileFilter } from "@/components/category/category-mobile-filter"
import { CategorySort } from "@/components/category/category-sort"
import { SubcategoryIconGrid } from "@/components/category/subcategory-icon-grid"
import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"

export const revalidate = 3600

const CATEGORY_SLUG = "gach-op-lat"
const CATEGORY_NAME = "Gạch Ốp Lát"
const BASE_PATH = "/gach-op-lat"
const PAGE_SIZE = 24

interface PageProps {
    params: Promise<{ sub: string }>
    searchParams: Promise<{ [key: string]: string | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { sub } = await params
    const subcategory = await prisma.subcategories.findFirst({
        where: { slug: sub, is_active: true },
    })
    if (!subcategory) return { title: `${CATEGORY_NAME} | Đông Phú Gia` }
    return {
        title: `${subcategory.name} | ${CATEGORY_NAME} | Đông Phú Gia`,
        description: subcategory.description || `${subcategory.name} cao cấp chính hãng tại Đông Phú Gia Đà Lạt.`,
    }
}

export default async function GachOpLatSubPage({ params, searchParams }: PageProps) {
    const { sub } = await params
    const sp = await searchParams

    const subcategory = await prisma.subcategories.findFirst({
        where: { slug: sub, is_active: true },
    })
    if (!subcategory) notFound()

    const currentPage = Math.max(1, parseInt(sp.page || "1"))
    const activeBrandSlugs = sp.brand
    const activeFeatureSlugs = sp.features
    const activeMaterialSlugs = sp.material
    const activeOriginSlugs = sp.origin
    const isNew = sp.is_new === 'true'
    const isFeatured = sp.is_featured === 'true'

    let price_min: number | undefined
    let price_max: number | undefined
    if (sp.price) {
        const [a, b] = sp.price.split("-").map(Number)
        if (!isNaN(a)) price_min = a
        if (!isNaN(b)) price_max = b
    }

    const sortParam = sp.sort
    let sortBy: 'sort_order' | 'created_at' | 'name' | 'price' = 'sort_order'
    let sortDir: 'asc' | 'desc' = 'asc'
    if (sortParam === 'price-asc') { sortBy = 'price'; sortDir = 'asc' }
    else if (sortParam === 'price-desc') { sortBy = 'price'; sortDir = 'desc' }
    else if (sortParam === 'newest') { sortBy = 'created_at'; sortDir = 'desc' }

    const [availableFilters, allSubcategories, { products, totalPages, total }] = await Promise.all([
        getAvailableFilters(CATEGORY_SLUG),
        prisma.subcategories.findMany({
            where: { categories: { slug: CATEGORY_SLUG }, is_active: true },
            orderBy: { sort_order: "asc" },
            include: { _count: { select: { products: { where: { is_active: true } } } } },
        }),
        getPublicProducts({
            category_slug: CATEGORY_SLUG,
            subcategory_slugs: sub,
            brand_slug: activeBrandSlugs,
            feature_slugs: activeFeatureSlugs,
            material_slug: activeMaterialSlugs,
            origin_slug: activeOriginSlugs,
            is_new: isNew ? true : undefined,
            is_featured: isFeatured ? true : undefined,
            price_min, price_max,
            page: currentPage, pageSize: PAGE_SIZE, sortBy, sortDir,
        }),
    ])

    const filterDict: ActiveFilterDict = {}
    availableFilters.brands.forEach(f => filterDict[f.slug] = f.name)
    availableFilters.features.forEach(f => filterDict[f.slug] = f.name)
    availableFilters.materials.forEach(f => filterDict[f.slug] = f.name)
    availableFilters.origins.forEach(f => filterDict[f.slug] = f.name)

    return (
        <main className="max-w-[1380px] mx-auto px-5 lg:px-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-[12px] text-neutral-400 mt-5 mb-0" aria-label="Breadcrumb">
                <Home className="h-3 w-3 flex-shrink-0" />
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <Link href="/" className="hover:text-neutral-700 transition-colors">Trang chủ</Link>
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <Link href={BASE_PATH} className="hover:text-neutral-700 transition-colors">{CATEGORY_NAME}</Link>
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <span className="text-neutral-600 font-medium">{subcategory.name}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start py-8 lg:py-10">
                {/* ── Sidebar 30% ── */}
                <aside className="w-full lg:w-[290px] flex-shrink-0 lg:sticky lg:top-24 scroll-sidebar flex flex-col gap-4">
                    <Suspense fallback={<div className="h-96 bg-neutral-100 animate-pulse rounded-lg" />}>
                        <AdvancedSidebarFilter availableFilters={availableFilters} hideSubcategoryFilter />
                    </Suspense>
                </aside>

                {/* ── Main 70% ── */}
                <div className="flex-1 w-full min-w-0 pb-16 space-y-8">
                    {/* Subcategory icon grid */}
                    <SubcategoryIconGrid
                        subcategories={allSubcategories}
                        basePath={BASE_PATH}
                        activeSlug={sub}
                    />

                    {/* Divider */}
                    <div className="border-t border-neutral-100" />

                    {/* Title and descriptions (formerly CategoryHeader) */}
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-900 mb-2">{subcategory.name}</h1>
                        <p className="text-sm text-neutral-500">
                            {subcategory.description || 'Gạch ốp lát cao cấp chính hãng · Đa dạng kích thước · Tư vấn miễn phí'}
                        </p>
                    </div>

                    <div className="mb-6 flex flex-col gap-3">
                        <div className="flex justify-between items-center bg-neutral-50 lg:bg-transparent lg:border-none lg:p-0 px-4 py-3 rounded-xl border border-neutral-200">
                            <span className="text-sm font-medium text-neutral-500">
                                <strong className="text-neutral-900">{total.toLocaleString('vi-VN')}</strong> sản phẩm
                            </span>
                            <div className="flex items-center gap-2">
                                <CategoryMobileFilter availableFilters={availableFilters} />
                                <CategorySort />
                            </div>
                        </div>
                        <Suspense><ActiveFilters filterDict={filterDict} excludeKeys={["sub"]} /></Suspense>
                    </div>
                    {products.length > 0 ? (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                                {products.map(product => (
                                    <ProductCard
                                        key={product.id}
                                        product={{ ...product, subcategories: product.subcategories, brands: product.brands }}
                                        basePath={BASE_PATH}
                                        patternSlug={product.subcategories?.slug ?? "san-pham"}
                                    />
                                ))}
                            </div>
                            <div className="mt-12">
                                <Suspense><ProductPagination totalPages={totalPages} currentPage={currentPage} /></Suspense>
                            </div>
                        </>
                    ) : (
                        <div className="py-24 text-center bg-neutral-50 rounded-lg border border-neutral-200 border-dashed">
                            <p className="text-lg font-medium text-neutral-900 mb-1">Không tìm thấy sản phẩm nào</p>
                            <p className="text-sm text-neutral-500 mb-6">Vui lòng thử xóa bớt bộ lọc.</p>
                            <Link href={`${BASE_PATH}/${sub}`} className="inline-flex h-9 items-center justify-center rounded-md bg-white border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors">
                                Xóa tất cả bộ lọc
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
