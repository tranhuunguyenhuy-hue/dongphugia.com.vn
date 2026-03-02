import prisma from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { ProductForm } from "../product-form"

export default async function NewProductPage() {
    const [patternTypes, allCollections, surfaces, sizes, origins, colors, locations] = await Promise.all([
        prisma.pattern_types.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
        prisma.collections.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } }),
        prisma.surfaces.findMany({ orderBy: { name: 'asc' } }),
        prisma.sizes.findMany({ orderBy: { sort_order: 'asc' } }),
        prisma.origins.findMany({ orderBy: { name: 'asc' } }),
        prisma.colors.findMany({ orderBy: { name: 'asc' } }),
        prisma.locations.findMany({ orderBy: { name: 'asc' } }),
    ])

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <Link href="/admin/products" className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#e2e8f0] text-muted-foreground hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Thêm sản phẩm mới</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Điền thông tin sản phẩm bên dưới</p>
                </div>
            </div>

            <ProductForm
                patternTypes={patternTypes}
                allCollections={allCollections}
                surfaces={surfaces}
                sizes={sizes}
                origins={origins}
                colors={colors}
                locations={locations}
            />
        </div>
    )
}
