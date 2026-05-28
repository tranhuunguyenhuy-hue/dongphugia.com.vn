import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex items-center justify-center pt-[88px]">
        <div className="text-center px-6 py-20 max-w-lg mx-auto">
          <p className="text-8xl font-bold text-brand-500 mb-4">404</p>
          <h1 className="text-2xl font-bold text-stone-900 mb-3">
            Trang không tồn tại
          </h1>
          <p className="text-stone-500 mb-8">
            Trang bạn đang tìm kiếm đã bị xóa hoặc chưa từng tồn tại.
          </p>
          <Button asChild className="rounded-full mb-6 px-6 py-3 h-auto text-base">
            <Link href="/">
              Về trang chủ
            </Link>
          </Button>
          <p className="text-sm text-stone-400 mb-3">Hoặc xem danh mục sản phẩm:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link href="/thiet-bi-ve-sinh" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Thiết bị vệ sinh
            </Link>
            <Link href="/thiet-bi-bep" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Thiết bị bếp
            </Link>
            <Link href="/gach-op-lat" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Gạch ốp lát
            </Link>
            <Link href="/vat-lieu-nuoc" className="px-4 py-2 border border-stone-200 rounded-full text-sm text-stone-600 hover:border-brand-400 hover:text-brand-600 transition-colors">
              Vật liệu nước
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
