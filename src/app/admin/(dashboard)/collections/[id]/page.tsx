import prisma from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { CollectionForm } from "../collection-form"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditCollectionPage({ params }: PageProps) {
    const { id } = await params
    const collectionId = parseInt(id)

    const [collection, patternTypes] = await Promise.all([
        prisma.collections.findUnique({ where: { id: collectionId } }),
        prisma.pattern_types.findMany({ where: { is_active: true }, orderBy: { sort_order: 'asc' } }),
    ])

    if (!collection) notFound()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/admin/collections" className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa bộ sưu tập</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{collection.name}</p>
                </div>
            </div>
            <CollectionForm collection={collection} patternTypes={patternTypes} />
        </div>
    )
}
