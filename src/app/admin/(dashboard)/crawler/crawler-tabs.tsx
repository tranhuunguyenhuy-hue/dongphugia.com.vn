'use client'

import { useState } from 'react'
import { CrawlerClient } from './crawler-client'
import { TbvsCrawlerClient } from './tbvs-crawler-client'

const tabs = [
    { id: 'gach', label: 'Gạch ốp lát' },
    { id: 'tbvs', label: 'Thiết bị vệ sinh' },
] as const

type TabId = typeof tabs[number]['id']

export function CrawlerTabs() {
    const [activeTab, setActiveTab] = useState<TabId>('tbvs')

    return (
        <div className="space-y-6">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'gach' && <CrawlerClient />}
            {activeTab === 'tbvs' && <TbvsCrawlerClient />}
        </div>
    )
}
