import prisma from "@/lib/prisma"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProductsAccordion } from "./products-accordion"

interface PageProps {
    searchParams: Promise<{ pattern?: string }>
}

export default async function ProductsPage({ searchParams }: PageProps) {
    const sp = await searchParams
    const patternFilter = sp.pattern ? parseInt(sp.pattern) : undefined

    const [collections, unassignedProducts, patternTypes] = await Promise.all([
        prisma.collections.findMany({
            where: patternFilter ? { pattern_type_id: patternFilter } : undefined,
            include: {
                products: {
                    include: {
                        sizes: { select: { label: true } },
                        surfaces: { select: { name: true } },
                    },
                    orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
                },
                _count: { select: { products: true } },
            },
            orderBy: [{ pattern_type_id: 'asc' }, { sort_order: 'asc' }],
        }),
        prisma.products.findMany({
            where: {
                collection_id: null,
                ...(patternFilter ? { pattern_type_id: patternFilter } : {}),
            },
            include: {
                sizes: { select: { label: true } },
                surfaces: { select: { name: true } },
            },
            orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        }),
        prisma.pattern_types.findMany({
            where: { is_active: true },
            orderBy: { sort_order: 'asc' },
        }),
    ])

    const totalProducts =
        collections.reduce((sum, c) => sum + c.products.length, 0) + unassignedProducts.length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Gạch ốp lát</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {totalProducts} sản phẩm · {collections.length} bộ sưu tập
                    </p>
                </div>
                <Button asChild className="press-effect">
                    <Link href="/admin/products/new">
                        <Plus className="mr-1.5 h-4 w-4" /> Thêm SP mới
                    </Link>
                </Button>
            </div>

            {/* Tabs: filter by pattern type */}
            <div className="flex gap-2 flex-wrap">
                <Link
                    href="/admin/products"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!patternFilter
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-muted-foreground border-[#e2e8f0] hover:bg-muted'
                        }`}
                >
                    Tất cả
                </Link>
                {patternTypes.map((pt) => (
                    <Link
                        key={pt.id}
                        href={`/admin/products?pattern=${pt.id}`}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${patternFilter === pt.id
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-muted-foreground border-[#e2e8f0] hover:bg-muted'
                            }`}
                    >
                        {pt.name}
                    </Link>
                ))}
            </div>

            {/* Accordion view (client component) */}
            <ProductsAccordion
                collections={collections as any}
                unassignedProducts={unassignedProducts as any}
                patternTypes={patternTypes}
                patternFilter={patternFilter}
            />
        </div>
    )
}
