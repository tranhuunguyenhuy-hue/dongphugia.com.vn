// Cloudflare's shell keeps canonical visual components but has no verified
// catalogue read or write backend yet. Do not enable commerce or form controls.
import { NAV_PRODUCT_CATEGORIES } from '@/config/site'

export const PUBLIC_UI_READ_ONLY = true
export const PUBLIC_UI_READ_ONLY_MENU = {
  categories: NAV_PRODUCT_CATEGORIES.filter(({ active }) => active).map(({ href, label }, index) => ({
    id: index + 1,
    name: label,
    slug: href.slice(1),
    thumbnail_url: null,
    icon_name: null,
  })),
  menuData: {},
}
