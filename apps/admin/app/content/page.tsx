import { requireActiveStaff } from '../../src/auth/require-staff'
import { getAdminManagedContent } from '../../src/cms/queries'
import { updateAdminContent } from '../blog/actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function ReadOnlyValue({ label, value }: { label: string; value: string | null }) {
  return <p className="admin-muted"><strong>{label}:</strong> {value || '—'}</p>
}

function SortOrder({ value }: { value: number | null }) {
  return <label className="admin-field">Thứ tự
    <input name="sortOrder" type="number" min="0" max="100000" step="1" defaultValue={value ?? 0} required />
  </label>
}

export default async function AdminContentPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('categories:read')) {
    return <main className="admin-page"><h1>Không có quyền truy cập</h1><p className="admin-muted">Tài khoản chưa được cấp quyền xem nội dung website.</p></main>
  }
  const [content, params] = await Promise.all([getAdminManagedContent(), searchParams])
  const canWrite = staff.capabilities.includes('categories:write')
  if (!content) return <main className="admin-page"><h1>Nội dung website</h1><section className="admin-panel"><p className="admin-muted">Chưa tải được nội dung.</p></section></main>

  return (
    <main className="admin-page">
      <header className="admin-page-header"><div><p className="admin-eyebrow">CMS · Nội dung website</p><h1>Nội dung website</h1>
        <p className="admin-muted">Quản lý trạng thái và thứ tự của banner, đối tác, dự án. Ảnh và liên kết đang ở chế độ chỉ xem.</p></div></header>
      {params.saved ? <p className="admin-status-pill" role="status">Đã lưu thay đổi.</p> : null}
      {params.error ? <p className="admin-error" role="alert">{params.error === 'forbidden' ? 'Tài khoản không có quyền sửa nội dung.' : 'Chưa cập nhật được nội dung.'}</p> : null}
      {!canWrite ? <p className="admin-muted">Tài khoản chỉ có quyền đọc.</p> : null}

      <section className="admin-panel admin-form-section" aria-label="Banner">
        <div><h2>Banner</h2><p className="admin-muted">Ảnh và liên kết hiện tại được giữ nguyên.</p></div>
        {content.banners.length === 0 ? <p className="admin-muted">Không có banner.</p> : content.banners.map((banner) => (
          <article className="admin-content-row" key={banner.id}>
            <div><h3>{banner.title || `Banner #${banner.id}`}</h3><ReadOnlyValue label="Ảnh" value={banner.image_url} /><ReadOnlyValue label="Liên kết" value={banner.link_url} /></div>
            {canWrite ? <form action={updateAdminContent} className="admin-content-fields">
              <input type="hidden" name="resource" value="banner" /><input type="hidden" name="id" value={banner.id} />
              <label className="admin-field">Tiêu đề<input name="title" maxLength={200} defaultValue={banner.title ?? ''} /></label>
              <SortOrder value={banner.sort_order} />
              <label className="admin-field-checkbox"><input name="isActive" type="checkbox" defaultChecked={banner.is_active} /> Đang hoạt động</label>
              <button className="admin-button" type="submit">Lưu banner</button>
            </form> : <ReadOnlyValue label="Trạng thái" value={banner.is_active ? 'Đang hoạt động' : 'Đã ẩn'} />}
          </article>
        ))}
      </section>

      <section className="admin-panel admin-form-section" aria-label="Đối tác">
        <div><h2>Đối tác</h2><p className="admin-muted">Logo và liên kết hiện tại được giữ nguyên.</p></div>
        {content.partners.length === 0 ? <p className="admin-muted">Không có đối tác.</p> : content.partners.map((partner) => (
          <article className="admin-content-row" key={partner.id}>
            <div><h3>{partner.name}</h3><ReadOnlyValue label="Logo" value={partner.logo_url} /><ReadOnlyValue label="Liên kết" value={partner.link_url} /></div>
            {canWrite ? <form action={updateAdminContent} className="admin-content-fields">
              <input type="hidden" name="resource" value="partner" /><input type="hidden" name="id" value={partner.id} />
              <label className="admin-field">Tên đối tác<input name="title" maxLength={200} defaultValue={partner.name} required /></label>
              <SortOrder value={partner.sort_order} />
              <label className="admin-field-checkbox"><input name="isActive" type="checkbox" defaultChecked={partner.is_active ?? false} /> Đang hoạt động</label>
              <button className="admin-button" type="submit">Lưu đối tác</button>
            </form> : <ReadOnlyValue label="Trạng thái" value={partner.is_active ? 'Đang hoạt động' : 'Đã ẩn'} />}
          </article>
        ))}
      </section>

      <section className="admin-panel admin-form-section" aria-label="Dự án">
        <div><h2>Dự án</h2><p className="admin-muted">Ảnh dự án hiện tại được giữ nguyên.</p></div>
        {content.projects.length === 0 ? <p className="admin-muted">Không có dự án.</p> : content.projects.map((project) => (
          <article className="admin-content-row" key={project.id}>
            <div><h3>{project.title}</h3><ReadOnlyValue label="Ảnh" value={project.thumbnail_url} /></div>
            {canWrite ? <form action={updateAdminContent} className="admin-content-fields">
              <input type="hidden" name="resource" value="project" /><input type="hidden" name="id" value={project.id} />
              <label className="admin-field">Tiêu đề<input name="title" maxLength={200} defaultValue={project.title} required /></label>
              <SortOrder value={project.sort_order} />
              <label className="admin-field-checkbox"><input name="isActive" type="checkbox" defaultChecked={project.is_active ?? false} /> Đang hoạt động</label>
              <label className="admin-field-checkbox"><input name="isFeatured" type="checkbox" defaultChecked={project.is_featured ?? false} /> Nổi bật</label>
              <button className="admin-button" type="submit">Lưu dự án</button>
            </form> : <ReadOnlyValue label="Trạng thái" value={project.is_active ? 'Đang hoạt động' : 'Đã ẩn'} />}
          </article>
        ))}
      </section>
      <p className="admin-muted">Không có newsletter/form liên hệ trong CMS vì chưa có backend gửi nhận tương ứng.</p>
    </main>
  )
}
