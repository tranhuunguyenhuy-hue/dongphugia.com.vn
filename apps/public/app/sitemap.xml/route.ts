import { NAV_PRODUCT_CATEGORIES } from '@/config/site'

import { getPublicAppEnvironment } from '../../src/config/env'
import { PRIVATE_CACHE_CONTROL } from '../../src/worker-policy'

export const runtime = 'edge'

export function GET() {
  const appEnvironment = getPublicAppEnvironment()
  if (appEnvironment.previewNoindex) {
    return new Response('Not available on Preview.', {
      status: 404,
      headers: { 'Cache-Control': PRIVATE_CACHE_CONTROL, 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }

  const paths = ['/', '/lien-he', ...NAV_PRODUCT_CATEGORIES.map(({ href }) => href)]
  const urls = paths.map((path) => `  <url><loc>${appEnvironment.origin}${path}</loc></url>`).join('\n')
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`

  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=300, must-revalidate',
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
