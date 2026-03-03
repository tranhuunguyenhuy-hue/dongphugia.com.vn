"use client";

import Link from "next/link";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="relative w-full pt-32 sm:pt-40 lg:pt-48 pb-6 px-4 sm:px-6 lg:px-8">
            {/* Smooth Gradient fading from pure white/transparent down to mint to avoid hard cut */}
            <div className="absolute inset-0 -z-20 bg-gradient-to-b from-transparent via-[#f0fdf4] to-[#c6f6d5]" />

            <div className="relative z-10 max-w-[1280px] mx-auto bg-white/50 backdrop-blur-2xl rounded-[32px] sm:rounded-[40px] shadow-[0_8px_40px_-12px_rgba(21,128,61,0.15)] p-8 sm:p-12 lg:p-16 border border-white/60">
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
                            <h3 className="text-[#111827] font-semibold text-[16px] tracking-tight">
                                Đăng ký nhận bản tin ưu đãi.
                            </h3>
                            <form className="relative flex items-center max-w-[360px]" onSubmit={(e) => e.preventDefault()}>
                                <input
                                    type="email"
                                    placeholder="Nhập email của bạn"
                                    className="w-full h-[52px] pl-6 pr-[120px] rounded-full border border-gray-200 bg-gray-50/50 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 focus:border-[#15803d] transition-all"
                                />
                                <button
                                    type="submit"
                                    className="absolute right-1.5 top-1.5 bottom-1.5 px-6 rounded-full bg-[#111827] hover:bg-[#1f2937] text-white font-medium text-[13px] transition-colors flex items-center justify-center tracking-wide"
                                >
                                    Đăng ký
                                </button>
                            </form>
                            <p className="text-[#6b7280] text-[13px] leading-relaxed max-w-[360px] mt-1">
                                Bằng việc đăng ký, bạn đồng ý với Chính sách Bảo mật của chúng tôi và nhận thông tin cập nhật từ Đông Phú Gia.
                            </p>
                        </div>
                    </div>

                    {/* Right Columns: Links */}
                    <div className="w-full flex flex-col md:flex-row gap-8 lg:gap-16 pt-2 lg:pt-0 justify-between">
                        {/* Col 1 */}
                        <div className="flex flex-col gap-6 md:w-1/3">
                            <h4 className="text-[#111827] font-medium text-[14px] tracking-wide uppercase">Sản phẩm chính</h4>
                            <ul className="flex flex-col gap-3.5">
                                <li><Link href="/gach-op-lat" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Gạch ốp lát</Link></li>
                                <li><Link href="/thiet-bi-ve-sinh" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Thiết bị vệ sinh</Link></li>
                                <li><Link href="/thiet-bi-bep" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Thiết bị bếp</Link></li>
                                <li><Link href="#" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Sàn gỗ</Link></li>
                                <li><Link href="#" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Vật liệu nước</Link></li>
                            </ul>
                        </div>

                        {/* Col 2 */}
                        <div className="flex flex-col gap-6 md:w-1/3">
                            <h4 className="text-[#111827] font-medium text-[14px] tracking-wide uppercase">Về chúng tôi</h4>
                            <ul className="flex flex-col gap-3.5">
                                <li><Link href="/ve-chung-toi" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Giới thiệu</Link></li>
                                <li><Link href="/doi-tac" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Đối tác</Link></li>
                                <li><Link href="/du-an" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Dự án tiêu biểu</Link></li>
                                <li><Link href="/tin-tuc" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">Tin tức & Sự kiện</Link></li>
                            </ul>
                        </div>

                        {/* Col 3 */}
                        <div className="flex flex-col gap-6 md:w-1/3">
                            <h4 className="text-[#111827] font-medium text-[14px] tracking-wide uppercase">Liên hệ</h4>
                            <ul className="flex flex-col gap-4">
                                <li className="text-[#6b7280] text-[14px] leading-[22px]">
                                    200 - 204 Phan Đình Phùng
                                    <br />Phường 2, Đà Lạt
                                </li>
                                <li><a href="tel:02633520316" className="text-[#6b7280] text-[14px] font-medium hover:text-[#15803d] transition-colors">0263 3520 316</a></li>
                                <li><a href="mailto:info@dongphugia.vn" className="text-[#6b7280] text-[14px] hover:text-[#15803d] transition-colors">info@dongphugia.vn</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-center lg:justify-between items-center gap-4">
                    <p className="text-[#9ca3af] text-[13px] text-center lg:text-left">
                        © {new Date().getFullYear()} Dong Phu Gia. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="#" className="text-[#9ca3af] text-[13px] hover:text-[#15803d] transition-colors">Điều khoản</Link>
                        <Link href="#" className="text-[#9ca3af] text-[13px] hover:text-[#15803d] transition-colors">Quyền riêng tư</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
