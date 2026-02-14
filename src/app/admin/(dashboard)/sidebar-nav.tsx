"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
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
    Image,
    FolderOpen,
    Users,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
} from "lucide-react"
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
    { label: "TB vệ sinh", href: "/admin/thiet-bi-ve-sinh", icon: ShowerHead, countKey: "sanitary" as const, enabled: true },
    { label: "TB nhà bếp", href: "/admin/thiet-bi-nha-bep", icon: CookingPot, countKey: "kitchen" as const, enabled: true },
    { label: "TB ngành nước", href: "/admin/thiet-bi-nghanh-nuoc", icon: Droplets, countKey: "water" as const, enabled: true },
    { label: "Sàn gỗ/nhựa", href: "/admin/san-go-san-nhua", icon: TreePine, countKey: "flooring" as const, enabled: true },
]

const contentLinks = [
    { label: "Banner", href: "/admin/banners", icon: Image },
    { label: "Bài viết", href: "/admin/bai-viet", icon: FileText },
    { label: "Dự án", href: "/admin/du-an", icon: FolderOpen },
    { label: "Đối tác", href: "/admin/doi-tac", icon: Users },
]

function NavItem({
    href,
    icon: Icon,
    label,
    isActive,
    badge,
    badgeVariant = "secondary",
    collapsed,
    disabled = false,
    disabledTooltip = "Sắp có",
}: {
    href: string
    icon: any
    label: string
    isActive: boolean
    badge?: number
    badgeVariant?: "secondary" | "destructive"
    collapsed: boolean
    disabled?: boolean
    disabledTooltip?: string
}) {
    const content = (
        <div
            className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : isActive
                        ? "bg-primary/10 text-primary active-indicator"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
        >
            <Icon className={cn(
                "shrink-0 transition-colors duration-200",
                collapsed ? "h-5 w-5" : "h-4 w-4",
                isActive && !disabled && "text-primary",
            )} />
            {!collapsed && (
                <>
                    <span className="flex-1 truncate">{label}</span>
                    {badge !== undefined && badge > 0 && (
                        <Badge
                            variant={badgeVariant}
                            className={cn(
                                "h-5 min-w-[20px] px-1.5 text-[10px] font-semibold tabular-nums",
                                badgeVariant === "destructive" && "badge-pulse"
                            )}
                        >
                            {badge}
                        </Badge>
                    )}
                </>
            )}
            {collapsed && badge !== undefined && badge > 0 && (
                <span className={cn(
                    "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white",
                    badgeVariant === "destructive" ? "bg-destructive badge-pulse" : "bg-primary"
                )}>
                    {badge > 9 ? "9+" : badge}
                </span>
            )}
        </div>
    )

    if (disabled) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={collapsed ? 12 : 8}>
                    <p>{disabledTooltip}</p>
                </TooltipContent>
            </Tooltip>
        )
    }

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link href={href}>{content}</Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={12}>
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        )
    }

    return <Link href={href}>{content}</Link>
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
    if (collapsed) {
        return <div className="mx-auto my-2 h-px w-6 bg-border" />
    }
    return (
        <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {label}
        </p>
    )
}

export default function SidebarNav({ counts, userEmail }: SidebarNavProps) {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-10 hidden flex-col border-r bg-white sm:flex sidebar-transition",
                    collapsed ? "w-[68px]" : "w-60"
                )}
            >
                {/* Logo + Collapse Toggle */}
                <div className={cn(
                    "flex h-16 items-center border-b px-4",
                    collapsed && "justify-center px-2"
                )}>
                    <Link href="/admin" className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700 text-white shadow-sm">
                            <Package2 className="h-4 w-4" />
                        </div>
                        {!collapsed && (
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">Đông Phú Gia</p>
                                <p className="text-[10px] text-muted-foreground -mt-0.5">Admin Panel</p>
                            </div>
                        )}
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
                    {/* Dashboard */}
                    <div className="space-y-1">
                        <SectionLabel label="Tổng quan" collapsed={collapsed} />
                        <NavItem
                            href="/admin"
                            icon={LayoutDashboard}
                            label="Dashboard"
                            isActive={pathname === "/admin"}
                            collapsed={collapsed}
                        />
                    </div>

                    {/* Product Categories */}
                    <div className="space-y-1">
                        <SectionLabel label="Sản phẩm" collapsed={collapsed} />
                        {productCategories.map((item) => (
                            <NavItem
                                key={item.href}
                                href={item.href}
                                icon={item.icon}
                                label={item.label}
                                isActive={pathname.startsWith(item.href)}
                                badge={counts[item.countKey]}
                                collapsed={collapsed}
                                disabled={!item.enabled}
                            />
                        ))}
                    </div>

                    {/* Content Management */}
                    <div className="space-y-1">
                        <SectionLabel label="Nội dung" collapsed={collapsed} />
                        {contentLinks.map((item) => (
                            <NavItem
                                key={item.href}
                                href={item.href}
                                icon={item.icon}
                                label={item.label}
                                isActive={pathname.startsWith(item.href)}
                                collapsed={collapsed}
                            />
                        ))}
                    </div>

                    {/* System */}
                    <div className="space-y-1">
                        <SectionLabel label="Hệ thống" collapsed={collapsed} />
                        <NavItem
                            href="/admin/bao-gia"
                            icon={ClipboardList}
                            label="Báo giá"
                            isActive={pathname.startsWith("/admin/bao-gia")}
                            badge={counts.quotes}
                            badgeVariant="destructive"
                            collapsed={collapsed}
                        />
                    </div>
                </nav>

                {/* User section + Collapse toggle */}
                <div className="border-t">
                    {/* User */}
                    <div className={cn(
                        "flex items-center gap-2.5 p-3",
                        collapsed && "justify-center p-2"
                    )}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 text-sm font-semibold text-green-700">
                            {userEmail.charAt(0).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate text-foreground">{userEmail}</p>
                                <p className="text-[10px] text-muted-foreground">Administrator</p>
                            </div>
                        )}
                        {!collapsed && (
                            <form action="/api/auth/signout" method="POST">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="submit"
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors press-effect"
                                            title="Đăng xuất"
                                        >
                                            <LogOut className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Đăng xuất</TooltipContent>
                                </Tooltip>
                            </form>
                        )}
                    </div>

                    {/* Collapse Toggle */}
                    <div className={cn(
                        "flex border-t p-2",
                        collapsed ? "justify-center" : "justify-end px-3"
                    )}>
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 press-effect"
                            title={collapsed ? "Mở rộng" : "Thu gọn"}
                        >
                            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </aside>
        </TooltipProvider>
    )
}
