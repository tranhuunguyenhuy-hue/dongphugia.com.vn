'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Phone, ChevronDown, ChevronRight, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { getMegaMenuData } from '@/app/actions/mega-menu-actions'
import type { Category, MenuData } from '@/components/home/mega-menu'
import {
    NAV_PRODUCT_CATEGORIES as PRODUCT_CATEGORIES,
    NAV_MAIN_LINKS as NAV_LINKS,
    NAV_ABOUT_LINKS as ABOUT_LINKS,
} from '@/config/site'

// ── Accordion item for a single product category ──
function CategoryAccordionItem({
    category,
    data,
    onNavigate,
}: {
    category: (typeof PRODUCT_CATEGORIES)[0]
    data: MenuData | undefined
    onNavigate: () => void
}) {
    const [isOpen, setIsOpen] = useState(false)
    const subs = data?.subcategories ?? []
    const hasSubs = subs.length > 0

    return (
        <div className="border-b border-stone-100 last:border-b-0">
            <div className="flex items-center">
                {/* Category name → navigates to category page */}
                <Link
                    href={category.href}
                    onClick={onNavigate}
                    className="flex-1 py-3.5 text-[15px] font-medium text-stone-900 active:text-brand-600 transition-colors"
                >
                    {category.label}
                </Link>

                {/* Expand/collapse chevron */}
                {hasSubs ? (
                    <button
                        type="button"
                        onClick={() => setIsOpen(v => !v)}
                        className="w-10 h-10 -mr-2 flex items-center justify-center text-stone-400 active:text-brand-600 transition-colors"
                        aria-label={isOpen ? 'Thu gọn' : 'Mở rộng'}
                    >
                        <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                        />
                    </button>
                ) : (
                    <ChevronRight className="h-4 w-4 text-stone-300 mr-1" />
                )}
            </div>

            {/* Subcategories accordion body */}
            {hasSubs && (
                <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="pl-4 pb-3 flex flex-col">
                            {subs.map(sub => (
                                <Link
                                    key={sub.id}
                                    href={`${category.href}/${sub.slug}`}
                                    onClick={onNavigate}
                                    className="py-2 text-[13.5px] text-stone-600 active:text-brand-600 transition-colors"
                                >
                                    {sub.name}
                                </Link>
                            ))}
                            {/* "View all" link */}
                            <Link
                                href={category.href}
                                onClick={onNavigate}
                                className="py-2 text-[12px] font-semibold text-brand-600 active:text-brand-700 transition-colors flex items-center gap-1 mt-1"
                            >
                                Xem tất cả
                                <ChevronRight className="h-3 w-3" />
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main MobileMenuSheet component ──
export function MobileMenuSheet() {
    const [open, setOpen] = useState(false)
    const [menuData, setMenuData] = useState<{
        categories: Category[]
        menuData: Record<string, MenuData>
    } | null>(null)

    // Fetch mega-menu data when sheet first opens (lazy load)
    useEffect(() => {
        if (open && !menuData) {
            getMegaMenuData().then(setMenuData).catch(console.error)
        }
    }, [open, menuData])

    // Close sheet on navigation
    const handleNavigate = useCallback(() => {
        setOpen(false)
    }, [])

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mở menu điều hướng">
                    <Menu className="h-6 w-6 text-stone-900" aria-hidden="true" />
                </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-[300px] sm:w-[340px] p-0 border-r border-border">
                <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>

                <div className="flex flex-col h-full bg-background">
                    {/* ── Logo header ── */}
                    <div className="flex items-center px-6 h-[64px] border-b border-border shrink-0">
                        <Link href="/" onClick={handleNavigate} className="flex items-center">
                            <Image
                                src="/images/logo-dpg.png"
                                alt="Đông Phú Gia"
                                width={184}
                                height={36}
                                className="h-8 w-auto object-contain"
                            />
                        </Link>
                    </div>

                    {/* ── Scrollable navigation ── */}
                    <nav className="flex-1 overflow-y-auto overscroll-contain" aria-label="Menu di động">
                        {/* Product categories with accordion */}
                        <div className="px-6 pt-5 pb-3">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.16em] mb-1">
                                Sản phẩm
                            </p>
                            {PRODUCT_CATEGORIES.map(cat => {
                                if (!cat.active) {
                                    return (
                                        <div
                                            key={cat.href}
                                            className="flex items-center justify-between py-3.5 text-[15px] font-medium text-stone-300 cursor-not-allowed border-b border-stone-100 last:border-b-0"
                                        >
                                            {cat.label}
                                            <span className="text-[10px] font-bold bg-stone-100 text-stone-400 px-2 py-0.5 rounded">
                                                Sắp có
                                            </span>
                                        </div>
                                    )
                                }

                                const slug = cat.href.replace('/', '')
                                const data = menuData?.menuData?.[slug]

                                return (
                                    <CategoryAccordionItem
                                        key={cat.href}
                                        category={cat}
                                        data={data}
                                        onNavigate={handleNavigate}
                                    />
                                )
                            })}
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-stone-200 mx-6" />

                        {/* Menu links */}
                        <div className="px-6 pt-4 pb-6">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.16em] mb-1">
                                Menu
                            </p>
                            {[...ABOUT_LINKS, ...NAV_LINKS].map(link => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={handleNavigate}
                                    className="block py-3 text-[15px] font-medium text-stone-900 active:text-brand-600 transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </nav>

                    {/* ── Footer CTA ── */}
                    <div className="p-5 border-t border-border shrink-0">
                        <Button asChild variant="default" className="w-full h-12 gap-2 rounded-xl">
                            <Link
                                href="/lien-he"
                                onClick={handleNavigate}
                                className="flex items-center justify-center w-full"
                            >
                                <Phone className="h-4 w-4" />
                                Liên hệ tư vấn
                            </Link>
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
