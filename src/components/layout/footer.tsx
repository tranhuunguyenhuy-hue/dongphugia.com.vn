import Link from "next/link";
import Image from "next/image";
import { Phone, Mail, MapPin, Map } from "lucide-react";

export function Footer() {
    return (
        <footer className="bg-[#14532d] text-white overflow-hidden">
            {/* Top Border Accent */}
            <div className="h-1.5 w-full bg-gradient-to-r from-[#22c55e] via-[#16a34a] to-[#15803d]"></div>

            <div className="max-w-[1280px] mx-auto px-5 pt-16 pb-8 lg:pt-20 lg:pb-12">

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 mb-16">

                    {/* Column 1: Brand & About (Takes up 4 cols on large screens) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <Link href="/" className="inline-block w-[180px] sm:w-[220px]">
                            {/* Assuming you have a white/reversed logo for dark backgrounds. If not, we use the default and adjust brightness, or keep it text */}
                            <Image
                                src="/logo.svg"
                                alt="Đông Phú Gia"
                                width={220}
                                height={60}
                                className="w-full h-auto brightness-0 invert"
                            />
                        </Link>
                        <p className="text-[15px] sm:text-[16px] text-[#bbf7d0] leading-[26px] max-w-[400px]">
                            Nhà phân phối vật liệu xây dựng và nội thất cao cấp tại Lâm Đồng. Cung cấp giải pháp toàn diện từ gạch ốp lát, thiết bị vệ sinh, đến sàn gỗ và vật liệu nước chuyên dụng.
                        </p>
                        <div className="flex gap-4 items-center mt-2">
                            {/* Social Placeholders - Can be replaced with actual links/icons later */}
                            <div className="w-10 h-10 rounded-full bg-[#166534] flex items-center justify-center hover:bg-[#15803d] transition-colors cursor-pointer border border-[#14532d]">
                                <span className="font-bold text-white">f</span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#166534] flex items-center justify-center hover:bg-[#15803d] transition-colors cursor-pointer border border-[#14532d]">
                                <span className="font-bold text-white">Y</span>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#166534] flex items-center justify-center hover:bg-[#15803d] transition-colors cursor-pointer border border-[#14532d]">
                                <span className="font-bold text-white">Z</span>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Quick Links (Takes up 2 cols) */}
                    <div className="lg:col-span-2 flex flex-col gap-5">
                        <h2 className="text-[18px] sm:text-[20px] font-semibold text-white tracking-tight">Danh mục</h2>
                        <nav aria-label="Footer danh mục">
                            <ul className="flex flex-col gap-3.5">
                                <li><Link href="/gach-op-lat" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Gạch ốp lát</Link></li>
                                <li><Link href="/thiet-bi-ve-sinh" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Thiết bị vệ sinh</Link></li>
                                <li><Link href="/thiet-bi-bep" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Thiết bị bếp</Link></li>
                                <li><Link href="#" className="text-[15px] text-[#166534] cursor-default pointer-events-none" aria-disabled="true">Sàn gỗ</Link></li>
                                <li><Link href="#" className="text-[15px] text-[#166534] cursor-default pointer-events-none" aria-disabled="true">Vật liệu nước</Link></li>
                            </ul>
                        </nav>
                    </div>

                    {/* Column 3: Customer Support (Takes up 2 cols) */}
                    <div className="lg:col-span-2 flex flex-col gap-5">
                        <h2 className="text-[18px] sm:text-[20px] font-semibold text-white tracking-tight">Chính sách</h2>
                        <nav aria-label="Footer chính sách">
                            <ul className="flex flex-col gap-3.5">
                                <li><Link href="#" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Chính sách giao hàng</Link></li>
                                <li><Link href="#" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Chính sách bảo hành</Link></li>
                                <li><Link href="#" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Chính sách đổi trả</Link></li>
                                <li><Link href="#" className="text-[15px] text-[#bbf7d0] hover:text-white hover:underline underline-offset-4 transition-all">Bảo mật thông tin</Link></li>
                            </ul>
                        </nav>
                    </div>

                    {/* Column 4: Contact Info (Takes up 4 cols) */}
                    <div className="lg:col-span-4 flex flex-col gap-5">
                        <h2 className="text-[18px] sm:text-[20px] font-semibold text-white tracking-tight">Liên hệ</h2>
                        <address className="not-italic">
                            <ul className="flex flex-col gap-4">
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-8 h-8 shrink-0 rounded-full bg-[#166534] flex items-center justify-center">
                                        <MapPin className="w-4 h-4 text-[#4ade80]" aria-hidden="true" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[15px] font-medium text-white">Trụ sở chính</span>
                                        <span className="text-[15px] text-[#bbf7d0] leading-[22px]">200 - 202 - 204 Phan Đình Phùng, Phường 2, TP. Đà Lạt, Lâm Đồng</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-8 h-8 shrink-0 rounded-full bg-[#166534] flex items-center justify-center">
                                        <Phone className="w-4 h-4 text-[#4ade80]" aria-hidden="true" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[15px] font-medium text-white">Hotline tư vấn</span>
                                        <a href="tel:02633520316" className="text-[15px] text-[#bbf7d0] hover:text-white transition-colors">0263 3520 316</a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="mt-1 w-8 h-8 shrink-0 rounded-full bg-[#166534] flex items-center justify-center">
                                        <Mail className="w-4 h-4 text-[#4ade80]" aria-hidden="true" />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[15px] font-medium text-white">Email</span>
                                        <a href="mailto:info@dongphugia.vn" className="text-[15px] text-[#bbf7d0] hover:text-white transition-colors">info@dongphugia.vn</a>
                                    </div>
                                </li>
                            </ul>
                        </address>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-[#166534]">
                    <p className="text-[14px] text-[#86efac] text-center md:text-left">
                        © {new Date().getFullYear()} Công ty TNHH Đông Phú Gia. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        <Link href="#" className="text-[14px] text-[#86efac] hover:text-white transition-colors">Điều khoản</Link>
                        <Link href="#" className="text-[14px] text-[#86efac] hover:text-white transition-colors">Quyền riêng tư</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
