'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, Minus, Check, X } from 'lucide-react';
import { useState, useCallback, useMemo } from 'react';

// ────────── Types ──────────

interface FilterOption {
    slug: string;
    name: string;
}

export interface FilterSectionConfig {
    /** Search param key, e.g. "brand", "color", "thickness" */
    key: string;
    /** Display label, e.g. "Thương hiệu", "Màu sắc" */
    label: string;
    /** Available options */
    options: FilterOption[];
    /** single = radio-toggle, multi = checkbox (comma-separated) */
    mode: 'single' | 'multi';
    /** Open by default? */
    defaultOpen?: boolean;
}

export interface SmartFilterProps {
    /** Config array describing each filter section */
    sections: FilterSectionConfig[];
    /** Optional heading, default: "Filters" */
    heading?: string;
    /** Layout variant: 'sidebar' shows badge count + clear button, 'inline' shows accent bar */
    variant?: 'sidebar' | 'inline';
}

// ────────── FilterSection (internal) ──────────

function FilterSection({
    config,
    onFilterChange,
}: {
    config: FilterSectionConfig;
    onFilterChange: (key: string, value: string, mode: 'single' | 'multi') => void;
}) {
    const [isOpen, setIsOpen] = useState(config.defaultOpen ?? true);
    const searchParams = useSearchParams();

    // Get active values
    const raw = searchParams.get(config.key) || '';
    const activeValues = config.mode === 'multi'
        ? raw.split(',').filter(Boolean)
        : [raw].filter(Boolean);

    if (!config.options || config.options.length === 0) return null;

    return (
        <div className="flex flex-col gap-1.5 pt-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full text-left py-1 group"
            >
                <span className="font-medium text-[14px] text-neutral-900 group-hover:text-black">{config.label}</span>
                {isOpen ? (
                    <Minus className="h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" strokeWidth={1.5} />
                ) : (
                    <Plus className="h-4 w-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" strokeWidth={1.5} />
                )}
            </button>

            {isOpen && (
                <div className="flex flex-col gap-0.5 mt-1 ml-1">
                    {config.options.map((item) => {
                        const isSelected = activeValues.includes(item.slug);
                        return (
                            <button
                                key={item.slug}
                                onClick={() => onFilterChange(config.key, item.slug, config.mode)}
                                className="flex items-center gap-3 h-[32px] w-full text-left group"
                            >
                                <div
                                    className={`w-[16px] h-[16px] rounded-[4px] flex items-center justify-center border shrink-0 transition-colors duration-200 ${isSelected
                                        ? 'bg-neutral-900 border-neutral-900'
                                        : 'bg-white border-neutral-300 group-hover:border-neutral-400'
                                        }`}
                                >
                                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={2.5} />}
                                </div>
                                <span
                                    className={`truncate text-[13.5px] leading-none ${isSelected ? 'text-neutral-900 font-medium' : 'text-neutral-600 group-hover:text-neutral-900'}`}
                                >
                                    {item.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ────────── SmartFilter (unified) ──────────

export function SmartFilter({ sections, heading = 'Filters', variant = 'sidebar' }: SmartFilterProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Count active filters across all sections
    const activeFilterCount = useMemo(() => {
        return sections.reduce((count, section) => {
            const val = searchParams.get(section.key);
            if (!val) return count;
            if (section.mode === 'multi') {
                return count + val.split(',').filter(Boolean).length;
            }
            return count + 1;
        }, 0);
    }, [sections, searchParams]);

    // Unified filter change handler
    const handleFilterChange = useCallback(
        (key: string, value: string, mode: 'single' | 'multi') => {
            const params = new URLSearchParams(searchParams.toString());

            if (mode === 'single') {
                // Toggle: if same value, deselect
                if (params.get(key) === value) {
                    params.delete(key);
                } else {
                    params.set(key, value);
                }
            } else {
                // Multi: comma-separated toggle
                const current = params.get(key)?.split(',').filter(Boolean) || [];
                const updated = current.includes(value)
                    ? current.filter((v) => v !== value)
                    : [...current, value];
                if (updated.length > 0) {
                    params.set(key, updated.join(','));
                } else {
                    params.delete(key);
                }
            }

            // Reset page when filters change
            params.delete('page');

            const qs = params.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        },
        [router, pathname, searchParams]
    );

    // Clear all filter keys managed by this component
    const clearFilters = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        sections.forEach((section) => params.delete(section.key));
        params.delete('page');
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [router, pathname, searchParams, sections]);

    // Check if any section has options
    const hasAnyFilter = sections.some((s) => s.options.length > 0);
    if (!hasAnyFilter) return null;

    return (
        <div className="flex flex-col w-full">
            {/* Header */}
            {variant === 'sidebar' ? (
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                    <div className="flex items-center gap-2">
                        <h2 className="text-[15px] font-semibold text-neutral-900">{heading}</h2>
                        {activeFilterCount > 0 && (
                            <span className="flex items-center justify-center bg-neutral-900 text-white text-[10px] font-bold w-4 h-4 rounded-lg leading-none">
                                {activeFilterCount}
                            </span>
                        )}
                    </div>
                    {activeFilterCount > 0 && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                        >
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-[8px] pb-4 border-b border-neutral-100">
                    <h3 className="text-[18px] font-semibold text-neutral-900 tracking-tight">
                        {heading}
                    </h3>
                </div>
            )}

            {/* Filter Sections */}
            <div className={`flex flex-col divide-y divide-neutral-100`}>
                {sections.map((section) => (
                    <FilterSection
                        key={section.key}
                        config={section}
                        onFilterChange={handleFilterChange}
                    />
                ))}
            </div>
        </div>
    );
}
