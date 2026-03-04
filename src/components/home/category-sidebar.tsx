import { getMegaMenuData } from '@/app/actions/mega-menu-actions'
import { MegaMenuSidebar } from './mega-menu'

export async function CategorySidebar() {
    const data = await getMegaMenuData()

    // Server Component sẽ fetch Data pass vào Client Component MegaMenu
    return <MegaMenuSidebar categories={data?.categories || []} menuData={data?.menuData || {}} />
}
