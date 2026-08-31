import { APPLICATIONS } from '@dpg/app-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    { application: APPLICATIONS.admin.name, status: 'ok' },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
