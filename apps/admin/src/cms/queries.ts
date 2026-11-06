import 'server-only'

import { createAdminServerClient } from '../supabase/server'
import {
  parseAdminBlogCategories,
  parseAdminBlogPost,
  parseAdminBlogSummaries,
  parseAdminManagedContent,
} from './contracts'

export async function getAdminBlogSummaries(input: { status?: string | null; limit?: number; offset?: number } = {}) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('leo542_admin_blog_list', {
    p_limit: input.limit ?? 25,
    p_offset: input.offset ?? 0,
    p_status: input.status ?? null,
  })
  return error ? null : parseAdminBlogSummaries(data)
}

export async function getAdminBlogPost(id: number) {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('leo542_admin_blog_get', { p_post_id: id })
  return error ? null : parseAdminBlogPost(data)
}

export async function getAdminBlogCategories() {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('phase2_admin_blog_categories')
  return error ? null : parseAdminBlogCategories(data)
}

export async function getAdminManagedContent() {
  const client = await createAdminServerClient()
  const { data, error } = await client.schema('public').rpc('leo542_admin_content_snapshot')
  return error ? null : parseAdminManagedContent(data)
}
