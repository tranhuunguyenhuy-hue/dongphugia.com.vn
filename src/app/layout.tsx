import type { Metadata } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn"),
  title: {
    default: "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt",
    template: "%s | Đông Phú Gia",
  },
  description: "Đông Phú Gia - Nhà phân phối vật liệu xây dựng cao cấp tại Đà Lạt: gạch ốp lát, thiết bị vệ sinh chính hãng từ các thương hiệu uy tín.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Đông Phú Gia",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://dongphugia.vn",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${beVietnamPro.variable} ${playfairDisplay.variable} antialiased font-sans`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
