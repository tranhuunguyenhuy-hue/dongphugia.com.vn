import { Metadata } from 'next'
import { PartnersClient } from './partners-client'

export const metadata: Metadata = {
    title: 'Đối tác chiến lược | Đông Phú Gia',
    description: 'Tự hào là đối tác phân phối chính thức của hơn 50 thương hiệu vật liệu xây dựng, thiết bị vệ sinh, nhà bếp hàng đầu trong và ngoài nước.',
}

export default function PartnersPage() {
    return <PartnersClient />
}
