import { publicPostgresEnabled, readPublicRows } from '../../../src/runtime/public-db'
import { usesPublicSnapshot, usesProductionPublishedCatalogue } from '../../../src/runtime/public-snapshot-mode'
import { readSnapshotManifest } from '../../../src/runtime/public-snapshot-catalogue'
import { APPLICATIONS } from '@dpg/app-contracts'

import { getPublicAppEnvironment } from '../../../src/config/env'
import { PUBLIC_PREVIEW_ROBOTS_HEADER } from '../../../src/worker-policy'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET() {
  const appEnvironment = getPublicAppEnvironment()
  const productionPublishedCatalogue = usesProductionPublishedCatalogue()
  let snapshot: { checkpoint: string; products: number; listingProducts: number; m3RunId: string } | null = null
  if (publicPostgresEnabled()) {
    try {
      const [row] = await readPublicRows<{public_products:string;listing_products:string;blog_posts:string}>(
        "SELECT (SELECT count(p.id) FROM dpg_app.products p"
        + " JOIN dpg_app.categories c ON c.id=p.category_id AND c.is_active=true AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
        + " JOIN dpg_app.subcategories s ON s.id=p.subcategory_id AND s.category_id=c.id AND s.is_active=true AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
        + " WHERE p.is_active=true AND p.publication_status='public' AND p.pdp_visibility='public'"
        + " AND p.id>0 AND p.name<>'' AND char_length(p.name)<=240 AND p.sku<>'' AND char_length(p.sku)<=120"
        + " AND p.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$') AS public_products,"
        + "(SELECT count(p.id) FROM dpg_app.products p"
        + " JOIN dpg_app.categories c ON c.id=p.category_id AND c.is_active=true AND c.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
        + " JOIN dpg_app.subcategories s ON s.id=p.subcategory_id AND s.category_id=c.id AND s.is_active=true AND s.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
        + " WHERE p.is_active=true AND p.publication_status='public' AND p.pdp_visibility='public'"
        + " AND p.id>0 AND p.name<>'' AND char_length(p.name)<=240 AND p.sku<>'' AND char_length(p.sku)<=120"
        + " AND p.slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND p.listing_visibility IN ('default','low_priority')) AS listing_products,"
        + "(SELECT count(b.id) FROM dpg_app.blog_posts b JOIN dpg_app.blog_categories c ON c.id=b.category_id"
        + " WHERE b.status='published' AND b.published_at IS NOT NULL AND c.is_active=true) AS blog_posts",
      )
      return Response.json({application:APPLICATIONS.public.name,status:'ok',catalogueMode:'postgresql',
        publicProducts:Number(row?.public_products??0),listingProducts:Number(row?.listing_products??0),
        publishedBlogs:Number(row?.blog_posts??0)}, {headers:{'Cache-Control':'private, no-store'}})
    } catch {
      return Response.json({application:APPLICATIONS.public.name,status:'unavailable',catalogueMode:'postgresql'},
        {status:503,headers:{'Cache-Control':'private, no-store'}})
    }
  }
  if (usesPublicSnapshot()) {
    try { snapshot = await readSnapshotManifest() }
    catch { return Response.json({
      application:APPLICATIONS.public.name,
      status:'unavailable',
      catalogueMode:productionPublishedCatalogue ? 'production-published-public-catalogue' : 'verified-snapshot',
    },{status:503,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':PUBLIC_PREVIEW_ROBOTS_HEADER}}) }
  }
  return Response.json(
    {
      application: APPLICATIONS.public.name,
      status: 'ok',
      catalogueMode: snapshot
        ? productionPublishedCatalogue ? 'production-published-public-catalogue' : 'verified-snapshot'
        : 'synthetic-fixture',
      ...(snapshot ? {
        catalogueCheckpoint:snapshot.checkpoint,
        publicProducts:snapshot.products,
        listingProducts:snapshot.listingProducts,
        m3RunId:snapshot.m3RunId,
      } : {}),
    },
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
