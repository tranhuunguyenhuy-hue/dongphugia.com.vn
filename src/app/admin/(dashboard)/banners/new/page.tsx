import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { BannerForm } from "../banner-form"

export default function NewBannerPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link
                    href="/admin/banners"
                    className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#e2e8f0] text-muted-foreground hover:bg-muted transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Thêm banner</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Tạo banner mới cho trang chủ</p>
                </div>
            </div>
            <BannerForm />
        </div>
    )
}
