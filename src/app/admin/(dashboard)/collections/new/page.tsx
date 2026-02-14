import CollectionForm from "../collection-form"
import prisma from "@/lib/prisma"

export default async function NewCollectionPage() {
    const productTypes = await prisma.productType.findMany()

    return (
        <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Thêm bộ sưu tập</h1>
            <CollectionForm productTypes={productTypes} />
        </div>
    )
}
