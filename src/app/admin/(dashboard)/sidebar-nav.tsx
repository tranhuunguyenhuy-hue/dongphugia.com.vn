"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    BrickWall,
    ShowerHead,
    CookingPot,
    Droplets,
    TreePine,
    FileText,
    LogOut,
    Package2,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "@/components/ui/tooltip"

interface NavCounts {
    tiles: number
    sanitary: number
    kitchen: number
    water: number
    flooring: number
    quotes: number
}

interface SidebarNavProps {
    counts: NavCounts
    userEmail: string
}

const productCategories = [
    { label: "Gạch ốp lát", href: "/admin/gach-op-lat", icon: BrickWall, countKey: "tiles" as const, enabled: true },
    { label: "TB vệ sinh", href: "/admin/thiet-bi-ve-sinh", icon: ShowerHead, countKey: "sanitary" as const, enabled: false },
    { label: "TB nhà bếp", href: "/admin/thiet-bi-nha-bep", icon: CookingPot, countKey: "kitchen" as const, enabled: false },
    { label: "TB ngành nước", href: "/admin/thiet-bi-nghanh-nuoc", icon: Droplets, countKey: "water" as const, enabled: false },
    { label: "Sàn gỗ/nhựa", href: "/admin/san-go-san-nhua", icon: TreePine, countKey: "flooring" as const, enabled: false },
]

export default function SidebarNav({ counts, userEmail }: SidebarNavProps) {
    const pathname = usePathname()

    return (
        <TooltipProvider delayDuration={0}>
            <aside className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r bg-background sm:flex">
                {/* Logo */}
                <div className="flex h-14 items-center border-b px-4">
                    <Link href="/admin" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Package2 className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-sm">Đông Phú Gia</span>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                    {/* Tổng quan */}
                    <div>
                        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Tổng quan
                        </p>
                        <Link
                            href="/admin"
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                pathname === "/admin"
                                    ? "bg-accent text-accent-foreground font-medium"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                        </Link>
                    </div>

                    <Separator />

                    {/* Sản phẩm */}
                    <div>
                        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Sản phẩm
                        </p>
                        <div className="space-y-1">
                            {productCategories.map((item) => {
                                const isActive = pathname.startsWith(item.href)
                                const Icon = item.icon
                                const count = counts[item.countKey]

                                if (!item.enabled) {
                                    return (
                                        <Tooltip key={item.href}>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-muted-foreground/40 cursor-not-allowed">
                                                    <Icon className="h-4 w-4" />
                                                    <span className="flex-1">{item.label}</span>
                                                    <span className="text-xs">—</span>
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right">
                                                <p>Sắp có</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                }

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                            isActive
                                                ? "bg-accent text-accent-foreground font-medium"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span className="flex-1">{item.label}</span>
                                        {count > 0 && (
                                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                {count}
                                            </Badge>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    <Separator />

                    {/* Quản lý nội dung */}
                    <div>
                        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Quản lý nội dung
                        </p>
                        <div className="space-y-1">
                            <Link
                                href="/admin/banners"
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                    pathname.startsWith("/admin/banners")
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                )}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                                    <circle cx="9" cy="9" r="2" />
                                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                                </svg>
                                Banner
                            </Link>

                            <Link
                                href="/admin/bai-viet"
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                    pathname.startsWith("/admin/bai-viet")
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                )}
                            >
                                <FileText className="h-4 w-4" />
                                Bài viết
                            </Link>

                            <Link
                                href="/admin/du-an"
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                    pathname.startsWith("/admin/du-an")
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                )}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                                </svg>
                                Dự án
                            </Link>
                            <Link
                                href="/admin/doi-tac"
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                    pathname.startsWith("/admin/doi-tac")
                                        ? "bg-accent text-accent-foreground font-medium"
                                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                )}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                >
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                Đối tác
                            </Link>
                        </div>
                    </div>

                    <Separator />
                    <div>
                        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Hệ thống
                        </p>
                        <Link
                            href="/admin/bao-gia"
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                                pathname.startsWith("/admin/bao-gia")
                                    ? "bg-accent text-accent-foreground font-medium"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                        >
                            <FileText className="h-4 w-4" />
                            <span className="flex-1">Báo giá</span>
                            {counts.quotes > 0 && (
                                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                    {counts.quotes}
                                </Badge>
                            )}
                        </Link>
                    </div>
                </nav>

                {/* User section */}
                <div className="border-t p-3">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {userEmail.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{userEmail}</p>
                        </div>
                        <form action="/api/auth/signout" method="POST">
                            <button
                                type="submit"
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                title="Đăng xuất"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    )
}
