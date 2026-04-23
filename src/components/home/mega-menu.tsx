'use client';

import * as React from "react"
import Link from "next/link"
import * as NavigationMenu from '@radix-ui/react-navigation-menu'
import { ChevronRight, ChevronDown, Bath, Flame, Grid2X2, Droplet } from "lucide-react"

export type Category = {
    id: number;
    name: string;
    slug: string;
    thumbnail_url?: string | null;
    icon_name?: string | null;
}

export type MenuData = {
    subcategories: {
        id: number;
        name: string;
        slug: string;
        thumbnail_url: string | null;
        hero_image_url: string | null;
        icon_name: string | null;
        category_id: number;
    }[];
    brands: {
        id: number;
        name: string;
        slug: string;
        logo_url: string | null;
    }[];
}

export interface MegaMenuProps {
    categories: Category[];
    menuData: Record<string, MenuData> | null;
}

const CATEGORY_INFO: Record<string, { icon: any, desc: string }> = {
    'thiet-bi-ve-sinh': { icon: Bath, desc: 'Bồn cầu, lavabo, bồn tắm, sen vòi...' },
    'thiet-bi-bep': { icon: Flame, desc: 'Bếp từ, hút mùi, chậu rửa, lò vi sóng...' },
    'gach-op-lat': { icon: Grid2X2, desc: 'Gạch lát nền, ốp tường, gạch trang trí...' },
    'vat-lieu-nuoc': { icon: Droplet, desc: 'Ống nước, van vòi, phụ kiện ngành nước...' },
}

