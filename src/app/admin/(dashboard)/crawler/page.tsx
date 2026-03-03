import { Metadata } from 'next'
import { CrawlerClient } from './crawler-client'

export const metadata: Metadata = {
    title: 'Crawler Data | Đông Phú Gia',
    description: 'Hệ thống tự động bào dữ liệu Vietceramics'
}

export default function CrawlerPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Hệ thống Crawler Vietceramics</h2>
            </div>
            <CrawlerClient />
        </div>
    )
}
