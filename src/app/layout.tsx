import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Changed from Geist to Inter
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"], // Added vietnamese subset
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
        className={`${inter.variable} antialiased font-sans`} // Changed to use inter variable
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
