import Link from 'next/link'

import { NAV_PRODUCT_CATEGORIES, siteConfig } from '@/config/site'

export function EmergencyPublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-stone-900">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-brand-700 px-4 py-3 font-semibold text-white focus:translate-y-0"
      >
        Chuyển đến nội dung chính
      </a>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-5 px-5 py-5 lg:px-8">
          <Link href="/" aria-label="Đông Phú Gia - Trang chủ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Logo.png" alt="Đông Phú Gia" width={245} height={48} className="h-auto w-[190px] lg:w-[245px]" />
          </Link>
          <nav aria-label="Điều hướng chính" className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium">
            {NAV_PRODUCT_CATEGORIES.map(({ href, label }) => (
              <Link key={href} href={href} className="text-stone-700 hover:text-brand-700">{label}</Link>
            ))}
            <Link href="/lien-he" className="rounded-full bg-brand-700 px-4 py-2 text-white hover:bg-brand-800">Liên hệ</Link>
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-10 text-sm leading-6 text-stone-700 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="font-semibold text-stone-900">{siteConfig.name}</p>
            <p>{siteConfig.contact.fullAddress}</p>
            <p>{siteConfig.contact.workingHours}</p>
          </div>
          <div className="lg:text-right">
            <p><a href={`tel:${siteConfig.contact.hotline}`} className="font-semibold text-brand-700">{siteConfig.contact.hotlineLabel}</a></p>
            <p><a href={`mailto:${siteConfig.contact.email}`} className="hover:text-brand-700">{siteConfig.contact.email}</a></p>
            <p>Danh mục trực tuyến đang được cập nhật; vui lòng liên hệ trực tiếp để được tư vấn.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
