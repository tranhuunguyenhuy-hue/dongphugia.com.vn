import { APPLICATIONS } from '@dpg/app-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  const sourceSha = process.env.BUILD_SOURCE_SHA?.trim()
  if (!sourceSha || !/^[0-9a-f]{40}$/.test(sourceSha)) {
    return Response.json(
      { application: APPLICATIONS.admin.name, status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  return Response.json(
    { application: APPLICATIONS.admin.name, status: 'ok', source_sha: sourceSha },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-DPG-Source-SHA': sourceSha,
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  )
}
