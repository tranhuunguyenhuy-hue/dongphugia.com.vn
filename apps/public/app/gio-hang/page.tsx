import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Giỏ hàng',
  robots: { index: false, follow: false },
}

export const runtime = 'edge'

export { default } from '@/app/(public)/gio-hang/page'
