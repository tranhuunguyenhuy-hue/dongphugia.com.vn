import { getAdminAppEnvironment } from '../../src/config/env'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export function GET() {
  getAdminAppEnvironment()

  return new Response('User-agent: *\nDisallow: /\n', {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}
