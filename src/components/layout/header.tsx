"use client"

import Link from "next/link"
import Image from "next/image"
import { Phone, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { getMegaMenuData } from '@/app/actions/mega-menu-actions'
import type { Category, MenuData } from '@/components/home/mega-menu'
import { MegaMenuHeader } from '@/components/home/mega-menu'
import { CartIcon } from '@/components/cart/cart-icon'
import { CartDrawer } from '@/components/cart/cart-drawer'
import { SearchBar } from '@/components/home/search-bar'
import { MobileMenuSheet } from '@/components/layout/mobile-menu-sheet'

import { siteConfig, NAV_PRODUCT_CATEGORIES as PRODUCT_CATEGORIES, NAV_MAIN_LINKS as NAV_LINKS, NAV_ABOUT_LINKS as ABOUT_LINKS } from "@/config/site"

function ProductsDropdown() {
    const [data, setData] = useState<{ categories: Category[], menuData: Record<string, MenuData> } | null>(null)

    useEffect(() => {
        getMegaMenuData().then(setData).catch(console.error)
    }, [])

    if (!data) return (
        <button className="flex items-center gap-1.5 font-medium text-[15px] leading-[20px] text-stone-700 hover:text-brand-600 focus:outline-none px-4 py-2 bg-transparent hover:bg-brand-50 transition-all duration-300 rounded-full h-[38px]">
            Sản phẩm
            <ChevronDown className="h-4 w-4 transition-transform duration-300" />
        </button>
    );

    return <MegaMenuHeader categories={data.categories} menuData={data.menuData} />
}

function AboutDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative h-full flex items-center" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
            <button className={`flex items-center gap-1.5 font-medium text-[15px] leading-[20px] focus:outline-none px-4 py-2 transition-all duration-300 rounded-full h-[38px] ${isOpen ? 'bg-brand-50 text-brand-600' : 'bg-transparent text-stone-700 hover:bg-brand-50 hover:text-brand-600'}`}>
                Về chúng tôi
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute top-[calc(50%+24px)] left-1/2 -translate-x-1/2 w-[220px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.08)] rounded-[16px] border border-stone-100 py-2 transition-all duration-300 z-50 origin-top ${isOpen ? 'opacity-100 visible translate-y-0 scale-100' : 'opacity-0 invisible translate-y-2 scale-95 pointer-events-none'}`}>
                {ABOUT_LINKS.map(link => (
                    <Link key={link.href} href={link.href} className="block px-4 py-2.5 text-[15px] font-medium text-stone-700 hover:bg-stone-50 hover:text-brand-600 transition-colors">
                        {link.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}

const TOPBAR_TEXT = `${siteConfig.ui.topbarText} Liên hệ: ${siteConfig.contact.phone} • `

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
            <header className={`fixed w-full z-50 top-0 left-0 right-0 transition-all duration-300 ${isScrolled ? 'shadow-md translate-y-[-48px] sm:translate-y-[-44px]' : ''}`}>
                {/* Topbar */}
                <div className="bg-brand-500 py-3 w-full relative z-10">
                    <div className="hidden sm:flex max-w-[1280px] mx-auto px-5 justify-center items-center gap-1">
                        <p className="text-body-sm text-brand-100">
                            Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất.
                        </p>
                        <div className="flex items-center gap-1 pl-1">
                            <span className="text-body-sm text-white">Liên hệ:</span>
                            <a
                                href={`tel:${siteConfig.contact.phone}`}
                                className="text-body-sm text-white underline underline-offset-2 hover:text-brand-50 transition-colors"
                            >
                                {siteConfig.contact.phone}
                            </a>
                        </div>
                    </div>
                    <div className="sm:hidden overflow-hidden whitespace-nowrap">
                        <div className="inline-flex animate-marquee">
                            <span className="text-body-sm text-brand-100 pr-16">{TOPBAR_TEXT}</span>
                            <span className="text-body-sm text-brand-100 pr-16">{TOPBAR_TEXT}</span>
                            <span className="text-body-sm text-brand-100 pr-16">{TOPBAR_TEXT}</span>
                            <span className="text-body-sm text-brand-100 pr-16">{TOPBAR_TEXT}</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Bar */}
                <div className={`relative z-10 w-full transition-colors duration-300 ${isScrolled ? 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]' : 'bg-white border-b border-stone-200'}`}>
                    <div className="max-w-[1280px] mx-auto px-5 lg:px-8">
                        <div className="h-[64px] lg:h-[88px] flex items-center justify-between transition-all duration-300 w-full">
                            {/* Logo */}
                            <Link href="/" className="flex items-center shrink-0" aria-label="Đông Phú Gia - Trang chủ">
                                <Image src="/images/logo-dpg.png" alt="Đông Phú Gia" width={184} height={36} priority className="h-8 lg:h-9 w-auto object-contain" />
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
                                <Button asChild className="px-6 h-11 text-[15px] font-medium gap-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-sm ml-2">
                                    <Link href="/lien-he" aria-label="Liên hệ">
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
