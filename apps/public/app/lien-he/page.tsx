import type { Metadata } from 'next'

import { ContactForm } from '@/app/(public)/lien-he/contact-form'
import { getPublicAppEnvironment } from '../../src/config/env'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Liên Hệ Tư Vấn',
  description: 'Thông tin liên hệ Đông Phú Gia tại Đà Lạt.',
  alternates: { canonical: '/lien-he' },
  robots: getPublicAppEnvironment().previewNoindex
    ? { index: false, follow: false }
    : undefined,
}

export default function PublicContactPage() {
  return <ContactForm readOnly />
}
