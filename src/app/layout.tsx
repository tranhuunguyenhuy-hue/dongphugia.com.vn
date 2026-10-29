import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { GoogleTagManager } from '@next/third-parties/google';
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationSchema } from "@/lib/seo/schema";
import { getSiteRuntimeConfig } from "@/lib/site";
import { publicFontClasses, publicViewport } from "@/lib/public-typography";
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter";
import "./globals.css";

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  const siteRuntime = getSiteRuntimeConfig()

  return {
    metadataBase: new URL(siteRuntime.siteUrl),
    title: {
      default: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt",
      template: "%s | Đông Phú Gia",
    },
    description: "Đông Phú Gia - Nhà phân phối vật liệu xây dựng cao cấp tại Đà Lạt: gạch ốp lát, thiết bị vệ sinh chính hãng từ các thương hiệu uy tín.",
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: "Đông Phú Gia",
    },
    twitter: {
      card: "summary_large_image",
      site: "@dongphugia",
    },
    robots: {
      index: siteRuntime.allowIndexing,
      follow: siteRuntime.allowIndexing,
      googleBot: { index: siteRuntime.allowIndexing, follow: siteRuntime.allowIndexing },
    },
  }
}

// Required: tells mobile browsers to use device width, not the legacy 980px desktop default.
// Without this, DevTools mobile emulation and real phones will show the DESKTOP layout.
export const viewport: Viewport = publicViewport;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const siteRuntime = getSiteRuntimeConfig()
  const siteUrl = siteRuntime.siteUrl;
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME ?? "cdn.dongphugia.com.vn";
  const shouldPreconnectCdn = siteUrl.startsWith("https://") && cdnHostname;
  const cdnOrigin = shouldPreconnectCdn ? `https://${cdnHostname}` : null;

  return (
    <html lang="vi">
      <head>
        {cdnOrigin ? (
          <>
            <link rel="preconnect" href={cdnOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={`//${cdnHostname}`} />
          </>
        ) : null}
      </head>
      <body
        className={`${publicFontClasses} antialiased font-sans`}
      >
        {children}
        {/* Organization / LocalBusiness structured data — site-wide SEO signal */}
        <JsonLd data={buildOrganizationSchema()} />
        <Toaster richColors position="top-right" />
        {gtmId ? (
          <>
            <WebVitalsReporter />
            <GoogleTagManager gtmId={gtmId} />
          </>
        ) : null}
      </body>
    </html>
  );
}
