import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { verifyAdminSession } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import SidebarNav from "./sidebar-nav"
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
        <SidebarProvider className="admin-theme bg-stone-100 w-full h-screen overflow-hidden">
            <SidebarNav pendingQuotes={pendingQuotes} />
            <SidebarInset className="bg-transparent p-2 pr-2 md:p-3 md:pr-3 h-full overflow-hidden">
                <div className="flex flex-col flex-1 bg-white border border-border/60 rounded-[1rem] shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden h-full relative">
                    <div className="absolute top-4 left-4 z-10 md:hidden">
                        <SidebarTrigger />
                    </div>
                    <div className="flex-1 overflow-y-auto relative scroll-smooth">
                        <main className="p-4 sm:p-6 lg:p-8 animate-page-enter w-full">
                            {children}
                        </main>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
