import prisma from "@/lib/prisma"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { BannerForm } from "../banner-form"

interface PageProps {
    params: Promise<{ id: string }>
}

export default async function EditBannerPage({ params }: PageProps) {
    const { id } = await params
    const bannerId = parseInt(id)

    const banner = await prisma.banners.findUnique({ where: { id: bannerId } })
    if (!banner) notFound()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/admin/banners"
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E4EEF2] text-muted-foreground hover:bg-muted transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa banner</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{banner.title || `Banner #${banner.id}`}</p>
                </div>
            </div>
            <BannerForm banner={banner} />
        </div>
    )
}
