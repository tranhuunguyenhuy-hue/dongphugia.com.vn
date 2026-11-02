import type { Metadata } from 'next'

import { AboutClient } from '@/app/(public)/ve-chung-toi/about-client'
import { getPublicAppEnvironment } from '../../src/config/env'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Về chúng tôi',
  description: 'Thông tin về hành trình và giá trị của Đông Phú Gia tại Đà Lạt.',
  alternates: { canonical: '/ve-chung-toi' },
  robots: getPublicAppEnvironment().environment === 'production' ? { index: true, follow: true } : { index: false, follow: false },
}

export default function PreviewAboutPage() {
  return <AboutClient />
}
