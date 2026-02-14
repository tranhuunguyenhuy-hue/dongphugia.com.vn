
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import prisma from "@/lib/prisma"
import { formatPrice } from "@/lib/utils"
// Import Refactored Components
import { CategoryMegaMenu } from "@/components/home/category-mega-menu"
import { ValuesSection } from "@/components/home/values-section"
import { ProductSection } from "@/components/home/product-section"
import { ChevronRight } from "lucide-react"

export const dynamic = 'force-dynamic'

async function getBanners() {
    return await prisma.banner.findMany({
        where: { isPublished: true },
        orderBy: { order: 'asc' }
    })
}

async function getFeaturedCategories() {
    return await prisma.category.findMany({
        where: { isFeatured: true, parentId: null },
        include: {
            children: true,
            productTypes: {
                take: 12, // Enough for the grid
                select: { id: true, name: true, slug: true, image: true }
            }
        },
        take: 5
    })
}

// Fetch products for specific homepage sections
async function getProductsByCategory(categorySlug: string) {
    return await prisma.product.findMany({
        where: {
            category: { slug: categorySlug },
            isPublished: true
        },
        take: 10,
        orderBy: { createdAt: 'desc' }
    })
}

// Fetch general featured products if specific categories are empty
async function getFeaturedProducts() {
    return await prisma.product.findMany({
        where: { isFeatured: true, isPublished: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
    })
}

export default async function HomePage() {
    const [
        banners,
        categories,
        featuredProducts,
        tileProducts,
        sanitaryProducts,
        kitchenProducts
    ] = await Promise.all([
        getBanners(),
        getFeaturedCategories(),
        getFeaturedProducts(),
        getProductsByCategory('gach-op-lat'),
        getProductsByCategory('thiet-bi-ve-sinh'),
        getProductsByCategory('thiet-bi-bep'),
    ])

    return (
        <div className="bg-white">

            {/* 1. Hero Section (Sidebar + Banner) - Node 89:1475 */}
            <section className="bg-gradient-to-b from-[#dcfce7] to-white pt-8 pb-16">
                <div className="container mx-auto px-4 flex gap-6 items-start">

                    {/* Sidebar - Category Mega Menu */}
                    <div className="hidden lg:block relative z-20">
                        <CategoryMegaMenu categories={categories} />
                    </div>

                    {/* Hero Banner - Node 89:1476 */}
                    <div className="flex-1 aspect-[2/1] relative rounded-3xl overflow-hidden shadow-sm border border-gray-200 z-10">
                        {banners.length > 0 ? (
                            <Image
                                src={banners[0].image}
                                alt={banners[0].title}
                                fill
                                className="object-cover"
                                priority
                            />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">
                                BANNER PLACEHOLDER
                            </div>
                        )}

                        {/* Pagination Dots (Visual Only) */}
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            <div className="h-1.5 w-12 bg-[#22c55e] rounded-full opacity-30"></div>
                            <div className="h-1.5 w-12 bg-[#22c55e] rounded-full"></div> {/* Active */}
                            <div className="h-1.5 w-12 bg-[#22c55e] rounded-full opacity-30"></div>
                        </div>
                    </div>

                </div>
            </section>

            {/* 2. Stats Section - Node 122:2710 */}
            <section className="container mx-auto px-4 py-8 border-b">
                <div className="flex flex-wrap justify-between items-center gap-8 text-center divide-x divide-gray-200">
                    {/* Partner Stat */}
                    <div className="flex-1 px-4">
                        <p className="text-[#15803d] font-bold text-4xl mb-2">70+</p>
                        <p className="text-gray-600 font-medium">Đối tác và thương hiệu nổi tiếng, uy tín nhất thị trường.</p>
                    </div>
                    {/* Exclusive Project Stat */}
                    <div className="flex-1 px-4 border-l border-gray-200"> {/* Added manual border class as divide-x might fail on wrap */}
                        <p className="text-[#15803d] font-bold text-4xl mb-2">10+</p>
                        <p className="text-gray-600 font-medium">Dự án hợp tác phân phối độc quyền</p>
                    </div>
                    {/* Products Stat */}
                    <div className="flex-1 px-4 border-l border-gray-200">
                        <p className="text-[#15803d] font-bold text-4xl mb-2">1,5 K+</p>
                        <p className="text-gray-600 font-medium">Cập nhật đầy đủ mẫu mã sản phẩm có mặt tại thị trường.</p>
                    </div>
                    {/* Satisfaction Stat */}
                    <div className="flex-1 px-4 border-l border-gray-200">
                        <p className="text-[#15803d] font-bold text-4xl mb-2">88%</p>
                        <p className="text-gray-600 font-medium">Khách hàng hài lòng và quay trở lại với Đông Phú Gia</p>
                    </div>
                </div>
            </section>

            <div className="flex flex-col gap-20 py-20">

                {/* 3. Values Section - Node 134:2763 */}
                <div className="container mx-auto px-4">
                    <ValuesSection />
                </div>

                {/* 4. Featured Category Bento Grid - Node 158:798 */}
                <section className="container mx-auto px-4">
                    <h2 className="text-center text-[32px] text-[#14532d] font-semibold mb-10">
                        Danh mục sản phẩm tại <span className="font-bold text-gray-900">Đông Phú Gia</span>
                    </h2>

                    <div className="flex flex-col lg:flex-row gap-5 h-auto lg:h-[507px]">
                        {/* Large Item (Left) */}
                        <Link href="/danh-muc/gach-op-lat" className="flex-1 bg-gray-50 border border-gray-200 rounded-[24px] p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-shadow">
                            <div className="relative z-10">
                                <h3 className="text-3xl font-semibold text-gray-900 mb-2">Gạch ốp lát</h3>
                                <div className="flex items-center gap-1 text-primary cursor-pointer hover:underline">
                                    Xem tất cả <ChevronRight className="h-4 w-4" />
                                </div>
                            </div>
                            {/* Placeholder for large image */}
                            <div className="absolute right-0 bottom-0 w-3/4 h-3/4 bg-gray-200 rounded-tl-3xl opacity-50 group-hover:scale-105 transition-transform" />
                        </Link>

                        {/* Grid Items (Right) - 2x2 */}
                        <div className="flex-[2] grid grid-cols-1 md:grid-cols-2 gap-5">
                            {['Thiết bị vệ sinh', 'Vật liệu nước', 'Thiết bị bếp', 'Sàn gỗ'].map((name, idx) => (
                                <Link key={idx} href="#" className="bg-gray-50 border border-gray-200 rounded-[24px] p-6 flex flex-col h-[240px] relative overflow-hidden group hover:shadow-lg transition-shadow">
                                    <div className="relative z-10">
                                        <h3 className="text-2xl font-semibold text-gray-900 mb-2">{name}</h3>
                                        <div className="flex items-center gap-1 text-primary cursor-pointer hover:underline">
                                            Xem tất cả <ChevronRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-gray-200 rounded-tl-3xl opacity-50 group-hover:scale-105 transition-transform" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. Product Sections by Category */}
                <div className="container mx-auto px-4 space-y-20">
                    {/* Gach Op Lat Section */}
                    <ProductSection
                        title="Gạch ốp lát"
                        products={tileProducts.length > 0 ? tileProducts : featuredProducts}
                        categorySlug="gach-op-lat"
                    />

                    {/* Thiet Bi Ve Sinh Section */}
                    <ProductSection
                        title="Thiết bị vệ sinh"
                        products={sanitaryProducts.length > 0 ? sanitaryProducts : featuredProducts}
                        categorySlug="thiet-bi-ve-sinh"
                    />

                    {/* Thiet Bi Bep Section */}
                    <ProductSection
                        title="Thiết bị bếp"
                        products={kitchenProducts.length > 0 ? kitchenProducts : featuredProducts}
                        categorySlug="thiet-bi-bep"
                    />
                </div>

            </div>
        </div>
    );
}
