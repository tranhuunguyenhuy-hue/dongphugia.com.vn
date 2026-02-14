"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

interface Category {
    id: string
    name: string
    slug: string
    children: any[] // We interpret 'children' if needed, but for now we just link top level
}

interface SidebarMenuProps {
    categories: Category[]
    activeSlug?: string
}

export function SidebarMenu({ categories, activeSlug }: SidebarMenuProps) {
    const pathname = usePathname()

    return (
        <div className="flex flex-col">
            {categories.map((cat, index) => {
                // Active if slug matches prop OR if pathname includes slug
                const isActive = activeSlug === cat.slug || pathname.includes(`/danh-muc/${cat.slug}`)
                const isLast = index === categories.length - 1

                return (
                    <Link
                        key={cat.id}
                        href={`/danh-muc/${cat.slug}`}
                        className={`
                            flex items-center justify-between px-5 py-4 h-[60px]
                            transition-colors text-sm font-semibold border-b border-gray-100 last:border-0
                            ${isActive
                                ? 'bg-green-50 text-[#15803d]'
                                : 'text-[#4b5563] hover:bg-gray-50'
                            }
                        `}
                    >
                        <span>{cat.name}</span>
                        <ChevronRight className={`h-5 w-5 ${isActive ? 'text-[#15803d]' : 'opacity-40'}`} />
                    </Link>
                )
            })}
        </div>
    )
}
