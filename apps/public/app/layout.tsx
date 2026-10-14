import type { Metadata } from 'next'

import { APPLICATIONS } from '@dpg/app-contracts'
import CanonicalPublicLayout from '@/app/(public)/layout'
import { Toaster } from '@/components/ui/sonner'

import { getPublicAppEnvironment } from '../src/config/env'

import './globals.css'

const appEnvironment = getPublicAppEnvironment()

export const runtime = 'edge'

export const metadata: Metadata = {
  metadataBase: new URL(appEnvironment.origin),
  title: 'Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt',
  description: 'Đông Phú Gia - Nhà phân phối vật liệu xây dựng cao cấp tại Đà Lạt.',
  icons: { icon: '/images/logo-icon.svg' },
  robots: appEnvironment.previewNoindex
    ? { index: false, follow: false }
    : { index: true, follow: true },
}

export default function PublicRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body
        data-application={APPLICATIONS.public.name}
        className="antialiased font-sans"
      >
        <CanonicalPublicLayout>{children}</CanonicalPublicLayout>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
