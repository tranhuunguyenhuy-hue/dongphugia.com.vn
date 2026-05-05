import { getAdminProducts, getProductStats } from '@/lib/public-api-products'
import { getCategories, getSubcategories, getBrands } from '@/lib/cache'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

import { Plus } from 'lucide-react'
import { ProductsFilters } from './products-filters'
import { ProductsTableClient } from './products-table-client'

export const dynamic = 'force-dynamic'

interface PageProps {
    searchParams: Promise<{ 
        search?: string; 
        category_id?: string; 
        subcategory_id?: string; 
        brand_id?: string;
        highlight_type?: 'featured' | 'promotion';
        is_active?: string; 
        sort?: 'price_asc' | 'price_desc' | 'default';
        page?: string 
    }>
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
    const params = await searchParams
    const page = Number(params.page || 1)
    const [stats, categories, brands] = await Promise.all([
        getProductStats(),
        getCategories(),
        getBrands(),
    ])

    const is_active = params.is_active === 'true' ? true : params.is_active === 'false' ? false : undefined

    const effectiveCategoryId = params.category_id 
        ? Number(params.category_id) 
        : categories.length > 0 ? categories[0].id : undefined

    const subcategories = effectiveCategoryId ? await getSubcategories(effectiveCategoryId) : []
    const subcategory_id = params.subcategory_id ? Number(params.subcategory_id) : undefined
    const brand_id = params.brand_id ? Number(params.brand_id) : undefined

    const { products, total, totalPages } = await getAdminProducts({ 
        search: params.search, 
        category_id: effectiveCategoryId, 
        subcategory_id,
        brand_id,
        highlight_type: params.highlight_type,
        sort: params.sort,
        is_active, 
        page, 
        pageSize: 50 
    })

    const statusColor: Record<string, string> = {
        in_stock: 'bg-emerald-100 text-emerald-700',
        out_of_stock: 'bg-red-100 text-red-700',
        preorder: 'bg-amber-100 text-amber-700',
    }
    const statusLabel: Record<string, string> = {
        in_stock: 'Còn hàng',
        out_of_stock: 'Hết hàng',
        preorder: 'Đặt trước',
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="space-y-6">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sản phẩm</h1>
                    
                    <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Đang bán</span>
                            <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="text-lg font-medium text-stone-900">
                                    {stats.active.toLocaleString()} <span className="text-stone-400">/ {stats.total.toLocaleString()}</span>
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Nổi bật</span>
                            <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span className="text-lg font-medium text-stone-900">{stats.featured.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">Khuyến mãi</span>
                            <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="text-lg font-medium text-stone-900">{stats.promotion.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <Link href="/admin/products/new">
                    <Button className="w-full sm:w-auto shadow-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Thêm sản phẩm
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            <ProductsFilters 
                categories={categories} 
                defaultCategoryId={effectiveCategoryId} 
                subcategories={subcategories}
                brands={brands} 
            />

            {/* Table */}
            <ProductsTableClient products={products} />

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Hiển thị {products.length} / {total} sản phẩm</span>
                    <div className="flex gap-2">
                        {page > 1 && (
                            <Link href={`/admin/products?page=${page - 1}`}>
                                <Button variant="outline" size="sm">← Trước</Button>
                            </Link>
                        )}
                        <span className="flex items-center px-3 text-sm">Trang {page}/{totalPages}</span>
                        {page < totalPages && (
                            <Link href={`/admin/products?page=${page + 1}`}>
                                <Button variant="outline" size="sm">Tiếp →</Button>
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
