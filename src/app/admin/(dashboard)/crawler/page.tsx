import { Metadata } from 'next'
import { CrawlerTabs } from './crawler-tabs'

export const metadata: Metadata = {
    title: 'Crawler Data | Đông Phú Gia',
    description: 'Hệ thống tự động thu thập dữ liệu sản phẩm'
}

export default function CrawlerPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Crawler Dữ Liệu Sản Phẩm</h2>
            </div>
            <CrawlerTabs />
        </div>
    )
}
