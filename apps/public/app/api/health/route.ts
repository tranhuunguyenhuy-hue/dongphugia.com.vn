import { APPLICATIONS } from '@dpg/app-contracts'

import { getPublicAppEnvironment } from '../../../src/config/env'
import { PUBLIC_PREVIEW_ROBOTS_HEADER } from '../../../src/worker-policy'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export function GET() {
  const appEnvironment = getPublicAppEnvironment()
  return Response.json(
    { application: APPLICATIONS.public.name, status: 'ok' },
    {
      headers: {
        'Cache-Control': 'private, no-store',
        ...(appEnvironment.previewNoindex
          ? { 'X-Robots-Tag': PUBLIC_PREVIEW_ROBOTS_HEADER }
          : {}),
      },
    },
  )
}
