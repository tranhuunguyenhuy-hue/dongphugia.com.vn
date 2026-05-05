import { updateCategoryBanner } from "@/lib/actions"
import prisma from "@/lib/prisma"
import { CategoryBannerManager } from "./category-banner-manager"

export const metadata = { title: "Quản lý Banners | Admin" }

export default async function BannersAdminPage() {
    // Use $queryRaw to bypass Prisma client cache for banner_url field
    const categories = await prisma.$queryRaw<{
        id: number
        name: string
        slug: string
        thumbnail_url: string | null
        banner_url: string | null
    }[]>`
        SELECT id, name, slug, thumbnail_url, banner_url
        FROM categories
        WHERE is_active = true
        ORDER BY sort_order ASC
    `

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-[#192125]">Quản lý Banners</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Cập nhật banner quảng cáo 16:9 cho từng danh mục chính
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {categories.map((cat) => (
                    <CategoryBannerManager key={cat.id} category={cat} />
                ))}
            </div>
        </div>
    )
}
