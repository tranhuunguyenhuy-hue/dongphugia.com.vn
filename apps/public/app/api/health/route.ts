import { APPLICATIONS } from '@dpg/app-contracts'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(
    { application: APPLICATIONS.public.name, status: 'ok' },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
