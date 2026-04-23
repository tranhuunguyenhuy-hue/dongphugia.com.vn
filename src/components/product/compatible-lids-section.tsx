import Link from 'next/link'
import Image from 'next/image'
import type { CompatibleLid } from '@/lib/public-api-products'

interface Props {
    lids: CompatibleLid[]
    brandName?: string | null
}

export function CompatibleLidsSection({ lids, brandName }: Props) {
    if (!lids || lids.length === 0) return null

    const isSameBrand = !!brandName

    return (
        <section
            id="compatible-lids"
            className="mt-16 border-t border-neutral-100 pt-10"
            aria-label="Nắp bồn cầu tương thích"
        >
            {/* Header */}
            <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#2E7A96] mb-1">
                        Gợi ý phụ kiện
                    </p>
                    <h2 className="text-2xl font-bold text-neutral-900 leading-tight">
                        Nắp bồn cầu{isSameBrand && brandName ? ` ${brandName}` : ''} phù hợp
                    </h2>
                    <p className="text-sm text-neutral-400 mt-1.5">
                        Chọn nắp phù hợp để hoàn thiện bộ sản phẩm của bạn.
                    </p>
                </div>
                <Link
                    href="/thiet-bi-ve-sinh?sub=nap-bon-cau"
                    className="shrink-0 text-sm font-medium text-[#2E7A96] hover:underline underline-offset-4 transition-all"
                >
                    Xem tất cả →
                </Link>
            </div>

            {/* Cards — horizontal scroll on mobile, grid on lg */}
            <div className="flex gap-4 overflow-x-auto pb-3 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-neutral-200">
                {lids.map((lid) => {
                    const href = `/${lid.categories.slug}/${lid.subcategories?.slug ?? 'nap-bon-cau'}/${lid.slug}`
                    return (
                        <Link
                            key={lid.id}
                            href={href}
                            className="group flex-none w-[220px] lg:w-auto snap-start rounded-2xl border border-neutral-100 bg-white p-4 hover:border-[#2E7A96]/30 hover:shadow-md transition-all duration-200"
                        >
                            {/* Image */}
                            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-50 mb-3">
                                {lid.image_main_url ? (
                                    <Image
                                        src={lid.image_main_url}
                                        alt={lid.name}
                                        fill
                                        sizes="(max-width: 768px) 220px, 33vw"
                                        className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <svg className="w-10 h-10 text-neutral-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4m0 0l4-4m-4 4h12" />
                                        </svg>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div>
                                <p className="text-[11px] text-neutral-400 font-mono mb-0.5">{lid.sku}</p>
                                <p className="text-sm font-medium text-neutral-800 leading-snug line-clamp-2 group-hover:text-[#2E7A96] transition-colors">
                                    {lid.name}
                                </p>
                                <p className="text-sm font-semibold text-[#2E7A96] mt-2">
                                    {lid.price_display || 'Liên hệ'}
                                </p>
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Disclaimer */}
            <p className="mt-5 text-xs text-neutral-400 flex items-start gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Vui lòng kiểm tra thông số kỹ thuật trước khi đặt hàng để đảm bảo tương thích. Đội ngũ Đông Phú Gia hỗ trợ tư vấn miễn phí.
            </p>
        </section>
    )
}
