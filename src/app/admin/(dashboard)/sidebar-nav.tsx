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

const mainNav = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
]

type NavItem = {
    label: string
    href: string
    quoteBadge?: boolean
    permission?: Permission
}

type NavGroup = {
    title: string
    icon: React.ElementType
    isActive: boolean
    items: NavItem[]
}

const getCollapsibleNav = (role: SessionUser['role']): NavGroup[] => {
    return [
        {
            title: "Sản phẩm (PIM)",
            icon: Package2,
            isActive: true, // Default open
            items: [
                { label: "Danh sách sản phẩm", href: "/admin/products", permission: "products:read" },
                { label: "Danh mục", href: "/admin/categories", permission: "categories:read" },
            ],
        },
        {
            title: "Kinh doanh (OMS)",
            icon: ShoppingBag,
            isActive: true,
            items: [
                { label: "Khách hàng (CSKH)", href: "/admin/customers", permission: "customers:read" },
                { label: "Đơn hàng", href: "/admin/orders" }, // Everyone can see orders (data filtered inside)
                { label: "Báo giá", href: "/admin/quote-requests", quoteBadge: true, permission: "quotes:read" },
            ],
        },
        {
            title: "Nội dung & CMS",
            icon: LayoutGrid,
            isActive: true,
            items: [
                { label: "Banners", href: "/admin/content/banners", permission: "blog:read" },
                { label: "Blog", href: "/admin/blog/posts", permission: "blog:read" },
            ],
        },
        {
            title: "Hệ thống",
            icon: ClipboardList,
            isActive: false,
            items: [
                { label: "Quản lý nhân viên", href: "/admin/users", permission: "users:read" },
            ],
        },
    ]
}

export default function SidebarNav({ pendingQuotes, pendingOrders, currentUser }: SidebarNavProps) {
    const pathname = usePathname()
    
    // Filter nav groups based on permissions
    const visibleNavGroups = getCollapsibleNav(currentUser.role)
        .map(group => ({
            ...group,
            items: group.items.filter(item => !item.permission || can(currentUser.role, item.permission))
        }))
        .filter(group => group.items.length > 0) // Only keep groups that have at least one visible item

    return (
        <Sidebar collapsible="icon" className="border-r border-transparent bg-stone-100">
            <SidebarHeader className="py-4">
                <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center px-3">
                    <Link href="/admin" className="flex items-center group-data-[collapsible=icon]:hidden">
                        <Image 
                            src="/images/logo-dpg.png" 
                            alt="Đông Phú Gia" 
                            width={140} 
                            height={32} 
                            className="h-8 w-auto object-contain"
                            priority 
                        />
                    </Link>
                    <SidebarTrigger className="shrink-0" />
                </div>
            </SidebarHeader>
            <SidebarContent className="px-2 gap-4 mt-2">
                <SidebarGroup>
                    <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-1">Tổng quan</SidebarGroupLabel>
                    <SidebarMenu className="gap-1.5">
                        {mainNav.map((item) => {
                            const isActive = item.exact
                                ? pathname === item.href
                                : pathname.startsWith(item.href)
                            
                            return (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className="sidebar-item-glass h-10 px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center rounded-lg">
                                        <Link href={item.href}>
                                            <item.icon className="size-4 shrink-0" />
                                            <span className="font-medium group-data-[collapsible=icon]:hidden">{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )
                        })}
                    </SidebarMenu>
                </SidebarGroup>
                
                <SidebarSeparator className="mx-2 group-data-[collapsible=icon]:mx-1" />

                <SidebarGroup>
                    <SidebarGroupLabel className="text-xs font-medium text-muted-foreground mb-1">Quản trị hệ thống</SidebarGroupLabel>
                    <SidebarMenu className="gap-2">
                        {visibleNavGroups.map((group) => (
                            <Collapsible key={group.title} asChild defaultOpen={group.isActive} className="group/collapsible">
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip={group.title} className="sidebar-item-glass h-10 px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center rounded-lg font-medium">
                                            {group.icon && <group.icon className="size-4 shrink-0" />}
                                            <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
                                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub className="mt-1.5 gap-1.5">
                                            {group.items.map((subItem) => {
                                                const isSubActive = pathname === subItem.href || pathname.startsWith(subItem.href + "/")
                                                return (
                                                    <SidebarMenuSubItem key={subItem.href} className="relative">
                                                        <SidebarMenuSubButton asChild isActive={isSubActive} className="sidebar-item-glass h-9 rounded-md px-3 text-muted-foreground hover:text-foreground">
                                                            <Link href={subItem.href}>
                                                                <span>{subItem.label}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                        {subItem.quoteBadge && pendingQuotes > 0 && (
                                                            <div className="absolute right-2 top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                                                                {pendingQuotes > 9 ? "9+" : pendingQuotes}
                                                            </div>
                                                        )}
                                                    </SidebarMenuSubItem>
                                                )
                                            })}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="flex flex-col gap-3 p-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                            {currentUser.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
                            <span className="truncate text-sm font-medium">{currentUser.name}</span>
                            <span className="truncate text-xs text-muted-foreground">{currentUser.email}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between group-data-[collapsible=icon]:hidden">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[currentUser.role]}`}>
                            {ROLE_LABELS[currentUser.role]}
                        </span>
                    </div>
                    <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <form action={logoutAction}>
                                <SidebarMenuButton type="submit" tooltip="Đăng xuất" className="sidebar-item-glass h-10 px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50">
                                    <LogOut className="size-4 shrink-0" />
                                    <span className="font-medium group-data-[collapsible=icon]:hidden">Đăng xuất</span>
                                </SidebarMenuButton>
                            </form>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
