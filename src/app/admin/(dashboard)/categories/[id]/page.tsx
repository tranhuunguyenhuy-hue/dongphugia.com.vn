import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CategoryForm } from '../category-form'

export const dynamic = 'force-dynamic'

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditCategoryPage({ params }: PageProps) {
    const { id } = await params

    if (id === 'new') {
        return (
            <div className="space-y-6">
                <CategoryForm pageTitle="Thêm danh mục mới" />
            </div>
        )
    }

    const categoryId = parseInt(id)
    if (isNaN(categoryId)) notFound()

    const category = await prisma.categories.findUnique({
        where: { id: categoryId },
        include: {
            filter_definitions: true
        }
    })

    if (!category) notFound()

    // Banners count/preview - fetch from marketing content in the future.
    // For now, we simulate fetching banners.
    const activeBanners = []

    return (
        <div className="space-y-6">
            <CategoryForm
                pageTitle="Chỉnh sửa danh mục"
                pageSubtitle={category.name}
                category={category}
                activeBanners={activeBanners}
            />
        </div>
    )
}
