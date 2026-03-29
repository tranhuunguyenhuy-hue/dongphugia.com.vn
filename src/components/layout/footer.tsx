"use client";

import Link from "next/link";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="w-full bg-neutral-100 border-t border-neutral-200">
            <div className="max-w-[1280px] mx-auto px-6 sm:px-8 lg:px-12 py-16 sm:py-20 lg:py-24">
                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-16">
                    {/* Left Column: Logo & Newsletter */}
                    <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-8">
                        <Link href="/" className="inline-block">
                            <Image
                                src="/images/logo.png"
                                alt="Đông Phú Gia"
                                width={180}
                                height={44}
                                className="h-9 sm:h-10 w-auto"
                            />
                        </Link>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-[#2E7A96]" />
                                <h3 className="text-neutral-900 font-medium text-[15px]">
                                    Đăng ký nhận bản tin ưu đãi
                                </h3>
                            </div>
                            <form className="flex items-stretch max-w-[360px] gap-0" onSubmit={(e) => e.preventDefault()}>
                                <input
                                    type="email"
                                    placeholder="Nhập email của bạn"
                                    className="flex-1 h-[44px] px-4 border border-neutral-300 border-r-0 bg-white text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#2E7A96] focus:border-[#2E7A96] transition-all"
                                />
                                <button
                                    type="submit"
                                    className="h-[44px] px-6 bg-[#2E7A96] hover:bg-[#256579] text-white font-medium text-[13px] transition-colors flex items-center justify-center tracking-wide"
                                >
                                    Đăng ký
                                </button>
                            </form>
                            <p className="text-neutral-500 text-[13px] leading-relaxed max-w-[360px]">
                                Bằng việc đăng ký, bạn đồng ý với Chính sách Bảo mật của chúng tôi và nhận thông tin cập nhật từ Đông Phú Gia.
                            </p>
                        </div>
                    </div>

                    {/* Right Columns: Links */}
                    <div className="w-full flex flex-col md:flex-row gap-8 lg:gap-16 pt-2 lg:pt-0 justify-between">
                        {/* Col 1 */}
                        <div className="flex flex-col gap-5 md:w-1/3">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-[#2E7A96]" />
                                <h4 className="text-neutral-900 font-medium text-[13px] tracking-[0.15em] uppercase">Sản phẩm chính</h4>
                            </div>
                            <ul className="flex flex-col gap-3">
                                <li><Link href="/gach-op-lat" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Gạch ốp lát</Link></li>
                                <li><Link href="/thiet-bi-ve-sinh" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Thiết bị vệ sinh</Link></li>
                                <li><Link href="/thiet-bi-bep" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Thiết bị bếp</Link></li>
                                <li><Link href="/san-go" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Sàn gỗ</Link></li>
                                <li><Link href="#" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Vật liệu nước</Link></li>
                            </ul>
                        </div>

                        {/* Col 2 */}
                        <div className="flex flex-col gap-5 md:w-1/3">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-[#2E7A96]" />
                                <h4 className="text-neutral-900 font-medium text-[13px] tracking-[0.15em] uppercase">Về chúng tôi</h4>
                            </div>
                            <ul className="flex flex-col gap-3">
                                <li><Link href="/ve-chung-toi" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Giới thiệu</Link></li>
                                <li><Link href="/doi-tac" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Đối tác</Link></li>
                                <li><Link href="/du-an" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Dự án tiêu biểu</Link></li>
                                <li><Link href="/tin-tuc" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">Tin tức & Sự kiện</Link></li>
                            </ul>
                        </div>

                        {/* Col 3 */}
                        <div className="flex flex-col gap-5 md:w-1/3">
                            <div className="flex flex-col gap-2">
                                <div className="h-1 w-8 bg-[#2E7A96]" />
                                <h4 className="text-neutral-900 font-medium text-[13px] tracking-[0.15em] uppercase">Liên hệ</h4>
                            </div>
                            <ul className="flex flex-col gap-3">
                                <li className="text-neutral-600 text-[14px] leading-[22px]">
                                    200 - 204 Phan Đình Phùng
                                    <br />Phường 2, Đà Lạt
                                </li>
                                <li><a href="tel:02633520316" className="text-neutral-600 text-[14px] font-medium hover:text-[#2E7A96] transition-colors">0263 3520 316</a></li>
                                <li><a href="mailto:info@dongphugia.vn" className="text-neutral-600 text-[14px] hover:text-[#2E7A96] transition-colors">info@dongphugia.vn</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-neutral-300 flex flex-col md:flex-row justify-center lg:justify-between items-center gap-4">
                    <p className="text-neutral-500 text-[13px] text-center lg:text-left">
                        © {new Date().getFullYear()} Dong Phu Gia. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="#" className="text-neutral-500 text-[13px] hover:text-[#2E7A96] transition-colors">Điều khoản</Link>
                        <Link href="#" className="text-neutral-500 text-[13px] hover:text-[#2E7A96] transition-colors">Quyền riêng tư</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