const renderMegaMenuContent = (cat: Category, data: MenuData | undefined) => {
    if (!data) return (
        <div className="p-8 flex items-center justify-center text-[#88A3AE] h-full">
            <div className="animate-pulse">Loading...</div>
        </div>
    );

    return (
        <div className="flex flex-col p-6 pl-8 w-full max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
            {/* Brands or Highlights */}
            {data.brands && data.brands.length > 0 && (
                <div className="mb-6 border-b border-stone-200 pb-5">
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-3">Thương hiệu nổi bật</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2.5">
                        {data.brands.map((brand: any) => (
                            <Link href={`/${cat.slug}?brand=${brand.slug}`} key={brand.id} className="h-9 px-2 rounded-[8px] bg-white/40 backdrop-blur-md border border-white/60 hover:border-white/90 hover:bg-white/80 hover:shadow-[0_4px_12px_rgba(46,122,150,0.08)] flex items-center justify-center transition-all duration-300 group/brand relative">
                                <div className="w-full h-[18px] grayscale opacity-60 group-hover/brand:grayscale-0 group-hover/brand:opacity-100 transition-all duration-300 transform group-hover/brand:scale-105 flex items-center justify-center">
                                    <img 
                                        src={`/images/brands/${brand.slug}.png`} 
                                        alt={brand.name} 
                                        loading="lazy" 
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            if (target.src.endsWith('.png')) {
                                                target.src = `/images/brands/${brand.slug}.svg`;
                                            } else {
                                                target.style.display = 'none';
                                                if (target.nextElementSibling) {
                                                    (target.nextElementSibling as HTMLElement).style.display = 'inline-block';
                                                }
                                            }
                                        }}
                                    />
                                    <span style={{ display: 'none' }} className="text-[11.5px] font-semibold text-stone-600 text-center break-words group-hover/brand:text-brand-600 transition-colors line-clamp-2">
                                        {brand.name}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Subcategories (v2 unified schema) */}
            {data.subcategories && data.subcategories.length > 0 ? (
                <div>
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-4">Phân loại {cat.name.toLowerCase()}</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        {data.subcategories.slice(0, 16).map((sub) => (
                            <Link href={`/${cat.slug}?sub=${sub.slug}`} key={sub.id} className="text-[14px] font-medium text-stone-900 hover:text-brand-600 transition-colors py-1 flex items-center justify-between group">
                                <span className="truncate pr-4 relative inline-block">
                                    {sub.name}
                                    <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-brand-500/30 transition-all duration-300 group-hover:w-full"></span>
                                </span>
                                <ChevronRight className="h-3.5 w-3.5 text-brand-500/50 opacity-0 group-hover:opacity-100 -translate-x-3 group-hover:translate-x-0 transition-all duration-300" />
                            </Link>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-gray-400 text-sm">Chưa có thông tin danh mục</div>
            )}
            
            <Link href={`/${cat.slug}`} className="text-[13px] font-medium text-brand-600 hover:text-brand-700 mt-8 flex items-center gap-1 group w-max">
                Xem tất cả sản phẩm {cat.name} <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
        </div>
    )
}

// ── SIDEBAR MENU (Trang chủ) ──
export function MegaMenuSidebar({ categories, menuData }: MegaMenuProps) {
    if (!categories || categories.length === 0) return null;

    return (
        <NavigationMenu.Root orientation="vertical" delayDuration={150} className="relative z-[40] flex w-full max-w-[302px]">
            <div className="w-[302px] shrink-0 bg-stone-50 border border-stone-200 rounded-[24px] shadow-[0_4px_12px_rgba(16,24,40,0.06)] flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3">
                    <p className="text-[13px] font-semibold leading-[20px] text-stone-900 uppercase tracking-wide">
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
                                <NavigationMenu.Trigger className={`group/item flex w-full items-center justify-between px-5 h-[58px] text-[15px] font-medium text-stone-700 hover:bg-white hover:text-brand-600 data-[state=open]:bg-white data-[state=open]:text-brand-600 transition-colors duration-200 ${rounding} ${!isLast ? "border-b border-stone-200" : ""}`}>
                                    <Link href={`/${cat.slug}`} className="w-full text-left outline-none py-1 block" onClick={(e) => e.stopPropagation()}>
                                        {cat.name}
                                    </Link>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 group-hover/item:text-brand-600 group-data-[state=open]/item:translate-x-0.5 transition-all duration-200" />
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
                <NavigationMenu.Viewport className="pointer-events-auto relative overflow-hidden rounded-[20px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-stone-200 origin-top-left data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 w-[var(--radix-navigation-menu-viewport-width)] h-[var(--radix-navigation-menu-viewport-height)] transition-[height] ease-out" />
            </div>
        </NavigationMenu.Root>
    )
}

// ── MEGA MENU HEADER (Flat 4-Column Layout) ──
export function MegaMenuHeader({ categories, menuData }: MegaMenuProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Limit to 4 main categories for the 4-column grid
    const mainCategories = categories?.slice(0, 4) || [];

    if (!mainCategories.length) return null;

    const handleMouseEnter = () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
    };

    return (
        <div className="flex items-center h-full" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <button className={`flex items-center gap-1.5 font-medium transition-all duration-300 px-4 py-2 rounded-md h-[38px] focus:outline-none ${isOpen ? 'bg-brand-50 text-brand-600' : 'bg-transparent text-stone-700 hover:bg-brand-50 hover:text-brand-600'} text-[15px] leading-[20px]`}>
                Sản phẩm
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-brand-600' : 'text-stone-400'}`} />
            </button>

            <div
                className={`absolute top-full left-0 w-full z-50 transition-opacity duration-150 ease-out ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}
            >
                {/* Flat 100vw V2 Mega Menu Container */}
                <div className="w-full bg-white border-b border-stone-200 relative z-20 shadow-sm">
                    {/* Inner wrapper to match max-w-[1280px] center layout */}
                    <div className="max-w-[1280px] mx-auto px-5 lg:px-8 py-10 border-t border-stone-100">
                        <div className="grid grid-cols-4 gap-12 relative w-full">
                            {mainCategories.map((cat) => {
                                const data = menuData ? menuData[cat.slug] : undefined;
                                return (
                                    <div key={cat.id} className="flex flex-col">
                                        <Link href={`/${cat.slug}`} className="group/cathead flex items-center justify-between pb-2 mb-3 border-b border-stone-100">
                                            <h3 className="text-[13px] font-normal text-[#888] group-hover/cathead:text-brand-600 transition-colors">
                                                {cat.name}
                                            </h3>
                                            <span className="text-[11px] font-medium text-brand-600 opacity-0 group-hover/cathead:opacity-100 -translate-x-2 group-hover/cathead:translate-x-0 transition-all duration-200 flex items-center">
                                                Xem đầy đủ <ChevronRight className="w-3 h-3 ml-0.5" />
                                            </span>
                                        </Link>
                                        
                                        {data?.subcategories?.length ? (
                                            <div className="flex flex-col">
                                                {data.subcategories.slice(0, 9).map(sub => (
                                                    <Link key={sub.id} href={`/${cat.slug}?sub=${sub.slug}`} className="text-[14px] text-stone-900 hover:text-brand-600 font-normal transition-colors leading-[32px] block w-full truncate pr-4">
                                                        {sub.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-stone-400 py-1 font-light">Đang cập nhật...</span>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
