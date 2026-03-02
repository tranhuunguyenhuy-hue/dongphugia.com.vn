'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

interface FilterItem {
    slug: string;
    name: string;
}

interface SmartFilterProps {
    colors: FilterItem[];
    surfaces: FilterItem[];
    sizes: FilterItem[];
    origins: FilterItem[];
    locations: FilterItem[];
}

function FilterSection({
    title,
    items,
    paramKey,
    defaultOpen = false,
}: {
    title: string;
    items: FilterItem[];
    paramKey: string;
    defaultOpen?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const activeValues = searchParams.get(paramKey)?.split(',').filter(Boolean) || [];

    const toggleItem = useCallback(
        (slug: string) => {
            const params = new URLSearchParams(searchParams.toString());
            const current = params.get(paramKey)?.split(',').filter(Boolean) || [];
            const updated = current.includes(slug)
                ? current.filter((v) => v !== slug)
                : [...current, slug];
            if (updated.length > 0) {
                params.set(paramKey, updated.join(','));
            } else {
                params.delete(paramKey);
            }
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [router, pathname, searchParams, paramKey]
    );

    if (items.length === 0) return null;

    return (
        <div className="flex flex-col gap-2">
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

            {isOpen && (
                <div className="flex flex-col">
                    {items.map((item) => {
                        const isSelected = activeValues.includes(item.slug);
                        return (
                            <button
                                key={item.slug}
                                onClick={() => toggleItem(item.slug)}
                                className="flex items-center justify-between h-[44px] w-full text-left group"
                            >
                                <span
                                    className={`font-medium text-[16px] leading-[24px] ${isSelected ? 'text-[#15803d]' : 'text-[#4b5563] group-hover:text-[#374151]'}`}
                                >
                                    {item.name}
                                </span>
                                <div
                                    className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border-[1.5px] shrink-0 transition-colors ${isSelected
                                        ? 'bg-[#15803d] border-[#15803d]'
                                        : 'bg-white border-[#d1d5db] group-hover:border-[#9ca3af]'
                                        }`}
                                >
                                    {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function SmartFilter({ colors, surfaces, sizes, origins, locations }: SmartFilterProps) {
    const hasAnyFilter = colors.length > 0 || surfaces.length > 0 || sizes.length > 0 || origins.length > 0 || locations.length > 0;
    if (!hasAnyFilter) return null;

    return (
        <div className="flex flex-col gap-[27px]">
            {/* Heading */}
            <div className="flex flex-col gap-[8px]">
                <h3 className="text-[24px] font-semibold text-[#111827] tracking-[-0.48px] leading-[32px]">
                    Bộ lọc thông minh
                </h3>
                <div className="h-[3px] w-[71px] bg-[#15803d] rounded-full" />
            </div>

            {/* Filter sections — No background wrapper, raw sections */}
            <div className="flex flex-col gap-[24px]">
                <FilterSection title="Màu sắc" items={colors} paramKey="color" defaultOpen={true} />
                <FilterSection title="Bề mặt" items={surfaces} paramKey="surface" defaultOpen={true} />
                <FilterSection title="Kích thước" items={sizes.map(s => ({ slug: s.slug, name: s.name }))} paramKey="size" />
                <FilterSection title="Xuất xứ" items={origins} paramKey="origin" />
                <FilterSection title="Vị trí ốp lát" items={locations} paramKey="location" />
            </div>
        </div>
    );
}
