import Link from 'next/link'

import type { AdminBlogCategory, AdminBlogPost } from '../../src/cms/contracts'
import { saveAdminBlogPost } from './actions'

const ERROR_MESSAGES: Record<string, string> = {
  category: 'Danh mục bài viết không còn hoạt động hoặc không hợp lệ.',
  forbidden: 'Tài khoản không có quyền thực hiện thao tác này.',
  invalid: 'Hãy kiểm tra lại các trường bắt buộc, đường dẫn và độ dài nội dung.',
  retry: 'Khóa gửi đã được dùng với nội dung khác. Tải lại trang trước khi thử lại.',
  save: 'Chưa lưu được bài viết. Vui lòng thử lại.',
  stale: 'Bài viết đã được cập nhật ở phiên khác. Tải lại trước khi sửa.',
}

export function AdminBlogEditor({
  post,
  categories,
  canWrite,
  canPublish,
  searchParams,
}: {
  post: AdminBlogPost | null
  categories: AdminBlogCategory[]
  canWrite: boolean
  canPublish: boolean
  searchParams: { saved?: string; error?: string }
}) {
  const scheduled = post && (post.status === 'scheduled' || post.status === 'schedule_blocked')
  const publishedWriteDenied = post?.status === 'published' && !canPublish
  const canSubmit = canWrite && !publishedWriteDenied
  const categorySlug = categories.find((category) => category.id === post?.category_id)?.slug

  return (
    <main className="admin-page">
      <p className="admin-eyebrow"><Link className="admin-link" href="/blog">Bài viết</Link> / {post ? 'Chỉnh sửa' : 'Bài viết mới'}</p>
      <header className="admin-page-header">
        <div><p className="admin-eyebrow">CMS · Bài viết</p><h1>{post?.title || 'Tạo bài viết'}</h1>
          <p className="admin-muted">Bản Public lọc nội dung HTML trước khi hiển thị. Trạng thái xuất bản cần quyền riêng.</p></div>
        <Link href="/blog" className="admin-button admin-button-secondary">Quay lại danh sách</Link>
      </header>
      {searchParams.saved ? <p className="admin-status-pill" role="status">{searchParams.saved === 'created' ? 'Đã tạo bài viết.' : 'Đã lưu thay đổi.'}</p> : null}
      {searchParams.error ? <p className="admin-error" role="alert">{ERROR_MESSAGES[searchParams.error] ?? 'Không thể hoàn tất thao tác.'}</p> : null}
      {publishedWriteDenied ? <p className="admin-error" role="alert">Chỉnh sửa bài đang xuất bản cần quyền blog:publish.</p> : null}
      {!canWrite ? <p className="admin-error" role="alert">Tài khoản không có quyền sửa bài viết.</p> : null}
      {categories.length === 0 ? <p className="admin-error" role="alert">Chưa có danh mục bài viết đang hoạt động.</p> : null}

      {categories.length > 0 ? (
        <section className="admin-panel admin-form-section">
          <form action={saveAdminBlogPost} className="admin-form-section">
            <input type="hidden" name="postId" value={post?.id ?? ''} />
            <input type="hidden" name="version" value={post?.version ?? ''} />
            <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
            {scheduled ? <input type="hidden" name="status" value={post.status} /> : null}
            <div className="admin-field-grid">
              <label className="admin-field">Tiêu đề
                <input name="title" maxLength={300} defaultValue={post?.title ?? ''} required disabled={!canSubmit} />
              </label>
              <label className="admin-field">Đường dẫn
                <input name="slug" maxLength={300} defaultValue={post?.slug ?? ''} required disabled={!canSubmit} />
              </label>
              <label className="admin-field">Danh mục
                <select name="categoryId" defaultValue={post?.category_id ?? categories[0]?.id} required disabled={!canSubmit}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="admin-field">Trạng thái
                {scheduled ? <input value={post.status === 'scheduled' ? 'Đang lên lịch' : 'Lịch bị chặn'} disabled /> : (
                  <select name="status" defaultValue={post?.status ?? 'draft'} disabled={!canSubmit}>
                    <option value="draft">Bản nháp</option>
                    <option value="published" disabled={!canPublish}>Xuất bản</option>
                  </select>
                )}
              </label>
            </div>
            <label className="admin-field">Tóm tắt
              <textarea name="excerpt" maxLength={3000} rows={3} defaultValue={post?.excerpt ?? ''} disabled={!canSubmit} />
            </label>
            <label className="admin-field">Nội dung HTML
              <textarea name="content" maxLength={100000} rows={18} defaultValue={post?.content ?? ''} required disabled={!canSubmit} />
            </label>
            <div className="admin-field-grid">
              <label className="admin-field">Thumbnail URL
                <input name="thumbnailUrl" type="text" maxLength={1000} defaultValue={post?.thumbnail_url ?? ''} disabled={!canSubmit} />
              </label>
              <label className="admin-field">Ảnh bìa URL
                <input name="coverImageUrl" type="text" maxLength={1000} defaultValue={post?.cover_image_url ?? ''} disabled={!canSubmit} />
              </label>
              <label className="admin-field">SEO title
                <input name="seoTitle" maxLength={200} defaultValue={post?.seo_title ?? ''} disabled={!canSubmit} />
              </label>
              <label className="admin-field">SEO description
                <textarea name="seoDescription" maxLength={500} rows={3} defaultValue={post?.seo_description ?? ''} disabled={!canSubmit} />
              </label>
            </div>
            {post && categorySlug ? <p className="admin-muted">Public URL dự kiến: /blog/{categorySlug}/{post.slug}</p> : null}
            <div className="admin-button-row">
              <button className="admin-button" type="submit" disabled={!canSubmit || categories.length === 0}>Lưu bài viết</button>
              <span className="admin-muted">{post ? `Phiên bản ${post.version}` : 'Bản mới sẽ được lưu ở trạng thái nháp mặc định.'}</span>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  )
}
