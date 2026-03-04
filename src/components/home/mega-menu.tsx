'use client';

import * as React from "react"
import Link from "next/link"
import * as NavigationMenu from '@radix-ui/react-navigation-menu'
import { ChevronRight, ChevronDown } from "lucide-react"

export type Category = {
    id: number;
    name: string;
    slug: string;
    thumbnail_url?: string | null;
}

export type MenuData = {
    layout: 'IMAGE_CARDS' | 'COMPLEX_LIST';
    items?: any[];
    brands?: any[];
    types?: any[];
}

export interface MegaMenuProps {
    categories: Category[];
    menuData: Record<string, MenuData> | null;
}

const PATTERN_TYPE_ASSETS: Record<string, string> = {
    "gach-van-da-marble": "/images/pattern-types/marble.png",
    "gach-van-da-tu-nhien": "/images/pattern-types/da-tu-nhien.png",
    "gach-van-go": "/images/pattern-types/van-go.png",
    "gach-thiet-ke-xi-mang": "/images/pattern-types/xi-mang.png",
    "gach-trang-tri": "/images/pattern-types/trang-tri.png",
}

// Render dynamic content based on real data
const renderMegaMenuContent = (cat: Category, data: MenuData | undefined) => {
    if (!data) return (
        <div className="p-8 flex items-center justify-center text-[#9ca3af] h-full min-h-[380px]">
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        </div>
    );

    if (data.layout === 'IMAGE_CARDS') {
        const items = data.items || [];
        const filterKey = cat.slug === 'san-go' ? 'type' : 'pattern';

        return (
            <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[16px] font-semibold text-[#111827]">Danh mục sản phẩm</h3>
                    <Link href={`/${cat.slug}`} className="text-[13px] font-medium text-[#15803d] hover:text-[#166534] flex items-center gap-1 transition-colors">
                        Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {items.length > 0 ? (
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-5">
                        {items.map((item) => {
                            const imageSrc = item.thumbnail_url || item.hero_image_url || PATTERN_TYPE_ASSETS[item.slug];
                            return (
                                <Link href={`/${cat.slug}?${filterKey}=${item.slug}`} key={item.id} className="group/card flex flex-col gap-3">
                                    <div className="w-full aspect-[4/3] rounded-[12px] overflow-hidden bg-[#f3f4f6] relative border border-[#e5e7eb] group-hover/card:border-[#d1fae5] transition-colors duration-300 shadow-sm">
                                        {imageSrc ? (
                                            <img src={imageSrc} alt={item.name} loading="lazy" className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[#9ca3af] text-[11px] text-center p-2">Chưa có ảnh</div>
                                        )}
                                    </div>
                                    <span className="text-[13px] font-medium text-[#374151] group-hover/card:text-[#15803d] text-center leading-snug line-clamp-2 transition-colors">
                                        {item.name}
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-[#9ca3af] text-[14px] text-center py-10">Hiện chưa có sản phẩm.</div>
                )}
            </div>
        )
    }

    if (data.layout === 'COMPLEX_LIST') {
        return (
            <div className="flex flex-col p-8">
                {data.brands && data.brands.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[13px] font-semibold text-[#6b7280] uppercase tracking-wider">Thương hiệu</h3>
                            <Link href={`/${cat.slug}`} className="text-[13px] font-medium text-[#15803d] hover:text-[#166534] flex items-center gap-1 transition-colors">
                                Xem tất cả <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                        <div className="grid grid-cols-4 xl:grid-cols-5 gap-2.5">
                            {data.brands.map((brand: any) => (
                                <Link href={`/${cat.slug}?brand=${brand.slug}`} key={brand.id} className="h-[52px] px-2 rounded-[10px] bg-white border border-[#e5e7eb] hover:border-[#d1fae5] hover:bg-[#f0fdf4] flex items-center justify-center transition-all duration-200 group/brand">
                                    {brand.logo_url ? (
                                        <div className="w-full h-[28px] grayscale-[0.6] opacity-75 group-hover/brand:grayscale-0 group-hover/brand:opacity-100 transition-all duration-300">
                                            <img src={brand.logo_url} alt={brand.name} loading="lazy" className="w-full h-full object-contain" />
                                        </div>
                                    ) : (
                                        <span className="text-[12px] font-semibold text-[#4b5563] text-center break-words group-hover/brand:text-[#15803d] transition-colors">{brand.name}</span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-8">
                    {data.types?.map((type: any) => (
                        <div key={type.id} className="flex flex-col gap-3">
                            <Link href={`/${cat.slug}?type=${type.slug}`} className="text-[14px] font-semibold text-[#111827] hover:text-[#15803d] transition-colors pb-2 border-b border-[#f3f4f6]">
                                {type.name}
                            </Link>
                            <div className="flex flex-col gap-2">
                                {(type.tbvs_subtypes || type.bep_subtypes || type.nuoc_subtypes)?.map((sub: any) => (
                                    <Link href={`/${cat.slug}?type=${type.slug}&subtype=${sub.slug}`} key={sub.id} className="text-[13px] font-medium text-[#6b7280] hover:text-[#15803d] transition-colors leading-relaxed">
                                        {sub.name}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return null;
}

// ── SIDEBAR MENU (Trang chủ) ──
export function MegaMenuSidebar({ categories, menuData }: MegaMenuProps) {
    if (!categories || categories.length === 0) return null;

    return (
        <NavigationMenu.Root orientation="vertical" delayDuration={150} className="relative z-[40] flex w-full max-w-[302px]">
            <div className="w-[302px] shrink-0 bg-[#bbf7d0] border border-[#22c55e]/50 rounded-[24px] shadow-[0_4px_12px_rgba(16,24,40,0.06)] flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3">
                    <p className="text-[13px] font-semibold leading-[20px] text-[#14532d] uppercase tracking-wide">
                        Danh mục sản phẩm
                    </p>
                </div>

                <NavigationMenu.List className="bg-white rounded-[16px] flex flex-col m-0 p-0 overflow-hidden">
                    {categories.map((cat, index) => {
                        const data = menuData ? menuData[cat.slug] : undefined;
                        const isFirst = index === 0;
                        const isLast = index === categories.length - 1;
                        const rounding = `${isFirst ? "rounded-t-[16px]" : ""} ${isLast ? "rounded-b-[16px]" : ""}`

                        return (
                            <NavigationMenu.Item key={cat.id} className="w-full">
                                <NavigationMenu.Trigger className={`group/item flex w-full items-center justify-between px-5 h-[58px] text-[14px] font-medium text-[#374151] hover:bg-[#f0fdf4] hover:text-[#15803d] data-[state=open]:bg-[#f0fdf4] data-[state=open]:text-[#15803d] transition-colors duration-200 ${rounding} ${!isLast ? "border-b border-[#f3f4f6]" : ""}`}>
                                    <Link href={`/${cat.slug}`} className="w-full text-left outline-none py-1 block" onClick={(e) => e.stopPropagation()}>
                                        {cat.name}
                                    </Link>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-[#d1d5db] group-hover/item:text-[#15803d] group-data-[state=open]/item:translate-x-0.5 transition-all duration-200" />
                                </NavigationMenu.Trigger>

                                {/* Responsive width: adapts to viewport to prevent horizontal scrollbar */}
                                <NavigationMenu.Content className="w-[calc(100vw-340px)] lg:w-[580px] xl:w-[760px] 2xl:w-[850px] min-h-[400px] max-h-[80vh] overflow-y-auto overflow-x-hidden bg-white">
                                    {renderMegaMenuContent(cat, data)}
                                </NavigationMenu.Content>
                            </NavigationMenu.Item>
                        )
                    })}
                </NavigationMenu.List>
            </div>

            {/* Viewport - positioned to avoid stretching the page width */}
            <div className="absolute top-0 left-[302px] pl-3 pointer-events-none z-[40]">
                <NavigationMenu.Viewport className="pointer-events-auto relative overflow-hidden rounded-[20px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-[#e5e7eb] origin-top-left data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 w-[var(--radix-navigation-menu-viewport-width)] h-[var(--radix-navigation-menu-viewport-height)] transition-[height] ease-out" />
            </div>
        </NavigationMenu.Root>
    )
}

// ── MEGA MENU HEADER (Unified Dropdown Panel) ──
export function MegaMenuHeader({ categories, menuData }: MegaMenuProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeCat, setActiveCat] = React.useState<Category | null>(null);
    const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentCat = activeCat || (categories?.[0] ?? null);

    if (!categories || categories.length === 0) return null;

    const data = menuData && currentCat ? menuData[currentCat.slug] : undefined;

    const handleMouseEnter = () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
    };

    return (
        <div className="flex items-center h-full" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            {/* Button — same style as other nav links */}
            <button className="flex items-center gap-1 text-[15px] font-medium text-[#374151] hover:text-[#15803d] focus:outline-none transition-colors">
                Sản phẩm
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown panel — absolute relative to nav, 12px gap */}
            <div
                className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${isOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible translate-y-2 pointer-events-none'
                    }`}
            >
                {/* Transparent bridge covering the 12px gap — keeps hover alive */}
                <div className="absolute -top-3 left-0 right-0 h-3" />

                {/* Caret */}
                <div className="absolute top-[3px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-[#e5e7eb] rotate-45 z-10" />

                <div className="w-[820px] xl:w-[960px] bg-white rounded-[20px] shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-[#e5e7eb] flex overflow-hidden relative z-20 mt-1">

                    {/* Left: Category list */}
                    <div className="w-[220px] shrink-0 bg-[#fafafa] border-r border-[#f3f4f6] py-3 px-3 flex flex-col gap-1">
                        {categories.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/${cat.slug}`}
                                onMouseEnter={() => setActiveCat(cat)}
                                className={`flex items-center justify-between px-4 py-3 rounded-[10px] transition-colors duration-150 group/cat text-[14px] font-medium ${currentCat?.slug === cat.slug
                                        ? 'bg-[#f0fdf4] text-[#15803d]'
                                        : 'text-[#374151] hover:bg-[#f0fdf4] hover:text-[#15803d]'
                                    }`}
                            >
                                <span>{cat.name}</span>
                                <ChevronRight className={`h-3.5 w-3.5 transition-opacity duration-150 ${currentCat?.slug === cat.slug ? 'text-[#15803d] opacity-100' : 'opacity-0 group-hover/cat:opacity-30'
                                    }`} />
                            </Link>
                        ))}
                    </div>

                    {/* Right: Content panel */}
                    <div className="flex-1 min-h-[380px] max-h-[70vh] overflow-y-auto overflow-x-hidden">
                        {currentCat && renderMegaMenuContent(currentCat, data)}
                    </div>
                </div>
            </div>
        </div>
    )
}
