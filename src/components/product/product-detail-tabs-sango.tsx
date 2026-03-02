'use client';

import { useState } from 'react';

interface ProductDetailTabsSangoProps {
    description?: string | null;
    features?: string | null;
    specifications?: any;
    // Sango specific
    thickness_mm?: number | null;
    width_mm?: number | null;
    length_mm?: number | null;
    ac_rating?: string | null;
    warranty_years?: number | null;
}

export function ProductDetailTabsSango({
    description,
    features,
    specifications,
    thickness_mm,
    width_mm,
    length_mm,
    ac_rating,
    warranty_years,
}: ProductDetailTabsSangoProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'specs' | 'features'>('info');

    // Parse specifications robustly
    let specsList: { key: string; value: string }[] = [];

    // Add specific sango specs first
    if (thickness_mm) specsList.push({ key: "Độ dày", value: `${thickness_mm} mm` });
    if (width_mm) specsList.push({ key: "Chiều rộng", value: `${width_mm} mm` });
    if (length_mm) specsList.push({ key: "Chiều dài", value: `${length_mm} mm` });
    if (ac_rating) specsList.push({ key: "Chỉ số mài mòn (AC)", value: ac_rating });
    if (warranty_years) specsList.push({ key: "Bảo hành", value: `${warranty_years} năm` });

    if (specifications) {
        if (Array.isArray(specifications)) {
            const parsed = specifications.map((s: any) => ({
                key: s.key || s.name || Object.keys(s)[0] || '',
                value: s.value || Object.values(s)[0] || '',
            })).filter(s => s.key && s.value);
            specsList = [...specsList, ...parsed];
        } else if (typeof specifications === 'object') {
            const parsed = Object.entries(specifications).map(([key, value]) => ({
                key,
                value: String(value),
            }));
            specsList = [...specsList, ...parsed];
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
                            ? 'text-[#d97706]'
                            : 'text-[#6b7280] hover:text-[#374151]'
                        }
                    `}
                >
                    Thông tin chung
                    {activeTab === 'info' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#d97706] rounded-t-full" />
                    )}
                </button>
                {hasFeatures && (
                    <button
                        onClick={() => setActiveTab('features')}
                        className={`
                            pb-4 font-semibold text-[18px] sm:text-[22px] leading-tight transition-colors relative whitespace-nowrap
                            ${activeTab === 'features'
                                ? 'text-[#d97706]'
                                : 'text-[#6b7280] hover:text-[#374151]'
                            }
                        `}
                    >
                        Đặc điểm nổi bật
                        {activeTab === 'features' && (
                            <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#d97706] rounded-t-full" />
                        )}
                    </button>
                )}
                <button
                    onClick={() => setActiveTab('specs')}
                    className={`
                        pb-4 font-semibold text-[18px] sm:text-[22px] leading-tight transition-colors relative whitespace-nowrap
                        ${activeTab === 'specs'
                            ? 'text-[#d97706]'
                            : 'text-[#6b7280] hover:text-[#374151]'
                        }
                    `}
                >
                    Thông số kỹ thuật
                    {activeTab === 'specs' && (
                        <div className="absolute -bottom-[2px] left-0 right-0 h-[3px] bg-[#d97706] rounded-t-full" />
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
