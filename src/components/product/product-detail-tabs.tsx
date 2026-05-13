'use client';

import { useState, useRef, useEffect } from 'react';

// ────────── HTML Sanitizer ──────────
// Defensive layer: strips hita spinner images and broken links from
// product descriptions before rendering.
function sanitizeProductHtml(html: string): string {
    if (!html) return html;
    let result = html;

    // 1. Remove <img> tags with src pointing to any hita domain
    //    (catches hita.com.vn/images/original.jpg spinner and cdn.hita.com.vn CDN images)
    result = result.replace(
        /<img\b[^>]*\bsrc=["']https?:\/\/[^"']*hita[^"']*["'][^>]*\/?>/gi,
        ''
    );

    // 2. Unwrap hita hyperlinks: keep visible text, remove href
    //    <a href="https://hita.com.vn/...">text</a>  →  text
    let prev = '';
    while (prev !== result) {
        prev = result;
        result = result.replace(
            /<a\b[^>]*\bhref=["']https?:\/\/[^"']*hita\.com\.vn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
            '$1'
        );
    }

    // 3. Remove empty paragraph tags left after cleanup
    result = result.replace(/<p[^>]*>\s*<\/p>/gi, '');

    return result;
}

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
    extraSpecs?: { key: string; value: React.ReactNode }[];
    /** Technologies list (e.g. TBVS technologies) */
    technologies?: Technology[];
    /** Locations list (e.g. gach-op-lat usage locations) */
    locations?: { locations: { id: number; name: string; slug: string } }[];
    /** Documents list (e.g. PDF, manuals) */
    documents?: { name: string; url: string; size?: string; type?: string }[];
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
    documents = [],
    tabConfig,
}: ProductDetailTabsProps) {
    const [activeTab, setActiveTab] = useState<'info' | 'specs' | 'features' | 'docs'>('info');
    const [isSpecsExpanded, setIsSpecsExpanded] = useState(false);
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);
    const [showInfoToggle, setShowInfoToggle] = useState(false);
    const infoContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab === 'info' && infoContentRef.current) {
            // Check if content exceeds our max-height of 500px
            if (infoContentRef.current.scrollHeight > 500) {
                setShowInfoToggle(true);
            } else {
                setShowInfoToggle(false);
            }
        }
    }, [activeTab, description]);

    const config = {
        infoLabel: tabConfig?.infoLabel ?? 'Thông tin chung',
        featuresLabel: tabConfig?.featuresLabel ?? 'Tính năng nổi bật',
        specsLabel: tabConfig?.specsLabel ?? 'Thông số kỹ thuật',
        docsLabel: 'Tài liệu hướng dẫn',
    };

    // Parse specifications robustly
    let specsList: { key: string; value: React.ReactNode }[] = [];

    // Prepend extra specs if provided (e.g. sango dimensions)
    if (extraSpecs && extraSpecs.length > 0) {
        specsList = [...extraSpecs];
    }

    if (specifications) {
        if (Array.isArray(specifications)) {
            const parsed = specifications.map((s: any) => ({
                key: s.key || s.name || Object.keys(s)[0] || '',
                value: s.value || Object.values(s)[0] || '',
            })).filter((s: { key: string; value: any }) => s.key && s.value);
            specsList = [...specsList, ...parsed];
        } else if (typeof specifications === 'object' && specifications !== null) {
            const parsed = Object.entries(specifications)
                .filter(([key]) => key !== 'documents' && key !== 'technologies' && key !== 'Phụ kiện đi kèm') // exclude reserved keys from raw specs table
                .map(([key, value]) => {
                    let displayValue = String(value);
                    if (typeof value === 'object' && value !== null) {
                        try {
                            displayValue = Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
                        } catch (e) {
                            displayValue = '[Dữ liệu phức tạp]';
                        }
                    }
                    return {
                        key,
                        value: displayValue,
                    };
                });
            specsList = [...specsList, ...parsed];
        }
    }

    // Deduplicate specs by key (case-insensitive)
    const uniqueSpecs = new Map<string, typeof specsList[0]>();
    specsList.forEach(spec => {
        const lowerKey = spec.key.toLowerCase().trim();
        // Keep the first encountered (extraSpecs are richer, e.g. Color with Hex block)
        if (!uniqueSpecs.has(lowerKey)) {
            uniqueSpecs.set(lowerKey, spec);
        }
    });
    specsList = Array.from(uniqueSpecs.values());

    // Auto-extract documents from specs if they are links
    const parsedDocuments = [...documents];
    
    // Extract explicitly parsed documents array if injected by crawler
    if (specifications && typeof specifications === 'object' && Array.isArray(specifications.documents)) {
        specifications.documents.forEach((doc: any) => {
            if (doc.url && doc.name) {
                parsedDocuments.push({
                    name: doc.name,
                    url: doc.url,
                    type: doc.type || (doc.url.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Link'),
                    size: doc.size || 'Xem chi tiết',
                });
            }
        });
    }

    const filteredSpecsList: typeof specsList = [];

    specsList.forEach(spec => {
        const keyLower = spec.key.toLowerCase();
        const valueStr = String(spec.value).trim();
        const isDocKey = keyLower.includes('tài liệu') || keyLower.includes('hướng dẫn') || keyLower.includes('bản vẽ') || keyLower.includes('catalogue') || keyLower.includes('pdf');
        
        if (isDocKey && valueStr.startsWith('http')) {
            parsedDocuments.push({
                name: spec.key,
                url: valueStr,
                type: valueStr.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Link',
                size: 'Xem chi tiết',
            });
        } else {
            filteredSpecsList.push(spec);
        }
    });

    specsList = filteredSpecsList;

    // ────────── Sort Specifications by Importance ──────────
    const PRIORITY_KEYS = [
        'thương hiệu',
        'nơi sản xuất',
        'xuất xứ',
        'bảo hành',
        'loại nắp',
        'mẫu nắp',
        'kiểu xả',
        'lượng nước xả',
        'kiểu thoát',
        'tâm xả',
        'hệ thống xả',
        'loại thân cầu',
        'thiết kế',
        'thân kín',
        'vành',
        'màu sắc',
        'chất liệu',
        'công nghệ',
        'kích thước (dxrxc)',
        'kích thước',
        'thân cầu',
        'mã sản phẩm'
    ];

    const getSpecPriority = (key: string) => {
        const normalizedKey = key.toLowerCase().trim();
        const exactMatch = PRIORITY_KEYS.findIndex(p => normalizedKey === p);
        if (exactMatch !== -1) return exactMatch;
        
        const partialMatch = PRIORITY_KEYS.findIndex(p => normalizedKey.includes(p));
        return partialMatch !== -1 ? partialMatch + 50 : 999;
    };

    specsList.sort((a, b) => getSpecPriority(a.key) - getSpecPriority(b.key));

    const renderSpecValue = (key: string, value: any) => {
        if (typeof value !== 'string') {
            // If value is a ReactNode (like the color swatch), render it directly
            return value;
        }
        const valStr = String(value);
        if (key.toLowerCase().trim() === 'thương hiệu') {
            return <span className="text-[#00b2e3] font-semibold">{valStr}</span>;
        }
        if (valStr.includes('\n')) {
            return (
                <div className="flex flex-col gap-0.5">
                    {valStr.split('\n').map((line, i) => {
                        const isTech = line.toLowerCase().includes('cefiontect') || line.toLowerCase().includes('ewater');
                        return (
                            <span key={i} className={isTech ? "text-[#00b2e3]" : ""}>
                                {line}
                            </span>
                        );
                    })}
                </div>
            );
        }
        return valStr;
    };

    const hasSpecs = specsList.length > 0 || technologies.length > 0;
    const hasFeatures = !!features;

    return (
        <div className="mt-0 mb-16 max-w-[1216px] w-full">
            <div className="flex overflow-x-auto overflow-y-hidden whitespace-nowrap gap-3 sm:gap-6 lg:gap-8 mb-6 sm:mb-8 border-b-2 border-stone-100 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" role="tablist">
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
                {parsedDocuments.length > 0 && (
                    <TabButton
                        label={config.docsLabel}
                        isActive={activeTab === 'docs'}
                        onClick={() => setActiveTab('docs')}
                    />
                )}
            </div>

            {/* Tab Content */}
            <div className="mt-6 animate-fade-in">
                {activeTab === 'info' && (
                    <div>
                        {description ? (
                            <div className="relative">
                                <div
                                    ref={infoContentRef}
                                    className={`font-normal text-base leading-relaxed text-stone-700 prose max-w-none prose-headings:font-bold prose-headings:text-stone-900 prose-h2:text-2xl prose-h3:text-xl prose-a:text-[#00b2e3] hover:prose-a:text-[#25738E] prose-ul:list-disc prose-ul:pl-5 prose-li:my-1 prose-img:rounded-xl prose-img:shadow-sm transition-all duration-500 overflow-hidden ${(!isInfoExpanded && showInfoToggle) ? 'max-h-[500px]' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(description) }}
                                />
                                {showInfoToggle && !isInfoExpanded && (
                                    <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
                                )}
                                {showInfoToggle && (
                                    <div className={`flex justify-center mt-6 ${!isInfoExpanded ? 'absolute bottom-2 left-0 right-0 z-10' : ''}`}>
                                        <button 
                                            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                                            className="px-6 py-2.5 rounded-full border border-stone-200 text-sm font-semibold text-brand-600 bg-white hover:bg-stone-50 hover:border-brand-300 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.05)] flex items-center gap-2"
                                        >
                                            {isInfoExpanded ? 'Thu gọn nội dung' : 'Đọc thêm nội dung'}
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${isInfoExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-stone-500 italic text-[15px]">
                                Nội dung đang được cập nhật...
                            </p>
                        )}

                        {/* Locations (e.g. gach-op-lat usage locations) */}
                        {locations.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-stone-100">
                                <h4 className="text-sm font-semibold text-stone-700 mb-3">Vị trí sử dụng phù hợp</h4>
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
                                className="font-normal text-base leading-relaxed text-stone-700 prose prose-sm max-w-none prose-img:rounded-xl prose-img:shadow-sm"
                                dangerouslySetInnerHTML={{ __html: sanitizeProductHtml(features) }}
                            />
                        ) : null}
                    </div>
                )}

                {activeTab === 'specs' && (
                    <div className="space-y-10">
                        {specsList.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900 mb-4">Thông số kỹ thuật</h3>
                                <div className="relative">
                                    <div className="rounded-[12px] overflow-hidden border border-stone-200">
                                        <table className="w-full text-left border-collapse">
                                            <tbody>
                                                {(isSpecsExpanded ? specsList : specsList.slice(0, 6)).map((spec, idx) => (
                                                    <tr key={idx} className="odd:bg-[#f8f9fa] even:bg-white hover:bg-stone-100/50 transition-colors border-b border-stone-100 last:border-0">
                                                        <th className="py-3.5 px-5 w-[40%] md:w-[30%] font-semibold text-stone-900 text-[14px] align-top">
                                                            {spec.key}
                                                        </th>
                                                        <td className="py-3.5 px-5 text-stone-800 text-[14px] leading-relaxed">
                                                            {renderSpecValue(spec.key, spec.value)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {!isSpecsExpanded && specsList.length > 6 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none rounded-b-[12px]" />
                                    )}
                                </div>
                                {specsList.length > 6 && (
                                    <div className="mt-5 flex justify-center">
                                        <button 
                                            onClick={() => setIsSpecsExpanded(!isSpecsExpanded)}
                                            className="px-6 py-2.5 rounded-full border border-stone-200 text-sm font-semibold text-brand-600 bg-white hover:bg-stone-50 hover:border-brand-300 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.05)] flex items-center gap-2"
                                        >
                                            {isSpecsExpanded ? 'Thu gọn thông số' : 'Xem toàn bộ thông số'}
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform duration-300 ${isSpecsExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {!hasSpecs && (
                            <p className="text-stone-500 italic text-[15px]">
                                Thông số kỹ thuật đang được cập nhật...
                            </p>
                        )}

                        {/* Technologies (optional, e.g. TBVS) */}
                        {technologies.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900 mb-4">Công nghệ tích hợp</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {technologies.map(tech => (
                                        <div key={tech.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-100 flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md bg-brand-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                    {tech.name.charAt(0)}
                                                </div>
                                                <h4 className="font-semibold text-stone-800 text-[15px]">
                                                    {tech.name}
                                                </h4>
                                            </div>
                                            {tech.description && (
                                                <p className="text-sm text-stone-600 leading-relaxed ml-8">
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

                {activeTab === 'docs' && parsedDocuments.length > 0 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {parsedDocuments.map((doc, idx) => (
                                <a 
                                    key={idx} 
                                    href={doc.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="group flex items-start gap-4 p-4 rounded-xl border border-stone-200 bg-white hover:border-brand-300 hover:shadow-md transition-all duration-200"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-500 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center shrink-0 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h4 className="text-sm font-semibold text-stone-900 group-hover:text-brand-600 line-clamp-2 transition-colors">
                                            {doc.name}
                                        </h4>
                                        <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">
                                            {doc.type || 'PDF'} • {doc.size || 'Tải xuống'}
                                        </p>
                                    </div>
                                </a>
                            ))}
                        </div>
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
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={onClick}
            className={`
                pb-3 sm:pb-4 font-semibold text-[13px] sm:text-[15px] lg:text-[17px] leading-tight transition-colors duration-200 relative whitespace-nowrap
                ${isActive
                    ? 'text-stone-900'
                    : 'text-stone-400 hover:text-stone-600'
                }
            `}
        >
            {label}
            {isActive && (
                <div
                    className="absolute -bottom-[2px] left-0 right-0 h-[3px] rounded-t-full bg-brand-500"
                />
            )}
        </button>
    );
}
