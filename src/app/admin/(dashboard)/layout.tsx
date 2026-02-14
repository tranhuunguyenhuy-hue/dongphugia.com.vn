import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import SidebarNav from "./sidebar-nav"
import AdminHeader from "./admin-header"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user) {
        redirect("/admin/login")
    }

    // Fetch counts for sidebar badges
    const [tileCategory, sanitaryCategory, kitchenCategory, waterCategory, flooringCategory] = await Promise.all([
        prisma.category.findUnique({ where: { slug: "gach-op-lat" }, select: { id: true } }),
        prisma.category.findUnique({ where: { slug: "thiet-bi-ve-sinh" }, select: { id: true } }),
        prisma.category.findUnique({ where: { slug: "thiet-bi-nha-bep" }, select: { id: true } }),
        prisma.category.findUnique({ where: { slug: "thiet-bi-nghanh-nuoc" }, select: { id: true } }),
        prisma.category.findUnique({ where: { slug: "san-go-san-nhua" }, select: { id: true } }),
    ])

    const [tiles, sanitary, kitchen, water, flooring, quotes] = await Promise.all([
        tileCategory ? prisma.product.count({ where: { categoryId: tileCategory.id } }) : 0,
        sanitaryCategory ? prisma.product.count({ where: { categoryId: sanitaryCategory.id } }) : 0,
        kitchenCategory ? prisma.product.count({ where: { categoryId: kitchenCategory.id } }) : 0,
        waterCategory ? prisma.product.count({ where: { categoryId: waterCategory.id } }) : 0,
        flooringCategory ? prisma.product.count({ where: { categoryId: flooringCategory.id } }) : 0,
        prisma.quoteRequest.count({ where: { status: "PENDING" } }),
    ])

    return (
        <div className="flex min-h-screen w-full bg-slate-50/50">
            <SidebarNav
                counts={{ tiles, sanitary, kitchen, water, flooring, quotes }}
                userEmail={session.user.email || "admin"}
            />
            {/* Main content — uses sm:pl-60 for expanded sidebar, transitions handled by JS */}
            <div className="flex flex-1 flex-col sm:pl-60 sidebar-transition">
                <AdminHeader />
                <main className="flex-1 p-4 sm:p-6 animate-page-enter">
                    {children}
                </main>
            </div>
        </div>
    )
}
