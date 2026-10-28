import { usesPublicSnapshot, publicSnapshotCheckpoint } from '../../../src/runtime/public-snapshot-mode'
import { readSnapshotManifest } from '../../../src/runtime/public-snapshot-catalogue'
import { APPLICATIONS } from '@dpg/app-contracts'

import { getPublicAppEnvironment } from '../../../src/config/env'
import { PUBLIC_PREVIEW_ROBOTS_HEADER } from '../../../src/worker-policy'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const appEnvironment = getPublicAppEnvironment()
  let snapshot: { products: number; listingProducts: number; m3RunId: string } | null = null
  if (usesPublicSnapshot()) {
    try { snapshot = await readSnapshotManifest() }
    catch { return Response.json({application:APPLICATIONS.public.name,status:'unavailable',catalogueMode:'verified-snapshot'},{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':PUBLIC_PREVIEW_ROBOTS_HEADER}}) }
  }
  return Response.json(
    { application: APPLICATIONS.public.name, status: 'ok', catalogueMode: snapshot ? 'verified-snapshot' : 'synthetic-fixture',
      ...(snapshot ? {catalogueCheckpoint:publicSnapshotCheckpoint(),publicProducts:snapshot.products,listingProducts:snapshot.listingProducts,m3RunId:snapshot.m3RunId} : {}) },
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
