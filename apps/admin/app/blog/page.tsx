import Link from 'next/link'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { getAdminBlogSummaries } from '../../src/cms/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  published: 'Đã xuất bản',
  scheduled: 'Đang lên lịch',
  schedule_blocked: 'Lịch bị chặn',
}

export default async function AdminBlogPage({ searchParams }: {
  searchParams: Promise<{ status?: string; error?: string; saved?: string }>
}) {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('blog:read')) {
    return <main className="admin-page"><h1>Không có quyền truy cập</h1><p className="admin-muted">Tài khoản chưa được cấp quyền xem bài viết.</p></main>
  }
  const params = await searchParams
  const status = ['draft', 'published', 'scheduled', 'schedule_blocked'].includes(String(params.status)) ? params.status : null
  const posts = await getAdminBlogSummaries({ status, limit: 50 })
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div><p className="admin-eyebrow">CMS · Xuất bản</p><h1>Bài viết</h1><p className="admin-muted">Danh sách tối đa 50 bài viết gần cập nhật nhất.</p></div>
        {staff.capabilities.includes('blog:write') ? <Link className="admin-button" href="/blog/new">Tạo bài viết</Link> : null}
      </header>
      {params.saved ? <p className="admin-status-pill" role="status">Đã lưu thành công.</p> : null}
      {params.error === 'forbidden' ? <p className="admin-error" role="alert">Tài khoản không có quyền sửa bài viết.</p> : null}
      <nav className="admin-filter-row" aria-label="Lọc trạng thái bài viết">
        {[{ key: null, label: 'Tất cả' }, ...Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label }))].map((item) => (
          <Link key={item.key ?? 'all'} className={status === item.key ? 'admin-filter admin-filter-active' : 'admin-filter'}
            href={item.key ? `/blog?status=${item.key}` : '/blog'} aria-current={status === item.key ? 'page' : undefined}>{item.label}</Link>
        ))}
      </nav>
      {!posts ? <section className="admin-panel"><h2>Chưa tải được bài viết</h2><p className="admin-muted">Nguồn nội dung không khả dụng.</p></section> : posts.length === 0 ? (
        <section className="admin-panel admin-empty"><h2>Chưa có bài viết</h2></section>
      ) : (
        <section className="admin-panel" aria-label="Danh sách bài viết">
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Tiêu đề</th><th>Đường dẫn</th><th>Trạng thái</th><th>Phiên bản</th><th>Cập nhật</th><th /></tr></thead>
            <tbody>{posts.map((post) => <tr key={post.id}>
              <td>{post.title}</td><td>{post.slug}</td><td>{STATUS_LABELS[post.status]}</td><td>{post.version}</td>
              <td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(post.updated_at))}</td>
              <td><Link className="admin-link" href={`/blog/${post.id}`}>Chi tiết</Link></td>
            </tr>)}</tbody>
          </table></div>
        </section>
      )}
    </main>
  )
}
