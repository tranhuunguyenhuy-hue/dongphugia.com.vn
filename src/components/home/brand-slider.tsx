import { BrandLogo } from '@/components/media/brand-logo'

const BRAND_SLUGS = [
    'toto', 'inax', 'caesar', 'american-standard', 'grohe', 'cotto', 'viglacera',
    'hansgrohe', 'duravit', 'moen', 'mowoen', 'kluger', 'atmor',
    'elica', 'kaff', 'samsung', 'panasonic', 'toshiba',
    'ariston', 'ferroli', 'rheem', 'karofi', 'mitsubishi-cleansui', 
    'unilever-pureit', 'dai-thanh', 'coway', 'philips'
]

export function BrandSlider() {
    return (
        <section className="w-full py-8 lg:py-10 overflow-hidden" aria-label="Đối tác thương hiệu">
            {/* Section label */}
            <p className="text-center text-[13px] uppercase tracking-widest font-semibold text-stone-600 mb-8 w-full">
                Được hơn 30 đối tác toàn cầu tin tưởng
            </p>

            {/* Marquee container */}
            <div className="relative group/slider">
                {/* Fade edges */}
                <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

                <div className="brand-marquee-track flex w-max items-center hover:[animation-play-state:paused]">
                    {[false, true].map((isClone) => (
                        <div
                            key={isClone ? 'clone' : 'primary'}
                            className="flex items-center gap-8 pr-8 lg:gap-12 lg:pr-12"
                            aria-hidden={isClone || undefined}
                        >
                            {BRAND_SLUGS.map((slug) => (
                                <div
                                    key={slug}
                                    className="group/brand relative flex h-[60px] w-[120px] shrink-0 items-center justify-center transition-transform duration-300 hover:scale-105 lg:h-[80px] lg:w-[140px]"
                                >
                                    <BrandLogo
                                        slug={slug}
                                        name={slug}
                                        decorative={isClone}
                                        className="max-h-[40px] max-w-[80px] opacity-50 grayscale transition-all duration-300 group-hover/brand:opacity-100 group-hover/brand:grayscale-0 lg:max-h-[50px] lg:max-w-[100px]"
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
