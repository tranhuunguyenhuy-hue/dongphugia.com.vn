'use client';

import { useState } from 'react';

// ────────── Types ──────────

export interface TabConfig {
    /** Label for the info tab, default: "Thông tin chung" */
    infoLabel?: string;
    /** Label for the features tab, e.g. "Tính năng nổi bật", "Đặc điểm nổi bật", "Ứng dụng thực tế" */
    featuresLabel?: string;
    /** Label for the specs tab, default: "Thông số kỹ thuật" */
    specsLabel?: string;
    /** Accent color, default: "#2E7A96" */
    accentColor?: string;
}

export interface Technology {
    id: number;
    name: string;
    description?: string | null;
}

export interface ProductDetailTabsProps {
    description?: string | null;
    features?: string | null;
    specifications?: any;
    /** Extra specs prepended before parsed specifications (e.g. sango dimensions) */
    extraSpecs?: { key: string; value: string }[];
    /** Technologies list (e.g. TBVS technologies) */
    technologies?: Technology[];
    /** Locations list (e.g. gach-op-lat usage locations) */
    locations?: { locations: { id: number; name: string; slug: string } }[];
    /** Tab config for labels and theming */
    tabConfig?: TabConfig;
}

// ────────── ProductDetailTabs (unified) ──────────

export function ProductDetailTabs({
    description,
    features,
    specifications,
    extraSpecs,
    technologies = [],
    locations = [],
    tabConfig,
}: ProductDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'specs' | 'features'>('info');

    const config = {
        infoLabel: tabConfig?.infoLabel ?? 'Thông tin chung',
        featuresLabel: tabConfig?.featuresLabel ?? 'Tính năng nổi bật',
        specsLabel: tabConfig?.specsLabel ?? 'Thông số kỹ thuật',
    };

    // Parse specifications robustly
    let specsList: { key: string; value: string }[] = [];

    // Prepend extra specs if provided (e.g. sango dimensions)
    if (extraSpecs && extraSpecs.length > 0) {
        specsList = [...extraSpecs];
    }

    if (specifications) {
        if (Array.isArray(specifications)) {
            const parsed = specifications.map((s: any) => ({
                key: s.key || s.name || Object.keys(s)[0] || '',
                value: s.value || Object.values(s)[0] || '',
            })).filter((s: { key: string; value: string }) => s.key && s.value);
            specsList = [...specsList, ...parsed];
        } else if (typeof specifications === 'object') {
            const parsed = Object.entries(specifications).map(([key, value]) => ({
                key,
                value: String(value),
            }));
            specsList = [...specsList, ...parsed];
        }
    }

    const hasSpecs = specsList.length > 0 || technologies.length > 0;
    const hasFeatures = !!features;

    return (
        <div className="mt-8 mb-16 max-w-[1216px] w-full">
            {/* Tab Headers */}
            <div className="flex flex-wrap gap-6 sm:gap-10 mb-8 border-b-2 border-neutral-100">
                <TabButton
                    label={config.infoLabel}
                    isActive={activeTab === 'info'}
                    onClick={() => setActiveTab('info')}
                />
                {hasFeatures && (
                    <TabButton
                        label={config.featuresLabel}
                        isActive={activeTab === 'features'}
                        onClick={() => setActiveTab('features')}
                    />
                )}
                <TabButton
                    label={config.specsLabel}
                    isActive={activeTab === 'specs'}
                    onClick={() => setActiveTab('specs')}
                />
            </div>

            {/* Tab Content */}
            <div className="mt-6 animate-fade-in">
                {activeTab === 'info' && (
                    <div>
                        {description ? (
                            <div
                                className="font-normal text-base leading-relaxed text-neutral-700 prose prose-sm max-w-none prose-img:rounded-xl prose-img:shadow-sm"
                                dangerouslySetInnerHTML={{ __html: description }}
                            />
                        ) : (
                            <p className="text-neutral-500 italic text-[15px]">
                                Nội dung đang được cập nhật...
                            </p>
                        )}

                        {/* Locations (e.g. gach-op-lat usage locations) */}
                        {locations.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-neutral-100">
                                <h4 className="text-sm font-semibold text-neutral-700 mb-3">Vị trí sử dụng phù hợp</h4>
                                <div className="flex flex-wrap gap-2">
                                    {locations.map((loc) => (
                                        <span
                                            key={loc.locations.id}
                                            className="inline-flex items-center px-3 py-1.5 rounded-[var(--radius-pill)] text-sm font-medium bg-sand-50 text-sand-800 border border-sand-200"
                                        >
                                            {loc.locations.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'features' && (
                    <div>
                        {features ? (
                            <div
                                className="font-normal text-base leading-relaxed text-neutral-700 prose prose-sm max-w-none prose-img:rounded-xl prose-img:shadow-sm"
                                dangerouslySetInnerHTML={{ __html: features }}
                            />
                        ) : null}
                    </div>
                )}

                {activeTab === 'specs' && (
                    <div className="space-y-10">
                        {specsList.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Thông số chi tiết</h3>
                                <div className="border border-neutral-200 rounded-[var(--radius)] overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <tbody>
                                            {specsList.map((spec, idx) => (
                                                <tr key={idx} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                                                    <th className="py-3 px-4 w-1/3 bg-neutral-50/50 font-medium text-neutral-700 text-sm border-r border-neutral-100">
                                                        {spec.key}
                                                    </th>
                                                    <td className="py-3 px-4 text-neutral-900 text-sm">
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
                            <p className="text-neutral-500 italic text-[15px]">
                                Thông số kỹ thuật đang được cập nhật...
                            </p>
                        )}

                        {/* Technologies (optional, e.g. TBVS) */}
                        {technologies.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Công nghệ tích hợp</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {technologies.map(tech => (
                                        <div key={tech.id} className="p-4 rounded-[var(--radius)] border border-blue-100 bg-blue-50 flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-blue-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                    {tech.name.charAt(0)}
                                                </div>
                                                <h4 className="font-semibold text-blue-600 text-[15px]">
                                                    {tech.name}
                                                </h4>
                                            </div>
                                            {tech.description && (
                                                <p className="text-sm text-neutral-700 leading-relaxed ml-8">
                                                    {tech.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ────────── Internal TabButton ──────────

function TabButton({
    label,
    isActive,
    onClick,
}: {
    label: string;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                pb-4 font-semibold text-lg sm:text-xl leading-tight transition-colors duration-200 relative whitespace-nowrap
                ${isActive
                    ? 'text-blue-600'
                    : 'text-neutral-500 hover:text-neutral-700'
                }
            `}
        >
            {label}
            {isActive && (
                <div
                    className="absolute -bottom-[2px] left-0 right-0 h-[3px] rounded-t-full bg-blue-600"
                />
            )}
        </button>
    );
}
