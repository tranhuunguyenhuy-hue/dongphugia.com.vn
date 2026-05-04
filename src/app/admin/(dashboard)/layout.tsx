import { verifyAdminSession } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import SidebarNav from "./sidebar-nav"
import AdminHeader from "./admin-header"
import "../admin.css"

// ── Maintenance mode flag ──────────────────────────────────────────────────
// Set to `false` and redeploy to restore admin access.
const ADMIN_MAINTENANCE = false
// ──────────────────────────────────────────────────────────────────────────

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    if (ADMIN_MAINTENANCE) redirect("/maintenance")

    const isAuthenticated = await verifyAdminSession()
    if (!isAuthenticated) redirect("/admin/login")

    const pendingQuotes = await prisma.quote_requests.count({ where: { status: 'pending' } })

    return (
        <div className="flex min-h-screen w-full bg-white">
            <SidebarNav pendingQuotes={pendingQuotes} />
            <div className="flex flex-1 flex-col sm:pl-60 sidebar-transition">
                <AdminHeader />
                <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-page-enter max-w-7xl mx-auto w-full">
                    {children}
                </main>
            </div>
        </div>
    )
}
