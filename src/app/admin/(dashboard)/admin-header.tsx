"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChevronRight, Home } from "lucide-react"

// Map of URL segments to Vietnamese labels
const segmentLabels: Record<string, string> = {
    admin: "Quản trị",
    "gach-op-lat": "Gạch ốp lát",
    "thiet-bi-ve-sinh": "TB vệ sinh",
    "thiet-bi-nha-bep": "TB nhà bếp",
    "thiet-bi-nghanh-nuoc": "TB ngành nước",
    "san-go-san-nhua": "Sàn gỗ/nhựa",
    banners: "Banner",
    "bai-viet": "Bài viết",
    "du-an": "Dự án",
    "doi-tac": "Đối tác",
    "bao-gia": "Báo giá",
    type: "Loại sản phẩm",
    create: "Tạo mới",
    edit: "Chỉnh sửa",
}

function getLabel(segment: string): string {
    return segmentLabels[segment] || segment.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
}

export default function AdminHeader() {
    const pathname = usePathname()
    const segments = pathname.split("/").filter(Boolean)

    // Build breadcrumb items
    const breadcrumbs = segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/")
        const label = getLabel(segment)
        const isLast = index === segments.length - 1
        return { href, label, isLast }
    })

    // Get current page title (last breadcrumb)
    const pageTitle = breadcrumbs.length > 0
        ? breadcrumbs[breadcrumbs.length - 1].label
        : "Dashboard"

    return (
        <header className="sticky top-0 z-[5] flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-sm px-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-sm">
                <Link
                    href="/admin"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Home className="h-3.5 w-3.5" />
                </Link>
                {breadcrumbs.slice(1).map((crumb) => (
                    <div key={crumb.href} className="flex items-center gap-1.5">
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                        {crumb.isLast ? (
                            <span className="font-medium text-foreground">
                                {crumb.label}
                            </span>
                        ) : (
                            <Link
                                href={crumb.href}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Current time (subtle) */}
            <div className="text-xs text-muted-foreground tabular-nums">
                {new Date().toLocaleDateString("vi-VN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                })}
            </div>
        </header>
    )
}
