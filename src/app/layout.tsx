import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Changed from Geist to Inter
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"], // Added vietnamese subset
});

export const metadata: Metadata = {
  title: "Đông Phú Gia - Quản trị",
  description: "Hệ thống quản trị nội dung Đông Phú Gia",
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
