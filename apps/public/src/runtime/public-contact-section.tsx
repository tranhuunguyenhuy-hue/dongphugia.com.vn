import { siteConfig, siteLinks } from '@/config/site'

export function ContactSection({ asPage = false }: { asPage?: boolean }) {
  return <section className="bg-stone-50 py-16 lg:py-24">
    <div className="u-container mx-auto max-w-3xl rounded-3xl border border-neutral-100 bg-white p-8 text-center shadow-sm sm:p-12">
      {asPage
        ? <h1 className="mb-3 text-3xl font-bold tracking-tight text-neutral-900">Liên hệ tư vấn</h1>
        : <h2 className="mb-3 text-3xl font-bold tracking-tight text-neutral-900">Liên hệ tư vấn</h2>}
      <p className="mb-8 text-neutral-600">Đội ngũ Đông Phú Gia sẵn sàng hỗ trợ qua điện thoại hoặc Zalo.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <a className="rounded-xl bg-[#2E7A96] px-6 py-3 font-semibold text-white" href={`tel:${siteConfig.contact.hotline}`}>Gọi tư vấn</a>
        <a className="rounded-xl border border-[#2E7A96] px-6 py-3 font-semibold text-[#2E7A96]" href={siteLinks.zalo} target="_blank" rel="noopener noreferrer">Nhắn Zalo</a>
      </div>
    </div>
  </section>
}
