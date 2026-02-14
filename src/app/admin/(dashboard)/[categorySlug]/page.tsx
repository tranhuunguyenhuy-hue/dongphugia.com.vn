
import { notFound, redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { CategoryClient } from "./category-client"

interface PageProps {
    params: Promise<{ categorySlug: string }>
}

export default async function GenericCategoryPage({ params }: PageProps) {
    const { categorySlug } = await params

    // 1. Validate Category
    const validCategories = [
        'thiet-bi-ve-sinh',
        'thiet-bi-nha-bep',
        'thiet-bi-nghanh-nuoc',
        'san-go-san-nhua'
    ]

    if (!validCategories.includes(categorySlug)) {
        notFound()
    }

    // 2. Fetch Data
    const category = await prisma.category.findUnique({
        where: { slug: categorySlug },
        include: {
            brands: {
                orderBy: { name: 'asc' }
            },
            productTypes: {
                include: {
                    productGroups: true
                },
                orderBy: { name: 'asc' }
            },
            products: {
                include: {
                    brand: true,
                    productType: true,
                    productGroup: true
                },
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!category) {
        return <div>Category not found in database. Please run seed.</div>
    }

    // Serialize Decimal/Date objects for Client Component compatibility
    const serializedCategory = JSON.parse(JSON.stringify(category, (key, value) => {
        // Convert Decimal to number
        if (value !== null && typeof value === 'object' && value.constructor?.name === 'Decimal') {
            return Number(value)
        }
        return value
    }))

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <CategoryClient category={serializedCategory} />
        </div>
    )
}
