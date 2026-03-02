'use client';

import { useState } from 'react';

interface ProductDetailTabsProps {
    description?: string | null;
    sizes?: { label: string } | null;
    surfaces?: { name: string } | null;
    origins?: { name: string } | null;
    collections?: { name: string } | null;
    colors?: Array<{ colors: { name: string } }>;
    locations?: Array<{ locations: { name: string } }>;
}

export function ProductDetailTabs({
    description,
    locations = [],
}: Pick<ProductDetailTabsProps, 'description' | 'locations'>) {
    const [activeTab, setActiveTab] = useState<'info' | 'specs'>('info');

    const locationNames = locations.map((l) => l.locations.name);

    return (
        <div className="mt-8 mb-16 max-w-[1216px]">
            {/* Tab Headers */}
            <div className="flex gap-8 sm:gap-12 mb-8 border-b-2 border-transparent">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`
                        pb-2 font-semibold text-[20px] sm:text-[24px] leading-[32px] tracking-[-0.48px] transition-colors relative
                        ${activeTab === 'info'
                            ? 'text-[#1f2937]'
                            : 'text-[#6b7280] hover:text-[#374151]'
                        }
                    `}
                >
                    Thông tin về sản phẩm
                    {activeTab === 'info' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#15803d] rounded-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('specs')}
                    className={`
                        pb-2 font-semibold text-[20px] sm:text-[24px] leading-[32px] tracking-[-0.48px] transition-colors relative
                        ${activeTab === 'specs'
                            ? 'text-[#1f2937]'
                            : 'text-[#6b7280] hover:text-[#374151]'
                        }
                    `}
                >
                    Thông số kỹ thuật
                    {activeTab === 'specs' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#15803d] rounded-full" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'info' ? (
                    <div>
                        {description ? (
                            <div
                                className="font-normal text-[16px] leading-[24px] text-[#374151] prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: description }}
                            />
                        ) : (
                            <p className="text-[#374151] text-[16px] leading-[24px]">
                                Đang cập nhật thông tin sản phẩm...
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Locations */}
                        {locationNames.length > 0 ? (
                            <div>
                                <p className="font-medium text-[16px] leading-[24px] text-[#111827] mb-2">Vị trí khuyên dùng:</p>
                                <div className="flex flex-wrap gap-2">
                                    {locationNames.map((name) => (
                                        <span
                                            key={name}
                                            className="px-3 py-1 bg-[#f0fdf4] text-[#15803d] rounded-[8px] text-[14px] font-medium border border-[#bbf7d0]"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-[#374151] text-[16px] leading-[24px]">
                                Đang cập nhật thông số kỹ thuật...
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
