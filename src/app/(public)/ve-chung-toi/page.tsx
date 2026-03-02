import { Metadata } from 'next'
import { AboutClient } from './about-client'

export const metadata: Metadata = {
    title: 'Về chúng tôi | Đông Phú Gia',
    description: 'Khám phá hành trình hơn thập kỷ kiến tạo không gian sống và cung cấp vật liệu xây dựng cao cấp hàng đầu thiết kế tại Đà Lạt.',
}

export default function AboutPage() {
    return <AboutClient />
}
