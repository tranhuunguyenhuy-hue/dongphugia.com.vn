import type { Metadata } from 'next'

import { EmergencyPublicHomePage } from '@/app/(public)/page'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Đông Phú Gia - Vật liệu xây dựng tại Đà Lạt' },
  description: 'Thông tin liên hệ và các nhóm hàng Đông Phú Gia tại Đà Lạt. Danh mục sản phẩm trực tuyến đang được cập nhật.',
  alternates: { canonical: '/' },
}

export default EmergencyPublicHomePage
