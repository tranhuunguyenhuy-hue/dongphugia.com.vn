import type { Metadata } from 'next'

import { APPLICATIONS } from '@dpg/app-contracts'

import { getAdminAppEnvironment } from '../src/config/env'

import './globals.css'

const appEnvironment = getAdminAppEnvironment()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  metadataBase: new URL(appEnvironment.origin),
  title: 'Dong Phu Gia Admin Application',
  description: 'Private staff application foundation for Dong Phu Gia.',
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body data-application={APPLICATIONS.admin.name}>{children}</body>
    </html>
  )
}
