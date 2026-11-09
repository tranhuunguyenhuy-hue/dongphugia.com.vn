import { notFound } from 'next/navigation'

import { requireActiveStaff } from '../../../src/auth/require-staff'
import { getAdminBlogCategories, getAdminBlogPost } from '../../../src/cms/queries'
import { AdminBlogEditor } from '../blog-editor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminBlogDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const staff = await requireActiveStaff()
  const canRead = staff.capabilities.includes('blog:read')
  if (!canRead) return <main className="admin-page"><h1>Không có quyền truy cập</h1><p className="admin-muted">Tài khoản chưa được cấp quyền xem bài viết.</p></main>
  const { id: rawId } = await params
  const isNew = rawId === 'new'
  const id = isNew ? null : Number(rawId)
  if (!isNew && (!Number.isSafeInteger(id) || id! < 1)) notFound()
  const [post, categories] = await Promise.all([
    id === null ? Promise.resolve(null) : getAdminBlogPost(id),
    getAdminBlogCategories(),
  ])
  if (id !== null && !post) notFound()
  if (!categories) return <main className="admin-page"><h1>Không tải được danh mục</h1><p className="admin-muted">Danh sách danh mục bài viết hiện không khả dụng.</p></main>
  return <AdminBlogEditor post={post} categories={categories}
    canWrite={staff.capabilities.includes('blog:write')}
    canPublish={staff.capabilities.includes('blog:publish')}
    searchParams={await searchParams} />
}
