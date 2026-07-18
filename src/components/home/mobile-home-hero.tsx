import Link from 'next/link'
import { ResponsiveMedia } from '@/components/media/responsive-media'

type MobileHomeHeroProps = {
    campaignImageUrl?: string
}

export function MobileHomeHero({
    campaignImageUrl,
}: MobileHomeHeroProps) {
    return (
        <section
            className="relative min-h-[320px] overflow-hidden rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 shadow-md md:hidden"
            aria-label="Giới thiệu Đông Phú Gia"
            style={{
                fontFamily: 'Arial, Helvetica, ui-sans-serif, sans-serif',
            }}
        >
            <div className="relative z-10 flex min-h-[320px] flex-col justify-center px-6 py-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Đông Phú Gia · Đà Lạt
                </p>
                <h1 className="max-w-[17rem] text-[2rem] font-semibold leading-[1.12] tracking-tight text-white">
                    Hoàn thiện không gian sống, chọn đúng từ đầu
                </h1>
                <p className="mt-4 max-w-[19rem] text-sm leading-6 text-stone-200">
                    Vật liệu xây dựng và thiết bị chính hãng, được tư vấn theo
                    nhu cầu thực tế của từng không gian.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                        href="/thiet-bi-ve-sinh"
                        className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-stone-950 shadow-sm"
                    >
                        Khám phá sản phẩm
                    </Link>
                    <Link
                        href="/lien-he"
                        className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 px-5 text-sm font-semibold text-white"
                    >
                        Nhận tư vấn
                    </Link>
                </div>
                {campaignImageUrl ? (
                    <details className="mt-5">
                        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center text-sm font-medium text-stone-300 underline decoration-stone-500 underline-offset-4">
                            Xem ưu đãi hiện tại
                        </summary>
                        <div className="mt-3 overflow-hidden rounded-xl">
                            <ResponsiveMedia
                                src={campaignImageUrl}
                                alt="Ưu đãi hiện tại tại Đông Phú Gia"
                                width={1600}
                                height={900}
                                profile="hero"
                                mobileWidth={720}
                                sizes="100vw"
                                className="h-auto w-full object-cover"
                                loading="lazy"
                            />
                        </div>
                    </details>
                ) : null}
            </div>
        </section>
    )
}
