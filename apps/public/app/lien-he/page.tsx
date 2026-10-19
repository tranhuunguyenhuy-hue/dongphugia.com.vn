import type { Metadata } from 'next'

import { ContactForm } from '@/app/(public)/lien-he/contact-form'

export const runtime = 'edge'

export const metadata: Metadata = {
  title: 'Liên Hệ Tư Vấn',
  description: 'Thông tin liên hệ Đông Phú Gia tại Đà Lạt.',
  alternates: { canonical: '/lien-he' },
  robots: { index: false, follow: false },
}

export default function PreviewContactPage() {
  return <ContactForm readOnly />
}
