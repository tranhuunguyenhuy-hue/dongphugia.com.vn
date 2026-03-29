import prisma from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { PatternTypeForm } from "../pattern-type-form"

export default async function NewPatternTypePage() {
    const categories = await prisma.product_categories.findMany({
        orderBy: { sort_order: 'asc' },
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/admin/pattern-types" className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:bg-muted transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Thêm kiểu vân</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Tạo kiểu vân mới</p>
                </div>
            </div>
            <PatternTypeForm categories={categories} />
        </div>
    )
}
