'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

const categories = [
    { name: "Gạch ốp lát", href: "/gach-op-lat", activePrefix: "/gach-op-lat" },
    { name: "Thiết bị vệ sinh", href: "/thiet-bi-ve-sinh", activePrefix: "/thiet-bi-ve-sinh" },
    { name: "Thiết bị bếp", href: "/thiet-bi-bep", activePrefix: "/thiet-bi-bep" },
    { name: "Sàn gỗ", href: "/san-go", activePrefix: "/san-go" },
    { name: "Vật liệu nước", href: "/vat-lieu-nuoc", activePrefix: "/vat-lieu-nuoc" },
]

export function CategorySidebar() {
    const pathname = usePathname()

    return (
        <div className="bg-white rounded-[24px] overflow-hidden border border-[#22c55e] shadow-[0px_6px_15px_0px_rgba(16,24,40,0.08)] w-full">
            {/* Header */}
            <div className="bg-[#bbf7d0] px-5 py-4">
                <h3 className="font-semibold text-[16px] leading-[24px] text-[#14532d]">
                    Danh mục sản phẩm
                </h3>
            </div>

            {/* List items */}
            <div className="flex flex-col">
                {categories.map((cat, index) => {
                    const isActive = pathname.startsWith(cat.activePrefix)

                    return (
                        <Link
                            key={cat.href}
                            href={cat.href}
                            className={`flex items-center justify-between h-[60px] px-5 border-b border-[#f3f4f6] last:border-0 transition-colors ${isActive
                                    ? "bg-[#f0fdf4]"
                                    : "bg-white hover:bg-[#f9fafb]"
                                }`}
                        >
                            <span className={`font-semibold text-[14px] leading-[20px] ${isActive ? "text-[#15803d]" : "text-[#4b5563]"
                                }`}>
                                {cat.name}
                            </span>
                            <ChevronRight className={`h-4 w-4 shrink-0 ${isActive ? "text-[#15803d]" : "text-[#9ca3af]"
                                }`} />
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
