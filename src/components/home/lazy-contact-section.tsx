'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { PUBLIC_UI_READ_ONLY } from '@dpg/public-ui-policy'

const ContactSection = dynamic(
    () => import('@/components/home/contact-section').then((module) => module.ContactSection),
    { ssr: false },
)

export function LazyContactSection() {
    if (PUBLIC_UI_READ_ONLY) return <ReadOnlyContactSection />
    return <InteractiveContactSection />
}

function ReadOnlyContactSection() {
    return (
        <section className="bg-stone-50 py-16 lg:py-24">
            <div className="u-container mx-auto max-w-3xl text-center">
                <h2 className="mb-3 text-3xl font-bold tracking-tight text-neutral-900">Liên hệ tư vấn</h2>
                <p className="mb-6 text-neutral-500">Biểu mẫu trực tuyến đang tạm khóa. Vui lòng gọi trực tiếp hoặc xem thông tin liên hệ.</p>
                <Link href="/lien-he" className="inline-flex h-12 items-center rounded-xl bg-[#2E7A96] px-6 font-semibold text-white">Thông tin liên hệ</Link>
            </div>
        </section>
    )
}

function InteractiveContactSection() {
    const [shouldLoad, setShouldLoad] = useState(false)
    const boundaryRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const boundary = boundaryRef.current
        if (!boundary) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                setShouldLoad(true)
                observer.disconnect()
            },
            { rootMargin: '400px 0px' },
        )

        observer.observe(boundary)
        return () => observer.disconnect()
    }, [])

    return (
        <div ref={boundaryRef}>
            {shouldLoad ? (
                <ContactSection />
            ) : (
                <section className="bg-stone-50 py-16 lg:py-24">
                    <div className="u-container mx-auto max-w-3xl text-center">
                        <h2 className="mb-3 text-3xl font-bold tracking-tight text-neutral-900">
                            Gửi yêu cầu trực tuyến
                        </h2>
                        <p className="mb-6 text-neutral-500">
                            Chuyên viên Đông Phú Gia sẵn sàng hỗ trợ nhu cầu của bạn.
                        </p>
                        <Link
                            href="/lien-he"
                            className="inline-flex h-12 items-center rounded-xl bg-[#2E7A96] px-6 font-semibold text-white hover:bg-[#256579]"
                        >
                            Liên hệ tư vấn
                        </Link>
                    </div>
                </section>
            )}
        </div>
    )
}
