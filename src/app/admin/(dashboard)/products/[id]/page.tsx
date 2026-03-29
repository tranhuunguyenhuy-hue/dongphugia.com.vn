import prisma from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { ProductForm } from "../product-form"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditProductPage({ params }: PageProps) {
    const { id } = await params
    const productId = parseInt(id)

    const [product, patternTypes, allCollections, surfaces, sizes, origins, colors, locations] = await Promise.all([
        prisma.products.findUnique({
            where: { id: productId },
            include: {
                product_colors: true,
                product_locations: true,
                product_images: { orderBy: { sort_order: 'asc' } },
            },
        }),
        prisma.pattern_types.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
        prisma.collections.findMany({ where: { is_active: true }, orderBy: { name: 'asc' } }),
        prisma.surfaces.findMany({ orderBy: { name: 'asc' } }),
        prisma.sizes.findMany({ orderBy: { sort_order: 'asc' } }),
        prisma.origins.findMany({ orderBy: { name: 'asc' } }),
        prisma.colors.findMany({ orderBy: { name: 'asc' } }),
        prisma.locations.findMany({ orderBy: { name: 'asc' } }),
    ])

    if (!product) notFound()

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <Link href="/admin/products" className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa sản phẩm</h1>
                    <p className="text-sm text-muted-foreground mt-0.5 font-mono">{product.sku}</p>
                </div>
            </div>

            <ProductForm
                product={product}
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
