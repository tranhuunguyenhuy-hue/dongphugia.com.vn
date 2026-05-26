/**
 * /lien-he — Contact Page
 *
 * Server Component — exports metadata for SEO.
 * Interactive form logic lives in ./contact-form.tsx (Client Component).
 *
 * Why split: Next.js App Router does not allow `export const metadata`
 * from files with "use client" directive. By keeping this file as a
 * Server Component, Google can see the proper <title> and <meta description>.
 */

import { type Metadata } from "next"
import { ContactForm } from "./contact-form"
import { JsonLd } from "@/components/seo/json-ld"
import { buildBreadcrumbSchema } from "@/lib/seo/schema"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
    title: "Liên Hệ Tư Vấn | Đông Phú Gia",
    description: `Liên hệ Đông Phú Gia để được tư vấn miễn phí về vật liệu xây dựng cao cấp tại Đà Lạt. Hotline: ${siteConfig.contact.hotlineLabel}. Địa chỉ: ${siteConfig.contact.fullAddress}.`,
    alternates: {
        canonical: "/lien-he",
    },
    openGraph: {
        title: "Liên Hệ Tư Vấn | Đông Phú Gia",
        description:
            "Tư vấn miễn phí về gạch ốp lát, thiết bị vệ sinh, thiết bị bếp tại Đà Lạt. Đội ngũ chuyên gia sẵn sàng hỗ trợ.",
        url: "/lien-he",
    },
}

export default function LienHePage() {
    const breadcrumb = buildBreadcrumbSchema([
        { name: "Trang chủ", url: "/" },
        { name: "Liên hệ", url: "/lien-he" },
    ])

    return (
        <>
            <JsonLd data={breadcrumb} />
            <ContactForm />
        </>
    )
}
