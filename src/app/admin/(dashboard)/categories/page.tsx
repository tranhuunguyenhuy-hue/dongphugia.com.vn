import { Suspense } from 'react'
import Link from 'next/link'
import { Plus, Search } from 'lucide-react'
import prisma from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/admin/page-header'
import { CategoriesTableClient } from './categories-table-client'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Danh mục | Quản trị Đông Phú Gia',
    description: 'Quản lý danh mục sản phẩm',
}

export default async function CategoriesPage(props: {
    searchParams: Promise<{ search?: string }>
}) {
    const searchParams = await props.searchParams
    const search = searchParams.search || ''

    const categories = await prisma.categories.findMany({
        where: search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { slug: { contains: search, mode: 'insensitive' } },
                ],
            }
            : undefined,
        orderBy: {
            sort_order: 'asc',
        },
        include: {
            _count: {
                select: {
                    subcategories: true,
                    products: true,
                }
            }
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <PageHeader
                    title="Danh mục sản phẩm"
                    description="Quản lý cấu trúc danh mục, bộ lọc và SEO."
                />
                <Button asChild className="bg-[#192125] hover:bg-[#192125]/90">
                    <Link href="/admin/categories/new">
                        <Plus className="mr-2 h-4 w-4" />
                        Thêm danh mục mới
                    </Link>
                </Button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative w-full sm:w-[320px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Tìm danh mục..."
                        className="pl-9 h-10 w-full"
                        defaultValue={search}
                    />
                </div>
            </div>

            <Suspense fallback={<div className="h-96 flex items-center justify-center">Đang tải...</div>}>
                <CategoriesTableClient categories={categories} />
            </Suspense>
        </div>
    )
}
