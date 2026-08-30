import type { Metadata } from 'next'

import { APPLICATIONS } from '@dpg/app-contracts'

import { getPublicAppEnvironment } from '../src/config/env'

import './globals.css'

const appEnvironment = getPublicAppEnvironment()

export const runtime = 'edge'

export const metadata: Metadata = {
  metadataBase: new URL(appEnvironment.origin),
  title: 'Dong Phu Gia Public Application',
  description: 'Public application foundation for Dong Phu Gia.',
  robots: appEnvironment.previewNoindex
    ? { index: false, follow: false }
    : { index: true, follow: true },
}

export default function PublicRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body data-application={APPLICATIONS.public.name}>{children}</body>
    </html>
  )
}
