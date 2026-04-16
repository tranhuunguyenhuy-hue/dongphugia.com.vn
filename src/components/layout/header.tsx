"use client"

import Link from "next/link"
import Image from "next/image"
import { Phone, Menu, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { getMegaMenuData } from '@/app/actions/mega-menu-actions'
import type { Category, MenuData } from '@/components/home/mega-menu'
import { MegaMenuHeader } from '@/components/home/mega-menu'

const PRODUCT_CATEGORIES = [
    { label: "Thiết bị vệ sinh", href: "/thiet-bi-ve-sinh", active: true },
    { label: "Thiết bị bếp", href: "/thiet-bi-bep", active: true },
    { label: "Gạch ốp lát", href: "/gach-op-lat", active: true },
    { label: "Vật liệu nước", href: "/vat-lieu-nuoc", active: true },
]

const NAV_LINKS = [
    { label: "Về chúng tôi", href: "/ve-chung-toi" },
    { label: "Đối tác", href: "/doi-tac" },
    { label: "Dự án", href: "/du-an" },
    { label: "Tin tức", href: "/tin-tuc" },
]

function ProductsDropdown() {
    const [data, setData] = useState<{ categories: Category[], menuData: Record<string, MenuData> } | null>(null)

    useEffect(() => {
        getMegaMenuData().then(setData).catch(console.error)
    }, [])

    if (!data) return (
        <button className="flex items-center gap-1 font-medium text-[15px] leading-[18px] text-[#192125] hover:text-[#2E7A96] focus:outline-none py-3">
            Sản phẩm
            <ChevronDown className="h-4 w-4 transition-transform duration-300" />
        </button>
    );

    return <MegaMenuHeader categories={data.categories} menuData={data.menuData} />
}

const TOPBAR_TEXT = "Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất. • Liên hệ: 0263 3520 316 • "

export function Header() {
    return (
        <header className="fixed w-full z-50 top-0 left-0 right-0">
            {/* Topbar — kept as-is */}
            <div className="bg-[#2E7A96] py-3 w-full relative z-10">
                {/* Desktop: centered static */}
                <div className="hidden sm:flex max-w-[1280px] mx-auto px-5 justify-center items-center gap-1">
                    <p className="text-[14px] font-medium leading-[16px] text-[#8DCDE6]">
                        Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất.
                    </p>
                    <div className="flex items-center gap-1 pl-1">
                        <span className="text-[14px] font-medium leading-[16px] text-white">Liên hệ:</span>
                        <a
                            href="tel:02633520316"
                            className="text-[14px] font-medium leading-[16px] text-white underline underline-offset-2 hover:text-[#C5E8F5] transition-colors"
                        >
                            0263 3520 316
                        </a>
                    </div>
                </div>

                {/* Mobile: marquee scrolling text */}
                <div className="sm:hidden overflow-hidden whitespace-nowrap">
                    <div className="inline-flex animate-marquee">
                        <span className="text-[14px] font-medium leading-[16px] text-[#8DCDE6] pr-16">{TOPBAR_TEXT}</span>
                        <span className="text-[14px] font-medium leading-[16px] text-[#8DCDE6] pr-16">{TOPBAR_TEXT}</span>
                        <span className="text-[14px] font-medium leading-[16px] text-[#8DCDE6] pr-16">{TOPBAR_TEXT}</span>
                        <span className="text-[14px] font-medium leading-[16px] text-[#8DCDE6] pr-16">{TOPBAR_TEXT}</span>
                    </div>
                </div>
            </div>

            {/* Clean Navigation Bar — flat white, no glassmorphism */}
            <div className="relative z-10 w-full bg-white border-b border-neutral-200">
                <div className="max-w-[1280px] mx-auto px-5 lg:px-8">
                    <div className="h-[64px] lg:h-[72px] flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center shrink-0 gap-[13px]" aria-label="Đông Phú Gia - Trang chủ">
                            <Image
                                src="/images/logo-icon.svg"
                                alt=""
                                width={19}
                                height={28}
                                priority
                                className="h-7 lg:h-8 w-auto"
                            />
                            <div className="flex flex-col gap-[2px]">
                                <Image
                                    src="/images/logo-text.svg"
                                    alt="ĐÔNG PHÚ GIA"
                                    width={146}
                                    height={19}
                                    priority
                                    className="h-[17px] lg:h-[19px] w-auto"
                                />
                                <Image
                                    src="/images/logo-tagline.svg"
                                    alt="Đồng hành - Phát triển"
                                    width={59}
                                    height={7}
                                    className="h-[6px] lg:h-[7px] w-auto"
                                />
                            </div>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex relative items-center gap-8" aria-label="Menu chính">
                            <ProductsDropdown />

                            {NAV_LINKS.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="text-[15px] font-medium text-neutral-700 hover:text-[#2E7A96] transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* CTA Button — squared, no float shadow */}
                        <div className="hidden lg:flex items-center">
                            <Button asChild variant="cta" className="px-6 h-11 text-[14px] gap-2">
                                <a href="tel:02633520316" aria-label="Gọi điện tư vấn: 0263 3520 316">
                                    <Phone className="h-4 w-4" aria-hidden="true" />
                                    Liên hệ tư vấn
                                </a>
                            </Button>
                        </div>

                        {/* Mobile Menu */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu điều hướng">
                                    <Menu className="h-6 w-6 text-neutral-900" aria-hidden="true" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] p-0 border-r border-neutral-200">
                                <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                                <div className="flex flex-col h-full bg-white">
                                    {/* Mobile header */}
                                    <div className="flex items-center px-6 h-[72px] border-b border-neutral-200">
                                        <div className="flex items-center gap-[10px]">
                                            <Image
                                                src="/images/logo-icon.svg"
                                                alt=""
                                                width={19}
                                                height={28}
                                                className="h-7 w-auto"
                                            />
                                            <div className="flex flex-col gap-[2px]">
                                                <Image
                                                    src="/images/logo-text.svg"
                                                    alt="ĐÔNG PHÚ GIA"
                                                    width={146}
                                                    height={19}
                                                    className="h-[17px] w-auto"
                                                />
                                                <Image
                                                    src="/images/logo-tagline.svg"
                                                    alt="Đồng hành - Phát triển"
                                                    width={59}
                                                    height={7}
                                                    className="h-[6px] w-auto"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mobile nav */}
                                    <nav className="flex-1 overflow-y-auto py-6">
                                        {/* Sản phẩm section */}
                                        <div className="px-6 pb-4">
                                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.15em] mb-3">
                                                Sản phẩm
                                            </p>
                                            {PRODUCT_CATEGORIES.map((cat) =>
                                                cat.active ? (
                                                    <Link
                                                        key={cat.href}
                                                        href={cat.href}
                                                        className="flex items-center justify-between py-3 text-[15px] font-medium text-neutral-900 hover:text-[#2E7A96] transition-colors"
                                                    >
                                                        {cat.label}
                                                        <ChevronRight className="h-4 w-4 text-neutral-400" />
                                                    </Link>
                                                ) : (
                                                    <div
                                                        key={cat.href}
                                                        className="flex items-center justify-between py-3 text-[15px] font-medium text-neutral-300 cursor-not-allowed"
                                                        title="Sắp có"
                                                    >
                                                        {cat.label}
                                                        <span className="text-[10px] font-bold bg-neutral-100 text-neutral-400 px-2 py-0.5 rounded">
                                                            Sắp có
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <div className="h-px bg-neutral-200 mx-6 my-2" />

                                        {/* Other nav links */}
                                        <div className="px-6 py-4">
                                            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.15em] mb-3">
                                                Menu chính
                                            </p>
                                            {NAV_LINKS.map((link) => (
                                                <Link
                                                    key={link.href}
                                                    href={link.href}
                                                    className="block py-3 text-[15px] font-medium text-neutral-900 hover:text-[#2E7A96] transition-colors"
                                                >
                                                    {link.label}
                                                </Link>
                                            ))}
                                        </div>
                                    </nav>

                                    {/* Mobile CTA */}
                                    <div className="p-6 border-t border-neutral-200">
                                        <Button asChild variant="cta" className="w-full h-12 gap-2">
                                            <a href="tel:02633520316" className="flex items-center justify-center w-full">
                                                <Phone className="h-4 w-4" />
                                                Gọi tư vấn: 0263 3520 316
                                            </a>
                                        </Button>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    )
}
