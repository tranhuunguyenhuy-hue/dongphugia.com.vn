import type { Metadata } from 'next'

import { ContactSection } from '../../src/runtime/public-contact-section'
import { getPublicAppEnvironment } from '../../src/config/env'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Liên Hệ Tư Vấn',
  description: 'Thông tin liên hệ Đông Phú Gia tại Đà Lạt.',
  alternates: { canonical: '/lien-he' },
  robots: getPublicAppEnvironment().environment === 'production' ? { index: true, follow: true } : { index: false, follow: false },
}

export default function PreviewContactPage() {
  return <ContactSection asPage />
}
