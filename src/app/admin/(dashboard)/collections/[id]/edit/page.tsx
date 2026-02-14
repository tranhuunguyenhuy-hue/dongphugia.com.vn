import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import CollectionForm from "../../collection-form"

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const [collection, productTypes] = await Promise.all([
        prisma.collection.findUnique({ where: { id } }),
        prisma.productType.findMany(),
    ])

    if (!collection) notFound()

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Sửa bộ sưu tập</h1>
            <CollectionForm productTypes={productTypes} initialData={collection} />
        </div>
    )
}
