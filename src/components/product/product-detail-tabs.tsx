'use client';

import { useState } from 'react';

interface SpecRow {
    label: string;
    value: string;
}

interface ProductInfoTab {
    material?: string | null;
    thickness?: string | null;
    waterAbsorption?: string | null;
    usage?: string | null;
}

interface ProductDetailTabsProps {
    description?: string | null;
    specRows: SpecRow[];
    productInfo?: ProductInfoTab;
}

export function ProductDetailTabs({
    description,
    specRows,
    productInfo,
}: ProductDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'specs'>('info');

    // Product info rows (from structured fields)
    const infoRows = [
        { label: 'Chất liệu', value: productInfo?.material },
        { label: 'Độ dày', value: productInfo?.thickness },
        { label: 'Độ hút nước', value: productInfo?.waterAbsorption },
        { label: 'Ứng dụng', value: productInfo?.usage },
    ].filter((r) => r.value) as SpecRow[];

    return (
        <div className="mb-16">
            {/* Tab Headers */}
            <div className="flex gap-6 sm:gap-8 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`
                        pb-3 font-semibold text-lg sm:text-[24px] sm:leading-[32px] tracking-[-0.48px] transition-colors relative
                        ${activeTab === 'info'
                            ? 'text-[#1f2937]'
                            : 'text-[#1f2937] opacity-50 hover:opacity-75'
                        }
                    `}
                >
                    Thông tin về sản phẩm
                    {activeTab === 'info' && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#15803d] rounded-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('specs')}
                    className={`
                        pb-3 font-semibold text-lg sm:text-[24px] sm:leading-[32px] tracking-[-0.48px] transition-colors relative
                        ${activeTab === 'specs'
                            ? 'text-[#1f2937]'
                            : 'text-[#1f2937] opacity-50 hover:opacity-75'
                        }
                    `}
                >
                    Thông số kỹ thuật
                    {activeTab === 'specs' && (
                        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#15803d] rounded-full" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'info' ? (
                <div className="space-y-6">
                    {/* Structured product info */}
                    {infoRows.length > 0 && (
                        <div className="bg-[#f3f4f6] rounded-[12px] px-4 py-3 flex flex-col gap-2 max-w-[600px]">
                            {infoRows.map((row, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                    <span className="font-medium text-[16px] leading-[24px] text-[#111827]">
                                        {row.label}
                                    </span>
                                    <span className="font-normal text-[16px] leading-[24px] text-[#374151] text-right">
                                        {row.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* HTML description */}
                    {description ? (
                        <div
                            className="font-normal text-[16px] leading-[24px] text-[#374151] max-w-[1216px] prose prose-sm"
                            dangerouslySetInnerHTML={{ __html: description }}
                        />
                    ) : infoRows.length === 0 ? (
                        <p className="text-[#374151] text-[16px] leading-[24px]">
                            Chưa có thông tin mô tả cho sản phẩm này.
                        </p>
                    ) : null}
                </div>
            ) : (
                <div>
                    {specRows.length > 0 ? (
                        <div className="bg-[#f3f4f6] rounded-[12px] px-4 py-3 flex flex-col gap-2 max-w-[600px]">
                            {specRows.map((row, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                    <span className="font-medium text-[16px] leading-[24px] text-[#111827]">
                                        {row.label}
                                    </span>
                                    <span className="font-normal text-[16px] leading-[24px] text-[#374151] text-right">
                                        {row.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[#374151] text-[16px] leading-[24px]">
                            Chưa có thông số kỹ thuật.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
