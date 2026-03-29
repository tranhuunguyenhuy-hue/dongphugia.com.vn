import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import prisma from '@/lib/prisma'
import { SangoProductDeleteButton } from './sango-product-delete-button'

export default async function SangoProductsPage({
    searchParams,
}: {
    searchParams: Promise<{ type?: string }>
}) {
    const { type } = await searchParams

    const where: any = {}
    if (type) {
        where.sango_product_types = { slug: type }
    }

    const [products, productTypes] = await Promise.all([
        prisma.sango_products.findMany({
            where,
            include: {
                sango_product_types: true,
            },
            orderBy: [
                { product_type_id: 'asc' },
                { sort_order: 'asc' },
                { created_at: 'desc' },
            ],
            take: 200,
        }),
        prisma.sango_product_types.findMany({
            orderBy: { sort_order: 'asc' },
        }),
    ])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Sàn gỗ</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{products.length} sản phẩm</p>
                </div>
                <Button asChild>
                    <Link href="/admin/sango/products/new">
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm sản phẩm
                    </Link>
                </Button>
            </div>

            {/* Filter by product type */}
            <div className="flex gap-2 flex-wrap">
                <Link
                    href="/admin/sango/products"
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!type
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-[#3C4E56] border-[#E4EEF2] hover:border-primary/50'
                        }`}
                >
                    Tất cả
                </Link>
                {productTypes.map((pt) => (
                    <Link
                        key={pt.id}
                        href={`/admin/sango/products?type=${pt.slug}`}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${type === pt.slug
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-[#3C4E56] border-[#E4EEF2] hover:border-primary/50'
                            }`}
                    >
                        {pt.name}
                    </Link>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-[#E4EEF2] overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-[#E4EEF2] bg-[#F5F9FB]">
                            <th className="px-4 py-3 text-left font-semibold text-[#3C4E56]">SKU</th>
                            <th className="px-4 py-3 text-left font-semibold text-[#3C4E56]">Tên sản phẩm</th>
                            <th className="px-4 py-3 text-left font-semibold text-[#3C4E56] hidden md:table-cell">Loại</th>
                            <th className="px-4 py-3 text-left font-semibold text-[#3C4E56] hidden lg:table-cell">Độ dày</th>
                            <th className="px-4 py-3 text-left font-semibold text-[#3C4E56]">Trạng thái</th>
                            <th className="px-4 py-3 text-right font-semibold text-[#3C4E56]">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((p) => (
                            <tr key={p.id} className="border-b border-[#E4EEF2] last:border-0 table-row-hover">
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                                <td className="px-4 py-3 font-medium text-[#192125]">{p.name}</td>
                                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                    {p.sango_product_types?.name}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                                    {p.thickness_mm ? `${p.thickness_mm}mm` : '—'}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {p.is_active ? 'Hiển thị' : 'Ẩn'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/admin/sango/products/${p.id}`}>
                                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                                Sửa
                                            </Link>
                                        </Button>
                                        <SangoProductDeleteButton id={p.id} name={p.name} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {products.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                                    Chưa có sản phẩm nào
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
