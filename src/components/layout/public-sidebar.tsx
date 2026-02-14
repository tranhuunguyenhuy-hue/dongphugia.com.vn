import { getAllCategories } from "@/lib/public-api"
import { SidebarMenu } from "./sidebar-menu"
import { SidebarShell } from "@/components/ui/sidebar-shell"

export async function PublicSidebar({ activeSlug }: { activeSlug?: string }) {
    const categories = await getAllCategories()

    // Transform to simplified structure if needed, or pass as is
    const validCategories = categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        children: cat.children
    }))

    return (
        <SidebarShell title="Danh mục sản phẩm">
            <SidebarMenu categories={validCategories} activeSlug={activeSlug} />
        </SidebarShell>
    )
}
