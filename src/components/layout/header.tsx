"use client"

import Link from "next/link"
import Image from "next/image"
import { Phone, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect, useId } from "react"
import { getMegaMenuData } from '@/app/actions/mega-menu-actions'
import type { Category, MenuData } from '@/components/home/mega-menu'
import { MegaMenuHeader } from '@/components/home/mega-menu'
import { CartIcon } from '@/components/cart/cart-icon'
import { CartDrawer } from '@/components/cart/cart-drawer'
import { SearchBar } from '@/components/home/search-bar'
import { MobileMenuSheet } from '@/components/layout/mobile-menu-sheet'
import { trackGenerateLead } from '@/lib/tracking'

import { NAV_MAIN_LINKS as NAV_LINKS, NAV_ABOUT_LINKS as ABOUT_LINKS } from "@/config/site"

function ProductsDropdown() {
    const [data, setData] = useState<{ categories: Category[], menuData: Record<string, MenuData> } | null>(null)

    useEffect(() => {
        getMegaMenuData().then(setData).catch(console.error)
    }, [])

    if (!data) return (
        <button
            className="flex items-center gap-1.5 font-medium text-[15px] leading-[20px] text-stone-700 focus:outline-none px-4 py-2 bg-transparent transition-all duration-300 rounded-full h-[38px]"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-label="Đang tải menu sản phẩm"
            disabled
        >
            Sản phẩm
            <ChevronDown className="h-4 w-4 transition-transform duration-300" />
        </button>
    );

    return <MegaMenuHeader categories={data.categories} menuData={data.menuData} />
}

function AboutDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const menuId = useId()
    return (
        <div
            className="relative h-full flex items-center"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    setIsOpen(false)
                    ;(event.currentTarget.querySelector('button') as HTMLButtonElement | null)?.focus()
                }
            }}
        >
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                aria-expanded={isOpen}
                aria-controls={menuId}
                aria-haspopup="menu"
                className={`flex items-center gap-1.5 font-medium text-[15px] leading-[20px] focus:outline-none px-4 py-2 transition-all duration-300 rounded-full h-[38px] ${isOpen ? 'bg-brand-50 text-brand-600' : 'bg-transparent text-stone-700 hover:bg-brand-50 hover:text-brand-600'}`}
            >
                Về chúng tôi
                <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div
                id={menuId}
                role="menu"
                aria-hidden={!isOpen}
                inert={!isOpen}
                className={`absolute top-[calc(50%+24px)] left-1/2 -translate-x-1/2 w-[220px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)] rounded-[16px] border border-stone-100 py-2 transition-all duration-300 z-50 origin-top ${isOpen ? 'opacity-100 visible translate-y-0 scale-100' : 'opacity-0 invisible translate-y-2 scale-95 pointer-events-none'}`}
            >
                {ABOUT_LINKS.map(link => (
                    <Link key={link.href} href={link.href} role="menuitem" onClick={() => setIsOpen(false)} className="block px-4 py-2.5 text-[15px] font-medium text-stone-700 hover:bg-stone-50 hover:text-brand-600 transition-colors">
                        {link.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}

export function Header() {
    const [isScrolled, setIsScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <>
            <header className="fixed w-full z-50 top-0 left-0 right-0 transition-all duration-300">
                {/* Navigation Bar */}
                <div className={`relative z-10 w-full transition-colors duration-300 ${isScrolled ? 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]' : 'bg-white border-b border-stone-200'}`}>
                    <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
                        <div className="h-[72px] lg:h-[88px] flex items-center justify-between transition-all duration-300 w-full">
                            {/* Logo */}
                            <Link href="/" className="flex items-center shrink-0" aria-label="Đông Phú Gia - Trang chủ">
                                <Image src="/images/Logo.png" alt="Đông Phú Gia" width={245} height={48} priority className="h-auto w-[204px] object-contain lg:w-[245px]" />
                            </Link>

                            {/* Desktop Nav */}
                            <nav className="hidden lg:flex items-center gap-1 h-full" aria-label="Menu chính">
                                <ProductsDropdown />
                                <AboutDropdown />
                                {NAV_LINKS.map((link) => (
                                    <Link key={link.href} href={link.href} className="px-4 py-2 rounded-full font-medium text-[15px] leading-[20px] text-stone-700 hover:text-brand-600 hover:bg-brand-50 transition-all duration-300 h-[38px] flex items-center bg-transparent">
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>

                            {/* Desktop: Search + Cart + CTA */}
                            <div className="hidden lg:flex items-center gap-4">
                                <SearchBar />
                                <div className="h-6 w-px bg-stone-200 ml-1"></div>
                                <CartIcon />
                                <Button asChild className="px-6 h-11 text-[15px] font-medium gap-2 bg-brand-700 hover:bg-brand-800 text-white rounded-full shadow-sm ml-2">
                                    <Link href="/lien-he" aria-label="Liên hệ" onClick={() => trackGenerateLead('navbar_contact')}>
                                        Liên hệ
                                        <Phone className="h-[18px] w-[18px]" aria-hidden="true" />
                                    </Link>
                                </Button>
                            </div>

                            {/* Mobile: Search + Cart + Menu */}
                            <div className="flex lg:hidden items-center gap-0.5">
                                <SearchBar />
                                <CartIcon />
                                <MobileMenuSheet />
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <CartDrawer />
        </>
    )
}
