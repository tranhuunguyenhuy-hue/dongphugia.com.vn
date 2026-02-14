'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

interface SmartFilterProps {
    colors: string[];
    surfaces: string[];
    dimensions: string[];
}

function FilterSection({
    title,
    items,
    selectedItems,
    onToggle,
    defaultOpen = false,
}: {
    title: string;
    items: string[];
    selectedItems: string[];
    onToggle: (item: string) => void;
    defaultOpen?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    if (items.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between pr-5 w-full text-left"
                >
                    <span className="font-semibold text-lg text-[#1f2937]">{title}</span>
                    {isOpen ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                </button>
                <div className="h-px bg-gray-200 w-full" />
            </div>

            {/* Items */}
            {isOpen && (
                <div className="flex flex-col">
                    {items.map((item) => {
                        const isSelected = selectedItems.includes(item);
                        return (
                            <button
                                key={item}
                                onClick={() => onToggle(item)}
                                className="flex items-center justify-between pr-5 py-2 w-full text-left group"
                            >
                                <span
                                    className={`font-medium text-base ${isSelected ? 'text-[#15803d]' : 'text-[#4b5563] group-hover:text-[#374151]'
                                        }`}
                                >
                                    {item}
                                </span>
                                <div
                                    className={`w-[18px] h-[18px] rounded flex items-center justify-center border-[1.5px] transition-colors ${isSelected
                                            ? 'bg-[#15803d] border-[#15803d]'
                                            : 'bg-white border-gray-300 group-hover:border-gray-400'
                                        }`}
                                >
                                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function SmartFilter({ colors, surfaces, dimensions }: SmartFilterProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const activeColors = searchParams.get('color')?.split(',').filter(Boolean) || [];
    const activeSurfaces = searchParams.get('surface')?.split(',').filter(Boolean) || [];
    const activeDimensions = searchParams.get('dimensions')?.split(',').filter(Boolean) || [];

    const hasAnyFilter = colors.length > 0 || surfaces.length > 0 || dimensions.length > 0;
    if (!hasAnyFilter) return null;

    const updateFilter = useCallback(
        (key: string, values: string[]) => {
            const params = new URLSearchParams(searchParams.toString());
            if (values.length > 0) {
                params.set(key, values.join(','));
            } else {
                params.delete(key);
            }
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [router, pathname, searchParams]
    );

    const toggleItem = (key: string, item: string, current: string[]) => {
        const updated = current.includes(item)
            ? current.filter((v) => v !== item)
            : [...current, item];
        updateFilter(key, updated);
    };

    return (
        <div className="flex flex-col gap-7 px-5">
            {/* Heading */}
            <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-semibold text-[#111827] tracking-tight">
                    Bộ lọc thông minh
                </h3>
                <div className="h-[3px] w-[71px] bg-[#15803d] rounded-full" />
            </div>

            {/* Filter sections */}
            <div className="flex flex-col gap-6">
                <FilterSection
                    title="Màu sắc"
                    items={colors}
                    selectedItems={activeColors}
                    onToggle={(item) => toggleItem('color', item, activeColors)}
                    defaultOpen={true}
                />
                <FilterSection
                    title="Bề mặt"
                    items={surfaces}
                    selectedItems={activeSurfaces}
                    onToggle={(item) => toggleItem('surface', item, activeSurfaces)}
                    defaultOpen={true}
                />
                <FilterSection
                    title="Kích thước"
                    items={dimensions}
                    selectedItems={activeDimensions}
                    onToggle={(item) => toggleItem('dimensions', item, activeDimensions)}
                />
            </div>
        </div>
    );
}
