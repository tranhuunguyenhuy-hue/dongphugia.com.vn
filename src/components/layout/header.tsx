
import Link from "next/link"
import { Phone, Search, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function Header() {
    return (
        <header className="relative w-full z-50">
            {/* Topbar - Node 89:1413 */}
            <div className="bg-[#15803d] text-[#86efac] py-3 text-sm font-medium">
                <div className="container mx-auto px-4 flex justify-center items-center gap-4 text-center">
                    <span>Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất.</span>
                    <div className="flex items-center gap-1 text-white">
                        <span>Liên hệ:</span>
                        <a href="tel:02633520316" className="underline font-bold">0263 3520 316</a>
                    </div>
                </div>
            </div>

            {/* Menubar - Node 89:1416 */}
            <div className="bg-white border-b shadow-[0px_2px_6px_0px_rgba(16,24,40,0.06)]">
                <div className="container mx-auto px-4 h-[80px] flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            Đ
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg leading-none uppercase text-primary">Đông Phú Gia</span>
                            <span className="text-xs text-muted-foreground tracking-wider">Vật liệu xây dựng cao cấp</span>
                        </div>
                    </Link>

                    {/* Desktop Menu - Node 89:1420 */}
                    <nav className="hidden md:flex items-center gap-8 font-medium text-gray-900">
                        <Link href="/gioi-thieu" className="hover:text-primary transition-colors">Về chúng tôi</Link>
                        <Link href="/doi-tac" className="hover:text-primary transition-colors">Đối tác</Link>
                        <Link href="/du-an" className="hover:text-primary transition-colors">Dự án</Link>
                        <Link href="/tin-tuc" className="hover:text-primary transition-colors">Tin tức</Link>
                    </nav>

                    {/* Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <Button className="bg-[#15803d] hover:bg-[#14532d] text-white shadow-md rounded-xl px-5 h-12 text-base font-medium gap-2">
                            <Phone className="h-5 w-5" />
                            Liên hệ tư vấn
                        </Button>
                    </div>

                    {/* Mobile Menu */}
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <Menu className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left">
                            <nav className="grid gap-4 py-4">
                                <Link href="/" className="text-lg font-medium">Trang chủ</Link>
                                <Link href="/gioi-thieu" className="text-lg font-medium">Về chúng tôi</Link>
                                <Link href="/san-pham" className="text-lg font-medium">Sản phẩm</Link>
                                <Link href="/du-an" className="text-lg font-medium">Dự án</Link>
                                <Link href="/tin-tuc" className="text-lg font-medium">Tin tức</Link>
                                <Link href="/lien-he" className="text-lg font-medium">Liên hệ</Link>
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}
