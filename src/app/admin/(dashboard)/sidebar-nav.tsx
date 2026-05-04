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

interface SidebarNavProps {
    pendingQuotes: number
}

const mainNav = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
]

const collapsibleNav = [
    {
        title: "Sản phẩm (PIM)",
        icon: Package2,
        isActive: true, // Default open
        items: [
            { label: "Danh sách sản phẩm", href: "/admin/products" },
            { label: "Danh mục", href: "/admin/categories" },
        ],
    },
    {
        title: "Kinh doanh (OMS)",
        icon: ShoppingBag,
        isActive: true,
        items: [
            { label: "Đơn hàng", href: "/admin/orders" },
            { label: "Báo giá", href: "/admin/quote-requests", quoteBadge: true },
        ],
    },
    {
        title: "Nội dung & CMS",
        icon: LayoutGrid,
        isActive: true,
        items: [
            { label: "Banners", href: "/admin/banners" },
            { label: "Blog", href: "/admin/blog/posts" },
        ],
    },
]

export default function SidebarNav({ pendingQuotes }: SidebarNavProps) {
    const pathname = usePathname()

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
                        {collapsibleNav.map((group) => (
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
                <SidebarMenu>
                    <SidebarMenuItem>
                        <form action={logoutAction}>
                            <SidebarMenuButton type="submit" tooltip="Đăng xuất" className="sidebar-item-glass h-10 px-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center rounded-lg">
                                <LogOut className="size-4 shrink-0" />
                                <span className="font-medium group-data-[collapsible=icon]:hidden">Đăng xuất</span>
                            </SidebarMenuButton>
                        </form>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
