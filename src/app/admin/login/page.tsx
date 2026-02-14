import LoginForm from "./login-form"
import { Package2 } from "lucide-react"

export default function LoginPage() {
    return (
        <div className="flex min-h-screen">
            {/* Left panel — Brand */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 relative overflow-hidden">
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 -left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
                </div>

                <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                            <Package2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Đông Phú Gia</h2>
                            <p className="text-sm text-green-200">Hệ thống quản trị</p>
                        </div>
                    </div>

                    {/* Hero text */}
                    <div className="max-w-md">
                        <h1 className="text-4xl font-bold leading-tight mb-4">
                            Quản lý vật liệu xây dựng
                            <span className="text-green-300"> chuyên nghiệp</span>
                        </h1>
                        <p className="text-green-100 text-lg leading-relaxed">
                            Hệ thống quản trị nội dung cho website Đông Phú Gia —
                            quản lý sản phẩm, banner, dự án và đối tác một cách dễ dàng.
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-8">
                        <div>
                            <p className="text-3xl font-bold">500+</p>
                            <p className="text-sm text-green-200">Sản phẩm</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold">50+</p>
                            <p className="text-sm text-green-200">Thương hiệu</p>
                        </div>
                        <div>
                            <p className="text-3xl font-bold">10+</p>
                            <p className="text-sm text-green-200">Năm kinh nghiệm</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right panel — Form */}
            <div className="flex flex-1 items-center justify-center p-6 bg-slate-50">
                <div className="w-full max-w-[400px] animate-page-enter">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700 text-white">
                            <Package2 className="h-5 w-5" />
                        </div>
                        <span className="font-bold text-lg">Đông Phú Gia</span>
                    </div>
                    <LoginForm />
                </div>
            </div>
        </div>
    )
}
