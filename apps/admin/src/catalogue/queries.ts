import 'server-only'

import { createAdminServerClient } from '../supabase/server'
import { parseAdminProductCatalogue } from './contracts'

export async function getAdminProductCatalogue(input: {
  productId?: number | null
  search?: string
  publicationStatus?: string | null
  limit?: number
  offset?: number
}) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('phase2_admin_product_catalogue', {
    p_product_id: input.productId ?? null,
    p_search: input.search ?? '',
    p_publication_status: input.publicationStatus ?? null,
    p_limit: input.limit ?? 25,
    p_offset: input.offset ?? 0,
  })
  if (error) return null
  return parseAdminProductCatalogue(data)
}
