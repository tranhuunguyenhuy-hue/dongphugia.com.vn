import { verifyAdminSession } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import SidebarNav from "./sidebar-nav"
import AdminHeader from "./admin-header"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) redirect("/admin/login")

    const pendingQuotes = await prisma.quote_requests.count({ where: { status: 'pending' } })

    return (
        <div className="flex min-h-screen w-full bg-slate-50/50">
            <SidebarNav pendingQuotes={pendingQuotes} />
            <div className="flex flex-1 flex-col sm:pl-60 sidebar-transition">
                <AdminHeader />
                <main className="flex-1 p-4 sm:p-6 animate-page-enter">
                    {children}
                </main>
            </div>
        </div>
    )
}
