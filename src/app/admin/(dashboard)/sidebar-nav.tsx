"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import {
    LayoutDashboard,
    ClipboardList,
    ChevronLeft,
    ChevronRight,
    Package2,
    ShoppingBag,
    LogOut,
    Image,
    BookOpen,
    FolderKanban,
    Handshake,
} from "lucide-react"
import { logoutAction } from "@/app/admin/login/actions"
import { Badge } from "@/components/ui/badge"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "@/components/ui/tooltip"

interface SidebarNavProps {
    pendingQuotes: number
}

const navLinks = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    { label: "Sản phẩm", href: "/admin/products", icon: Package2, exact: false },
    { label: "Đơn hàng", href: "/admin/orders", icon: ShoppingBag, exact: false },
    { label: "Blog", href: "/admin/blog/posts", icon: BookOpen, exact: false },
    { label: "Dự án", href: "/admin/du-an", icon: FolderKanban, exact: false },
    { label: "Đối tác", href: "/admin/doi-tac", icon: Handshake, exact: false },
    { label: "Banners", href: "/admin/banners", icon: Image, exact: false },
    { label: "Báo giá", href: "/admin/quote-requests", icon: ClipboardList, exact: false, quoteBadge: true },
]

function NavItem({
    href,
    icon: Icon,
    label,
    isActive,
    badge,
    collapsed,
}: {
    href: string
    icon: any
    label: string
    isActive: boolean
    badge?: number
    collapsed: boolean
}) {
    const content = (
        <div
            className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                collapsed && "justify-center px-2",
                isActive
                    ? "bg-primary/10 text-primary active-indicator"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
        >
            <Icon className={cn(
                "shrink-0 transition-colors duration-200",
                collapsed ? "h-5 w-5" : "h-4 w-4",
                isActive && "text-primary",
            )} />
            {!collapsed && (
                <>
                    <span className="flex-1 truncate">{label}</span>
                    {badge !== undefined && badge > 0 && (
                        <Badge
                            variant="destructive"
                            className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold tabular-nums badge-pulse"
                        >
                            {badge}
                        </Badge>
                    )}
                </>
            )}
            {collapsed && badge !== undefined && badge > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white bg-destructive badge-pulse">
                    {badge > 9 ? "9+" : badge}
                </span>
            )}
        </div>
    )

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

export default function SidebarNav({ pendingQuotes }: SidebarNavProps) {
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
                {/* Logo */}
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
                <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                    {navLinks.map((item) => {
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href)
                        return (
                            <NavItem
                                key={item.href}
                                href={item.href}
                                icon={item.icon}
                                label={item.label}
                                isActive={isActive}
                                badge={item.quoteBadge ? pendingQuotes : undefined}
                                collapsed={collapsed}
                            />
                        )
                    })}
                </nav>

                {/* User + Collapse toggle */}
                <div className="border-t">
                    <div className={cn(
                        "flex items-center gap-2.5 p-3",
                        collapsed && "justify-center p-2"
                    )}>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-green-200 text-sm font-semibold text-green-700">
                            A
                        </div>
                        {!collapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate text-foreground">Administrator</p>
                                <p className="text-[10px] text-muted-foreground">Đông Phú Gia</p>
                            </div>
                        )}
                    </div>

                    <div className={cn(
                        "flex border-t p-2 gap-1",
                        collapsed ? "flex-col items-center" : "justify-between px-3"
                    )}>
                        {/* Logout */}
                        <form action={logoutAction}>
                            <button
                                type="submit"
                                className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all duration-200 press-effect"
                                title="Đăng xuất"
                            >
                                <LogOut className="h-3.5 w-3.5 shrink-0" />
                                {!collapsed && <span>Đăng xuất</span>}
                            </button>
                        </form>

                        {/* Collapse toggle */}
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
