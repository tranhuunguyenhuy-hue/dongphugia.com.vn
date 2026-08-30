import { getPublicAppEnvironment } from '../../src/config/env'

export const runtime = 'edge'

export function GET() {
  const appEnvironment = getPublicAppEnvironment()
  const body = appEnvironment.previewNoindex
    ? 'User-agent: *\nDisallow: /\n'
    : 'User-agent: *\nAllow: /\n'

  return new Response(body, {
    headers: {
      'Cache-Control': appEnvironment.previewNoindex
        ? 'private, no-store'
        : 'public, max-age=0, s-maxage=300, must-revalidate',
      'Content-Type': 'text/plain; charset=utf-8',
      ...(appEnvironment.previewNoindex
        ? { 'X-Robots-Tag': 'noindex, nofollow' }
        : {}),
    },
  })
}
