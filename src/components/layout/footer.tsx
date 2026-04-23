"use client";

import Link from "next/link";
import Image from "next/image";
import { siteConfig, NAV_PRODUCT_CATEGORIES, NAV_FOOTER_ABOUT_LINKS, NAV_FOOTER_LEGAL_LINKS } from "@/config/site";

export function Footer() {
    return (
        <footer className="w-full bg-stone-50 border-t border-border">
            <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-16">
                    {/* Left Column: Logo & Newsletter */}
                    <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-8">
                        <Link href="/" className="inline-flex items-center" aria-label="Đông Phú Gia - Trang chủ">
                            <Image
                                src="/images/logo-dpg.png"
                                alt="Đông Phú Gia - Đồng hành, Phát triển"
                                width={184}
                                height={36}
                                className="h-8 lg:h-9 w-auto object-contain"
                            />
                        </Link>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-brand-500" />
                                <h3 className="text-stone-900 font-medium text-[15px]">
                                    Đăng ký nhận bản tin ưu đãi
                                </h3>
                            </div>
                            <form className="flex items-stretch max-w-[360px] gap-0 shadow-sm rounded-[8px] overflow-hidden" onSubmit={(e) => e.preventDefault()}>
                                <input
                                    type="email"
                                    placeholder="Nhập email của bạn"
                                    className="flex-1 h-11 px-4 border border-stone-200 border-r-0 bg-white text-[15px] leading-[24px] text-stone-900 placeholder:text-stone-400 focus:outline-none transition-all"
                                />
                                <button
                                    type="submit"
                                    className="h-11 px-6 bg-brand-500 hover:bg-brand-600 text-white font-medium text-[15px] transition-colors flex items-center justify-center tracking-wide"
                                >
                                    Đăng ký
                                </button>
                            </form>
                            <p className="text-stone-500 text-[13px] leading-relaxed max-w-[360px]">
                                Bằng việc đăng ký, bạn đồng ý với Chính sách Bảo mật của chúng tôi và nhận thông tin cập nhật từ Đông Phú Gia.
                            </p>
                        </div>
                    </div>

                    {/* Right Columns: Links */}
                    <div className="w-full flex flex-col md:flex-row gap-8 lg:gap-16 pt-2 lg:pt-0 justify-between">
                        {/* Col 1 */}
                        <div className="flex flex-col gap-5 md:w-1/3">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-brand-500" />
                                <h4 className="text-stone-900 font-medium text-[13px] tracking-[0.15em] uppercase">Sản phẩm chính</h4>
                            </div>
                            <ul className="flex flex-col gap-3">
                                {NAV_PRODUCT_CATEGORIES.map(link => (
                                    <li key={link.href}><Link href={link.href} className="text-stone-600 text-body-sm hover:text-brand-600 transition-colors">{link.label}</Link></li>
                                ))}
                            </ul>
                        </div>

                        {/* Col 2 */}
                        <div className="flex flex-col gap-5 md:w-1/3">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-brand-500" />
                                <h4 className="text-stone-900 font-medium text-[13px] tracking-[0.15em] uppercase">Về chúng tôi</h4>
                            </div>
                            <ul className="flex flex-col gap-3">
                                {NAV_FOOTER_ABOUT_LINKS.map(link => (
                                    <li key={link.href}><Link href={link.href} className="text-stone-600 text-body-sm hover:text-brand-600 transition-colors">{link.label}</Link></li>
                                ))}
                            </ul>
                        </div>

                        {/* Col 3 */}
                        <div className="flex flex-col gap-5 md:w-1/3">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-brand-500" />
                                <h4 className="text-stone-900 font-medium text-[13px] tracking-[0.15em] uppercase">Liên hệ</h4>
                            </div>
                            <ul className="flex flex-col gap-3">
                                <li className="text-stone-600 text-body-sm leading-[22px]">
                                    Showroom: {siteConfig.contact.address}
                                    <br />{siteConfig.contact.addressLine2}
                                </li>
                                <li>
                                    <a href={`tel:${siteConfig.contact.phone}`} className="text-stone-600 text-body-sm font-medium hover:text-brand-600 transition-colors">
                                        {siteConfig.contact.phoneLabel} <span className="font-normal text-[13px]">(CSKH / Sale)</span>
                                    </a>
                                </li>
                                <li><a href={`mailto:${siteConfig.contact.email}`} className="text-stone-600 text-body-sm hover:text-brand-600 transition-colors">{siteConfig.contact.email}</a></li>
                                <li><a href={siteConfig.url} target="_blank" rel="noopener noreferrer" className="text-stone-600 text-body-sm hover:text-brand-600 transition-colors">{siteConfig.url.replace('https://', '')}</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-center lg:justify-between items-center gap-4">
                    <p className="text-stone-500 text-[13px] text-center lg:text-left">
                        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        {NAV_FOOTER_LEGAL_LINKS.map(link => (
                            <Link key={link.href} href={link.href} className="text-stone-500 text-[13px] hover:text-brand-600 transition-colors">{link.label}</Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
