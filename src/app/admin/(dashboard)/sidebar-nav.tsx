"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    ClipboardList,
    Package2,
    ShoppingBag,
    LogOut,
    Image as ImageIcon,
    BookOpen,
    LayoutGrid,
    ChevronRight,
    HeadphonesIcon,
    Settings,
    MessageSquare,
    Megaphone,
    ImagePlay,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { logoutAction } from "@/app/admin/login/actions"

import type { SessionUser } from "@/lib/auth/session"
import { ROLE_LABELS, ROLE_COLORS, can, type Permission } from "@/lib/auth/permissions"

interface SidebarNavProps {
    pendingQuotes: number
    pendingOrders: number
    currentUser: SessionUser
}

type NavItem = {
    title: string
    href?: string
    icon?: React.ElementType
    exact?: boolean
    permission?: Permission
    badge?: number
    children?: {
        label: string
        href: string
        permission?: Permission
        badge?: number
    }[]
}

type NavGroup = {
    label: string
    items: NavItem[]
}

const getNavConfig = (role: SessionUser['role'], pendingQuotes: number): NavGroup[] => {
    return [
        {
            label: "MAIN NAVIGATION",
            items: [
                { title: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
                {
                    title: "Sản phẩm (PIM)",
                    icon: Package2,
                    children: [
                        { label: "Tất cả sản phẩm", href: "/admin/products", permission: "products:read" },
                        { label: "Danh mục", href: "/admin/categories", permission: "categories:read" },
                    ],
                },
                {
                    title: "Kinh doanh (OMS)",
                    icon: ShoppingBag,
                    children: [
                        { label: "Khách hàng", href: "/admin/customers", permission: "customers:read" },
                        { label: "Đơn hàng", href: "/admin/orders" },
                        { label: "Báo giá", href: "/admin/quote-requests", badge: pendingQuotes > 0 ? pendingQuotes : undefined, permission: "quotes:read" },
                    ],
                },
            ]
        },
        {
            label: "NỘI DUNG & CMS",
            items: [
                {
                    title: "Marketing",
                    icon: Megaphone,
                    children: [
                        { label: "Banners", href: "/admin/content/banners", permission: "blog:read" },
                        { label: "Blog Posts", href: "/admin/blog/posts", permission: "blog:read" },
                    ]
                },
                // LEO-422: Admin-only content management items
                {
                    title: "Nội dung trang",
                    icon: ImagePlay,
                    children: [
                        { label: "Banners", href: "/admin/banners", permission: "users:read" },
                        { label: "Đối tác", href: "/admin/doi-tac", permission: "users:read" },
                        { label: "Dự án", href: "/admin/du-an", permission: "users:read" },
                    ]
                }
            ]
        },
        {
            label: "HỆ THỐNG",
            items: [
                { title: "Nhân viên", href: "/admin/users", icon: ClipboardList, permission: "users:read" },
            ]
        },
        {
            label: "HỖ TRỢ",
            items: [
                { title: "Feedback", href: "#feedback", icon: MessageSquare },
                { title: "Liên hệ hỗ trợ", href: "#support", icon: HeadphonesIcon },
                { title: "Cài đặt", href: "/admin/settings", icon: Settings },
            ]
        }
    ]
}

export default function SidebarNav({ pendingQuotes, pendingOrders, currentUser }: SidebarNavProps) {
    const pathname = usePathname()
    
    // Filter nav groups based on permissions
    const visibleNavGroups = getNavConfig(currentUser.role, pendingQuotes)
        .map(group => ({
            ...group,
            items: group.items.map(item => {
                if (item.children) {
                    return {
                        ...item,
                        children: item.children.filter(child => !child.permission || can(currentUser.role, child.permission))
                    }
                }
                return item
            }).filter(item => {
                if (item.children) return item.children.length > 0
                return !item.permission || can(currentUser.role, item.permission)
            })
        }))
        .filter(group => group.items.length > 0)

    return (
        <Sidebar collapsible="icon" className="border-r border-transparent bg-[#f9fafb]">
            <SidebarHeader className="py-4">
                <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center px-3">
                    <Link href="/admin" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                        <div className="bg-primary text-primary-foreground p-1.5 rounded-md shrink-0">
                            <LayoutGrid className="size-4" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight text-primary uppercase">DPG Admin</span>
                    </Link>
                    <SidebarTrigger className="shrink-0 text-muted-foreground hover:bg-neutral-200/50" />
                </div>
            </SidebarHeader>
            <SidebarContent className="px-2 pb-0 gap-0">
                {visibleNavGroups.map((group, index) => (
                    <SidebarGroup key={group.label} className={group.label === "HỖ TRỢ" ? "mt-auto pt-4 pb-1" : "pt-4 pb-2"}>
                        <SidebarGroupLabel className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2 px-2 h-auto">
                            {group.label}
                        </SidebarGroupLabel>
                        <SidebarMenu className="gap-0.5">
                            {group.items.map((item) => {
                                if (group.label === "HỖ TRỢ") {
                                    const isActive = item.exact
                                        ? pathname === item.href
                                        : pathname.startsWith(item.href || "#")
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className={`h-8 rounded-md px-2.5 text-[12.5px] transition-colors ${isActive ? 'bg-white shadow-sm text-neutral-900 font-medium' : 'text-neutral-500 hover:text-neutral-900 hover:bg-white hover:shadow-sm'}`}>
                                                <Link href={item.href || "#"}>
                                                    {item.icon && <item.icon className="size-3.5 opacity-70 shrink-0" />}
                                                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                }
                                
                                if (item.children) {
                                    // It's a collapsible item
                                    const isChildActive = item.children.some(child => pathname === child.href || pathname.startsWith(child.href + "/"))
                                    return (
                                        <Collapsible key={item.title} asChild defaultOpen={isChildActive || true} className="group/collapsible">
                                            <SidebarMenuItem>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuButton isActive={isChildActive} tooltip={item.title} className={`sidebar-item-glass h-[34px] px-2.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center rounded-md font-medium text-[13px] transition-colors ${isChildActive ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-white hover:shadow-sm data-[state=open]:text-neutral-900'}`}>
                                                        {item.icon && <item.icon className="size-4 opacity-70 shrink-0" />}
                                                        <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                                                        <ChevronRight className="ml-auto size-3.5 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                                                    </SidebarMenuButton>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    {/* Kravio-style nested items with L-shape line */}
                                                    <SidebarMenuSub className="mt-1 gap-0.5 border-l border-neutral-200 ml-4 pl-2 mr-0 pr-0">
                                                        {item.children.map((subItem) => {
                                                            const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/")
                                                            return (
                                                                <SidebarMenuSubItem key={subItem.href} className="relative">
                                                                    <SidebarMenuSubButton asChild isActive={isSubActive} className={`h-8 rounded-md px-2.5 text-[12.5px] transition-colors ${isSubActive ? 'bg-white shadow-sm text-neutral-900 font-medium' : 'text-neutral-500 hover:text-neutral-900 hover:bg-white hover:shadow-sm'}`}>
                                                                        <Link href={subItem.href}>
                                                                            <span>{subItem.label}</span>
                                                                        </Link>
                                                                    </SidebarMenuSubButton>
                                                                    {subItem.badge !== undefined && (
                                                                        <div className="absolute right-2 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                                                                            {subItem.badge > 9 ? "9+" : subItem.badge}
                                                                        </div>
                                                                    )}
                                                                </SidebarMenuSubItem>
                                                            )
                                                        })}
                                                    </SidebarMenuSub>
                                                </CollapsibleContent>
                                            </SidebarMenuItem>
                                        </Collapsible>
                                    )
                                } else {
                                    // It's a standard link item
                                    const isActive = item.exact
                                        ? pathname === item.href
                                        : pathname.startsWith(item.href || "#")
                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            <SidebarMenuButton asChild isActive={isActive} tooltip={item.title} className={`sidebar-item-glass h-[34px] px-2.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center rounded-md font-medium text-[13px] transition-colors ${isActive ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-600 hover:text-neutral-900 hover:bg-white hover:shadow-sm'}`}>
                                                <Link href={item.href || "#"}>
                                                    {item.icon && <item.icon className="size-4 opacity-70 shrink-0" />}
                                                    <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                }
                            })}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            
            <SidebarFooter className="p-3 bg-transparent">
                {/* Kravio style bottom user box */}
                <div className="flex items-center justify-between p-2.5 bg-white border border-neutral-200 rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.02)] group-data-[collapsible=icon]:p-1.5 group-data-[collapsible=icon]:justify-center relative">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 font-bold text-xs border border-neutral-200">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                            <span className="truncate text-[13px] font-semibold text-neutral-900 leading-tight">{currentUser.name}</span>
                            <span className="truncate text-[11px] text-neutral-500 mt-0.5">{currentUser.email}</span>
                        </div>
                    </div>
                    <form action={logoutAction} className="group-data-[collapsible=icon]:hidden">
                        <button type="submit" className="text-neutral-400 hover:text-red-600 transition-colors p-1" title="Đăng xuất">
                            <LogOut className="size-4" />
                        </button>
                    </form>
                    <form action={logoutAction} className="hidden group-data-[collapsible=icon]:block absolute inset-0">
                        <button type="submit" className="w-full h-full opacity-0 cursor-pointer" title="Đăng xuất"></button>
                    </form>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
