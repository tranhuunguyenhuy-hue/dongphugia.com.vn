'use client';

import { useState } from 'react';

interface ProductDetailTabsBepProps {
    description?: string | null;
    features?: string | null;
    specifications?: any;
}

export function ProductDetailTabsBep({
    description,
    features,
    specifications,
}: ProductDetailTabsBepProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'specs' | 'features'>('info');

    // Parse specifications robustly
    let specsList: { key: string; value: string }[] = [];
    if (specifications) {
        if (Array.isArray(specifications)) {
            // Assume format [{key, value}] or [{name, value}]
            specsList = specifications.map((s: any) => ({
                key: s.key || s.name || Object.keys(s)[0] || '',
                value: s.value || Object.values(s)[0] || '',
            })).filter(s => s.key && s.value);
        } else if (typeof specifications === 'object') {
            specsList = Object.entries(specifications).map(([key, value]) => ({
                key,
                value: String(value),
            }));
        }
    }

    const hasSpecs = specsList.length > 0;
    const hasFeatures = !!features;

    // Default active tab if 'info' is empty
    if (!description && !activeTab && hasFeatures) setActiveTab('features');
    if (!description && !hasFeatures && !activeTab && hasSpecs) setActiveTab('specs');

    return (
        <div className="mt-8 mb-16 max-w-[1216px] w-full">
            {/* Tab Headers */}
            <div className="flex flex-wrap gap-6 sm:gap-12 mb-8 border-b-2 border-gray-100">
                <button
                    onClick={() => setActiveTab('info')}
                    className={`
                        pb-4 font-semibold text-[18px] sm:text-[22px] leading-tight transition-colors relative whitespace-nowrap
                        ${activeTab === 'info'
                            ? 'text-[#15803d]'
                            : 'text-[#6b7280] hover:text-[#374151]'
                        }
                    `}
                >
                    Thông tin chung
                    {activeTab === 'info' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#15803d] rounded-t-full" />
                    )}
                </button>
                {hasFeatures && (
                    <button
                        onClick={() => setActiveTab('features')}
                        className={`
                            pb-4 font-semibold text-[18px] sm:text-[22px] leading-tight transition-colors relative whitespace-nowrap
                            ${activeTab === 'features'
                                ? 'text-[#15803d]'
                                : 'text-[#6b7280] hover:text-[#374151]'
                            }
                        `}
                    >
                        Tính năng nổi bật
                        {activeTab === 'features' && (
                            <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#15803d] rounded-t-full" />
                        )}
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('specs')}
                    className={`
                        pb-4 font-semibold text-[18px] sm:text-[22px] leading-tight transition-colors relative whitespace-nowrap
                        ${activeTab === 'specs'
                            ? 'text-[#15803d]'
                            : 'text-[#6b7280] hover:text-[#374151]'
                        }
                    `}
                >
                    Thông số kỹ thuật
                    {activeTab === 'specs' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#15803d] rounded-t-full" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'info' && (
                    <div>
                        {description ? (
                            <div
                                className="font-normal text-[16px] leading-relaxed text-[#374151] prose prose-sm max-w-none prose-img:rounded-xl prose-img:shadow-sm"
                                dangerouslySetInnerHTML={{ __html: description }}
                            />
                        ) : (
                            <p className="text-[#6b7280] italic text-[15px]">
                                Nội dung đang được cập nhật...
                            </p>
                        )}
                    </div>
                )}

                {activeTab === 'features' && (
                    <div>
                        {features ? (
                            <div
                                className="font-normal text-[16px] leading-relaxed text-[#374151] prose prose-sm max-w-none prose-img:rounded-xl prose-img:shadow-sm"
                                dangerouslySetInnerHTML={{ __html: features }}
                            />
                        ) : null}
                    </div>
                )}

                {activeTab === 'specs' && (
                    <div className="space-y-10">
                        {/* Specifications Table */}
                        {specsList.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Thông số chi tiết</h3>
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <tbody>
                                            {specsList.map((spec, idx) => (
                                                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                                    <th className="py-3 px-4 w-1/3 bg-gray-50/50 font-medium text-gray-700 text-sm border-r border-gray-100">
                                                        {spec.key}
                                                    </th>
                                                    <td className="py-3 px-4 text-gray-900 text-sm">
                                                        {spec.value}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {!hasSpecs && (
                            <p className="text-[#6b7280] italic text-[15px]">
                                Thông số kỹ thuật đang được cập nhật...
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
