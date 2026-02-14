import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";

export function Footer() {
    return (
        <footer className="bg-[#14532d] text-white">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Company Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-lg font-bold">
                                Đ
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">ĐÔNG PHÚ GIA</h3>
                                <p className="text-xs text-green-200">
                                    Vật liệu xây dựng cao cấp
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-green-100/80 leading-relaxed">
                            Chuyên phân phối vật liệu xây dựng chính hãng, đa dạng mẫu mã,
                            giá cả cạnh tranh.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold mb-4 text-lg">Liên kết nhanh</h4>
                        <ul className="space-y-2 text-sm text-green-100/80">
                            <li>
                                <Link href="/" className="hover:text-white transition-colors">
                                    Trang chủ
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/danh-muc/gach-op-lat"
                                    className="hover:text-white transition-colors"
                                >
                                    Gạch ốp lát
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/tin-tuc"
                                    className="hover:text-white transition-colors"
                                >
                                    Tin tức
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Categories */}
                    <div>
                        <h4 className="font-semibold mb-4 text-lg">Danh mục</h4>
                        <ul className="space-y-2 text-sm text-green-100/80">
                            <li>
                                <Link
                                    href="/danh-muc/gach-op-lat"
                                    className="hover:text-white transition-colors"
                                >
                                    Gạch ốp lát
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/danh-muc/thiet-bi-ve-sinh"
                                    className="hover:text-white transition-colors"
                                >
                                    Thiết bị vệ sinh
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/danh-muc/thiet-bi-nha-bep"
                                    className="hover:text-white transition-colors"
                                >
                                    Thiết bị nhà bếp
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/danh-muc/san-go-san-nhua"
                                    className="hover:text-white transition-colors"
                                >
                                    Sàn gỗ, sàn nhựa
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-semibold mb-4 text-lg">Liên hệ</h4>
                        <ul className="space-y-3 text-sm text-green-100/80">
                            <li className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>Lâm Đồng, Việt Nam</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <Phone className="h-4 w-4 shrink-0" />
                                <a
                                    href="tel:02633520316"
                                    className="hover:text-white transition-colors"
                                >
                                    0263 3520 316
                                </a>
                            </li>
                            <li className="flex items-center gap-2">
                                <Mail className="h-4 w-4 shrink-0" />
                                <a
                                    href="mailto:info@dongphugia.vn"
                                    className="hover:text-white transition-colors"
                                >
                                    info@dongphugia.vn
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom */}
                <div className="border-t border-white/10 mt-10 pt-6 text-center text-xs text-green-100/50">
                    © {new Date().getFullYear()} Đông Phú Gia. Tất cả quyền được bảo lưu.
                </div>
            </div>
        </footer>
    );
}
