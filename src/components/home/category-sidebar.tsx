import Link from "next/link"
import { ChevronRight } from "lucide-react"

const CATEGORIES = [
    { label: "Gạch ốp lát", href: "/gach-op-lat", active: true },
    { label: "Thiết bị vệ sinh", href: "/thiet-bi-ve-sinh", active: false },
    { label: "Thiết bị bếp", href: "/thiet-bi-bep", active: false },
    { label: "Sàn gỗ", href: "/san-go", active: false },
    { label: "Vật liệu nước", href: "/vat-lieu-nuoc", active: false },
]

export function CategorySidebar() {
    return (
        <div className="w-[302px] shrink-0 bg-[#bbf7d0] border border-[#22c55e] rounded-[24px] shadow-[0_6px_15px_rgba(16,24,40,0.08)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-4 pb-3">
                <p className="text-[15px] font-semibold leading-[22px] text-[#14532d] uppercase tracking-wide">
                    Danh mục sản phẩm
                </p>
            </div>

            {/* Items */}
            <div className="bg-white rounded-[16px] flex flex-col overflow-hidden">
                {CATEGORIES.map((cat, index) => {
                    const isFirst = index === 0
                    const isLast = index === CATEGORIES.length - 1
                    const rounding = `${isFirst ? "rounded-t-2xl" : ""} ${isLast ? "rounded-b-2xl" : ""}`

                    if (cat.active) {
                        return (
                            <Link
                                key={cat.href}
                                href={cat.href}
                                className={`group flex items-center justify-between px-5 h-[60px]
                                    text-[14px] font-semibold text-[#374151]
                                    hover:bg-[#f0fdf4] hover:text-[#15803d]
                                    transition-colors duration-200 ${rounding}
                                    ${!isLast ? "border-b border-[#f3f4f6]" : ""}`}
                            >
                                <span>{cat.label}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-[#9ca3af] group-hover:text-[#15803d] transition-all duration-200 group-hover:translate-x-0.5" />
                            </Link>
                        )
                    }

                    return (
                        <div
                            key={cat.href}
                            className={`flex items-center justify-between px-5 h-[60px]
                                text-[14px] font-medium text-[#9ca3af] cursor-not-allowed
                                ${rounding} ${!isLast ? "border-b border-[#f3f4f6]" : ""}`}
                        >
                            <span>{cat.label}</span>
                            <span className="text-[10px] font-semibold text-[#9ca3af] bg-[#f3f4f6] px-2 py-0.5 rounded-full leading-tight">
                                Sắp có
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
