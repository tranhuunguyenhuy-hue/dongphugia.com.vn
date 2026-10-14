'use server'

import type {
  PublicContactPayload,
  PublicContactResult,
} from '@dpg/app-contracts'

export async function getMegaMenuData() {
  return {
    categories: [
      { id: 1, name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh', thumbnail_url: null, icon_name: null },
      { id: 2, name: 'Thiết bị bếp', slug: 'thiet-bi-bep', thumbnail_url: null, icon_name: null },
      { id: 3, name: 'Vật liệu nước', slug: 'vat-lieu-nuoc', thumbnail_url: null, icon_name: null },
      { id: 4, name: 'Gạch ốp lát', slug: 'gach-op-lat', thumbnail_url: null, icon_name: null },
    ],
    menuData: {},
  }
}

export async function submitContactForm(
  _payload: PublicContactPayload,
): Promise<PublicContactResult> {
  return {
    success: false,
    error: 'Biểu mẫu đang tạm khóa trên bản Preview và không ghi dữ liệu.',
  }
}
