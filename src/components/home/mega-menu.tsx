'use client';

import * as React from "react"
import Link from "next/link"
import * as NavigationMenu from '@radix-ui/react-navigation-menu'
import { ChevronRight, ChevronDown, Bath, Flame, Grid2X2, Droplet, Layers } from "lucide-react"

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

const CATEGORY_INFO: Record<string, { icon: any, desc: string }> = {
    'thiet-bi-ve-sinh': { icon: Bath, desc: 'Bồn cầu, lavabo, bồn tắm, sen vòi...' },
    'thiet-bi-bep': { icon: Flame, desc: 'Bếp từ, hút mùi, chậu rửa, lò vi sóng...' },
    'gach-op-lat': { icon: Grid2X2, desc: 'Gạch lát nền, ốp tường, gạch trang trí...' },
    'vat-lieu-nuoc': { icon: Droplet, desc: 'Ống nước, van vòi, phụ kiện ngành nước...' },
    'san-go': { icon: Layers, desc: 'Sàn gỗ tự nhiên, công nghiệp, sàn nhựa...' },
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
                <div className="mb-6 border-b border-white/30 pb-5">
                    <h3 className="text-[11px] font-bold text-[#3C4E56]/60 uppercase tracking-wider mb-3">Thương hiệu nổi bật</h3>
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
                                    <span style={{ display: 'none' }} className="text-[11.5px] font-semibold text-[#3C4E56]/70 text-center break-words group-hover/brand:text-[#2E7A96] transition-colors line-clamp-2">
                                        {brand.name}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Types and Subtypes (Custom JS Masonry) */}
            {data.types && data.types.length > 0 ? (() => {
                const colCount = 3;
                const cols: any[][] = Array.from({ length: colCount }, () => []);
                const colHeights = new Array(colCount).fill(0);
                
                data.types.forEach((type: any) => {
                    const subtypes = type.tbvs_subtypes || type.bep_subtypes || type.nuoc_subtypes || [];
                    const heightCost = 30 + (Math.min(subtypes.length, 7) * 20);
                    
                    let minIdx = 0;
                    let minH = colHeights[0];
                    for (let i = 1; i < colCount; i++) {
                        if (colHeights[i] < minH) {
                            minH = colHeights[i];
                            minIdx = i;
                        }
                    }
                    
                    cols[minIdx].push(type);
                    colHeights[minIdx] += heightCost + 24;
                });

                return (
                    <div className="grid grid-cols-3 gap-x-8">
                        {cols.map((colTypes, i) => (
                            <div key={i} className="flex flex-col gap-6">
                                {colTypes.map((type: any) => {
                                    const subtypes = type.tbvs_subtypes || type.bep_subtypes || type.nuoc_subtypes || [];
                                    return (
                                        <div key={type.id} className="flex flex-col gap-2.5">
                                            <Link href={`/${cat.slug}?type=${type.slug}`} className="text-[11px] font-bold text-[#3C4E56]/60 uppercase tracking-wider hover:text-[#2E7A96] transition-colors">
                                                {type.name}
                                            </Link>
                                            <div className="flex flex-col gap-1.5">
                                                {subtypes.slice(0, 7).map((sub: any) => (
                                                    <Link href={`/${cat.slug}?type=${type.slug}&subtype=${sub.slug}`} key={sub.id} className="text-[13.5px] leading-[1.3] font-medium text-[#192125] hover:text-[#2E7A96] transition-colors relative group/link inline-block w-full">
                                                        <span className="block truncate w-full pr-4">{sub.name}</span>
                                                        <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-[#2E7A96]/30 transition-all duration-300 group-hover/link:w-full"></span>
                                                    </Link>
                                                ))}
                                                {subtypes.length > 7 && (
                                                    <Link href={`/${cat.slug}?type=${type.slug}`} className="text-[12.5px] italic text-[#2E7A96] hover:text-[#1A5C73] transition-colors mt-0.5">
                                                        Xem thêm {subtypes.length - 7} loại...
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                );
            })() : data.layout === 'IMAGE_CARDS' && data.items && data.items.length > 0 ? (
                // Filter out non-category items - Display as categories without showing exact products
                <div>
                    <h3 className="text-[11px] font-bold text-[#3C4E56]/60 uppercase tracking-wider mb-4">Phân loại {cat.name.toLowerCase()}</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                        {data.items.slice(0, 16).map((item) => {
                            const filterKey = cat.slug === 'san-go' ? 'type' : 'pattern';
                            return (
                                <Link href={`/${cat.slug}?${filterKey}=${item.slug}`} key={item.id} className="text-[14px] font-medium text-[#192125] hover:text-[#2E7A96] transition-colors py-1 flex items-center justify-between group">
                                    <span className="truncate pr-4 relative inline-block">
                                        {item.name}
                                        <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-[#2E7A96]/30 transition-all duration-300 group-hover:w-full"></span>
                                    </span>
                                    <ChevronRight className="h-3.5 w-3.5 text-[#2E7A96]/50 opacity-0 group-hover:opacity-100 -translate-x-3 group-hover:translate-x-0 transition-all duration-300" />
                                </Link>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-gray-400 text-sm">Chưa có thông tin danh mục</div>
            )}
            
            <Link href={`/${cat.slug}`} className="text-[13px] font-medium text-blue-600 hover:text-blue-700 mt-8 flex items-center gap-1 group w-max">
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
            <div className="w-[302px] shrink-0 bg-[#C5E8F5] border border-[#44A0BA]/50 rounded-[24px] shadow-[0_4px_12px_rgba(16,24,40,0.06)] flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3">
                    <p className="text-[13px] font-semibold leading-[20px] text-[#0F2E3A] uppercase tracking-wide">
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
                                <NavigationMenu.Trigger className={`group/item flex w-full items-center justify-between px-5 h-[58px] text-[14px] font-medium text-[#3C4E56] hover:bg-[#EAF6FB] hover:text-[#2E7A96] data-[state=open]:bg-[#EAF6FB] data-[state=open]:text-[#2E7A96] transition-colors duration-200 ${rounding} ${!isLast ? "border-b border-[#E4EEF2]" : ""}`}>
                                    <Link href={`/${cat.slug}`} className="w-full text-left outline-none py-1 block" onClick={(e) => e.stopPropagation()}>
                                        {cat.name}
                                    </Link>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-[#C8D9E0] group-hover/item:text-[#2E7A96] group-data-[state=open]/item:translate-x-0.5 transition-all duration-200" />
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
                <NavigationMenu.Viewport className="pointer-events-auto relative overflow-hidden rounded-[20px] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-[#C8D9E0] origin-top-left data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:fade-in data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 w-[var(--radix-navigation-menu-viewport-width)] h-[var(--radix-navigation-menu-viewport-height)] transition-[height] ease-out" />
            </div>
        </NavigationMenu.Root>
    )
}

// ── MEGA MENU HEADER (Unified Dropdown Panel - ATTIO STYLE) ──
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
            <button className={`flex items-center gap-1 text-[15px] font-medium transition-colors ${isOpen ? 'text-[#2E7A96]' : 'text-[#3C4E56] hover:text-[#2E7A96]'}`}>
                Sản phẩm
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div
                className={`absolute top-full mt-3 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${isOpen ? 'opacity-100 visible translate-y-0 scale-100 origin-top' : 'opacity-0 invisible translate-y-2 scale-95 origin-top pointer-events-none'
                    }`}
            >
                <div className="absolute -top-3 left-0 right-0 h-3" />
                
                {/* Glassmorphism Mega Menu Container */}
                <div className="w-[840px] xl:w-[940px] bg-white/70 backdrop-blur-2xl rounded-[24px] shadow-[0_24px_80px_-12px_rgba(46,122,150,0.15)] border border-white/60 flex p-3 relative z-20">
                    
                    {/* Left: Category list (Glassmorphism style) */}
                    <div className="w-[320px] xl:w-[340px] shrink-0 flex flex-col gap-1 pr-3 border-r border-[#C8D9E0]/30">
                        <div className="px-3 pt-2 pb-3">
                            <h3 className="text-[11px] font-bold text-[#3C4E56]/60 uppercase tracking-wider">Danh mục</h3>
                        </div>
                        {categories.map((cat) => {
                            const info = CATEGORY_INFO[cat.slug] || { icon: Layers, desc: 'Khám phá sản phẩm của chúng tôi' };
                            const Icon = info.icon;
                            const isActive = currentCat?.slug === cat.slug;
                            
                            return (
                                <Link
                                    key={cat.id}
                                    href={`/${cat.slug}`}
                                    onMouseEnter={() => setActiveCat(cat)}
                                    className={`flex items-start gap-4 px-3 py-3 rounded-[12px] transition-all duration-300 relative group overflow-hidden ${isActive
                                            ? 'bg-white/60 shadow-sm shadow-[#2E7A96]/5 border border-white/60'
                                            : 'hover:bg-white/40 border border-transparent'
                                        }`}
                                >
                                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#44A0BA] to-[#2E7A96] rounded-r-full" />}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-[#44A0BA] to-[#2E7A96] text-white shadow-md shadow-[#2E7A96]/30 scale-105' : 'bg-white text-[#3C4E56]/60 shadow-sm border border-white/80 group-hover:text-[#2E7A96] group-hover:scale-105'}`}>
                                        <Icon className="w-[18px] h-[18px]" />
                                    </div>
                                    <div className="flex flex-col pt-0.5 z-10">
                                        <span className={`text-[15px] font-semibold transition-colors ${isActive ? 'text-[#0F2E3A]' : 'text-[#3C4E56] group-hover:text-[#2E7A96]'}`}>{cat.name}</span>
                                        <span className={`text-[13px] mt-0.5 leading-snug line-clamp-2 transition-colors ${isActive ? 'text-[#3C4E56]/80' : 'text-[#3C4E56]/50 group-hover:text-[#3C4E56]/70'}`}>{info.desc}</span>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>

                    {/* Right: Content panel */}
                    <div className="flex-1">
                        {currentCat && renderMegaMenuContent(currentCat, data)}
                    </div>
                </div>
            </div>
        </div>
    )
}
