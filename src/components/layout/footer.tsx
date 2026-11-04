import Link from "next/link";
import { siteConfig, NAV_PRODUCT_CATEGORIES, NAV_FOOTER_ABOUT_LINKS, NAV_FOOTER_LEGAL_LINKS } from "@/config/site";
import { DeferredResponsiveMedia } from "@/components/media/deferred-responsive-media";

export function Footer() {
    return (
        <footer className="w-full bg-stone-50 border-t border-border">
            <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-16">
                    {/* Left Column: Logo & contact */}
                    <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-8">
                        <Link href="/" className="inline-flex items-center" aria-label="Đông Phú Gia - Trang chủ">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/Logo.png"
                                alt="Đông Phú Gia - Đồng hành, Phát triển"
                                width={184}
                                height={36}
                                loading="lazy"
                                className="h-auto w-[164px] object-contain lg:w-[184px]"
                            />
                        </Link>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-brand-500" />
                                <h3 className="text-stone-900 font-medium text-[15px]">
                                    Liên hệ tư vấn
                                </h3>
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm font-medium">
                                <a href="tel:0949349949" className="rounded-lg bg-brand-700 px-5 py-3 text-white hover:bg-brand-800">Gọi tư vấn</a>
                                <a href="https://zalo.me/0855528688" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-brand-700 px-5 py-3 text-brand-700 hover:bg-white">Nhắn Zalo</a>
                            </div>
                            <p className="text-stone-500 text-[13px] leading-relaxed max-w-[360px]">
                                Đội ngũ Đông Phú Gia sẽ xác nhận giá và tình trạng hàng khi tư vấn.
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
                                    <div className="flex flex-col gap-1.5 mt-1">
                                        <div className="text-stone-600 text-body-sm">
                                            <span className="font-medium">Hotline:</span>{" "}
                                            <a href={`tel:0949349949`} className="hover:text-brand-600 font-medium transition-colors">
                                                {siteConfig.contact.hotlineLabel}
                                            </a>
                                        </div>
                                        <div className="text-stone-600 text-[13px]">
                                            <span className="font-medium">Phòng KD:</span>{" "}
                                            <a href={`tel:${siteConfig.contact.businessRoom}`} className="hover:text-brand-600 transition-colors">
                                                {siteConfig.contact.businessRoomLabel}
                                            </a>
                                        </div>
                                    </div>
                                </li>
                                <li><a href="https://www.dongphugia.vn" target="_blank" rel="noopener noreferrer" className="text-stone-600 text-body-sm hover:text-brand-600 transition-colors">www.dongphugia.vn</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-stone-200 flex flex-col md:flex-row justify-center lg:justify-between items-center gap-4">
                    <p className="text-stone-500 text-[13px] text-center lg:text-left">
                        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
                    </p>
                    <div className="flex flex-wrap items-center justify-center lg:justify-end gap-4 lg:gap-6">
                        {NAV_FOOTER_LEGAL_LINKS.map(link => (
                            <Link key={link.href} href={link.href} className="text-stone-500 text-[13px] hover:text-brand-600 transition-colors whitespace-nowrap">{link.label}</Link>
                        ))}
                    </div>
                </div>

                {/* BCT Badge */}
                <div className="pt-6 flex justify-center">
                    <a
                        href="http://online.gov.vn/Home/WebDetails/143418"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Đã thông báo Bộ Công Thương"
                    >
                        <DeferredResponsiveMedia
                            src="/images/bct-badge.png"
                            alt="Đã Thông Báo Bộ Công Thương"
                            width={250}
                            height={100}
                            className="w-[200px] lg:w-[250px] h-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
                        />
                    </a>
                </div>
            </div>
        </footer>
    );
}
