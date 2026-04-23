import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Suspense } from "react"
import prisma from "@/lib/prisma"
import { ChevronRight, Home, Star } from "lucide-react"
import { ProductCard } from "@/components/ui/product-card"
import { CategoryFilterPanel } from "@/components/category/category-filter-panel"
import { SubcategoryIconGrid } from "@/components/category/subcategory-icon-grid"

export const revalidate = 3600

export const metadata: Metadata = {
    title: "Vật Liệu Nước | Đông Phú Gia",
    description: "Máy nước nóng, máy lọc nước, bồn chứa, máy bơm từ các thương hiệu uy tín tại Đà Lạt.",
    keywords: ["vật liệu nước", "máy nước nóng", "máy lọc nước", "Đà Lạt"],
}

const CATEGORY_SLUG = "vat-lieu-nuoc"
const CATEGORY_NAME = "Vật Liệu Nước"
const BASE_PATH = "/vat-lieu-nuoc"
const EMOJI_FALLBACK = "💧"

interface PageProps {
    searchParams: Promise<{ brands?: string; price?: string }>
}

export default async function VatLieuNuocPage({ searchParams }: PageProps) {
    const params = await searchParams
    const activeBrands = params.brands?.split(",").filter(Boolean) ?? []
    const [priceMin, priceMax] = params.price?.split("-").map(Number) ?? []

    const featuredWhere: any = {
        categories: { slug: CATEGORY_SLUG },
        is_featured: true,
        is_active: true,
    }
    if (activeBrands.length > 0) featuredWhere.brands = { name: { in: activeBrands } }
    if (priceMin !== undefined && priceMax !== undefined)
        featuredWhere.price = { gte: priceMin, lte: priceMax }

    const [bannerResult, subcategories, featuredProducts, brands] = await Promise.all([
        prisma.$queryRaw<{ banner_url: string | null }[]>`SELECT banner_url FROM categories WHERE slug = ${CATEGORY_SLUG} LIMIT 1`,
        prisma.subcategories.findMany({
            where: { categories: { slug: CATEGORY_SLUG }, is_active: true },
            orderBy: { sort_order: "asc" },
            include: { _count: { select: { products: { where: { is_active: true } } } } },
        }),
        prisma.products.findMany({
            where: featuredWhere,
            orderBy: { sort_order: "asc" },
            take: 8,
            include: {
                brands: { select: { name: true } },
                subcategories: { select: { name: true, slug: true } },
            },
        }),
        prisma.brands.findMany({
            where: { is_active: true, products: { some: { categories: { slug: CATEGORY_SLUG }, is_active: true } } },
            select: { id: true, name: true },
            orderBy: { sort_order: "asc" },
            take: 20,
        }),
    ])

    const bannerUrl = bannerResult[0]?.banner_url ?? null

    return (
        <main className="max-w-[1380px] mx-auto px-5 lg:px-8">
            <nav className="flex items-center gap-1.5 text-[12px] text-neutral-400 mt-5 mb-0" aria-label="Breadcrumb">
                <Home className="h-3 w-3 flex-shrink-0" />
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <Link href="/" className="hover:text-neutral-700 transition-colors">Trang chủ</Link>
                <ChevronRight className="h-3 w-3 text-neutral-300" />
                <span className="text-neutral-600 font-medium">{CATEGORY_NAME}</span>
            </nav>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start py-8 lg:py-10">
                <aside className="w-full lg:w-[290px] flex-shrink-0 lg:sticky lg:top-24 scroll-sidebar flex flex-col gap-4">
                    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-neutral-100 border border-dashed border-neutral-200">
                        {bannerUrl ? (
                            <Image src={bannerUrl} alt={`Banner ${CATEGORY_NAME}`} fill className="object-cover" priority />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                                <svg className="h-8 w-8 text-neutral-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.2} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                                </svg>
                                <p className="text-[11px] text-neutral-400 tracking-wide">Banner quảng cáo</p>
                            </div>
                        )}
                    </div>
                    <h1 className="sr-only">{CATEGORY_NAME}</h1>

                    <Suspense>
                        <CategoryFilterPanel brands={brands} />
                    </Suspense>
                </aside>

                <div className="flex-1 min-w-0 space-y-10">
                    <SubcategoryIconGrid
                        subcategories={subcategories}
                        basePath={BASE_PATH}
                        emojiDefault={EMOJI_FALLBACK}
                    />

                    <div className="border-t border-neutral-100" />

                    <section>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                                <h2 className="text-[15px] font-semibold text-neutral-900">Sản phẩm nổi bật</h2>
                                {(activeBrands.length > 0 || !!params.price) && (
                                    <span className="text-[11px] text-[#2E7A96] bg-[#2E7A96]/10 px-2 py-0.5 rounded-full">Đang lọc</span>
                                )}
                            </div>
                            <span className="text-[12px] text-neutral-400">{featuredProducts.length} sản phẩm</span>
                        </div>
                        {featuredProducts.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
                                {featuredProducts.map((product) => (
                                    <ProductCard key={product.id} product={product} basePath={BASE_PATH} patternSlug={product.subcategories?.slug} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                                    <Star className="h-6 w-6 text-neutral-300" />
                                </div>
                                <p className="text-[14px] font-medium text-neutral-600">Không có sản phẩm phù hợp</p>
                                <p className="text-[12px] text-neutral-400 mt-1">Thử thay đổi bộ lọc để xem thêm</p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    )
}
