import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { GoogleTagManager } from '@next/third-parties/google';
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationSchema } from "@/lib/seo/schema";
import { getCanonicalSiteUrl } from "@/lib/site";
import { WebVitalsReporter } from "@/components/analytics/web-vitals-reporter";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalSiteUrl()),
  title: {
    default: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt",
    template: "%s | Đông Phú Gia",
  },
  description: "Đông Phú Gia - Nhà phân phối vật liệu xây dựng cao cấp tại Đà Lạt: gạch ốp lát, thiết bị vệ sinh chính hãng từ các thương hiệu uy tín.",
  alternates: {
    canonical: getCanonicalSiteUrl(),
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Đông Phú Gia",
    url: getCanonicalSiteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    site: "@dongphugia",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

// Required: tells mobile browsers to use device width, not the legacy 980px desktop default.
// Without this, DevTools mobile emulation and real phones will show the DESKTOP layout.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,   // allow user pinch-zoom for accessibility
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://cdn.dongphugia.com.vn" crossOrigin="" />
        <link rel="dns-prefetch" href="https://cdn.dongphugia.com.vn" />
      </head>
      <body
        className={`${beVietnamPro.variable} ${playfairDisplay.variable} antialiased font-sans`}
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
