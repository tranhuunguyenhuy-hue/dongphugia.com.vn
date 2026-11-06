import Link from 'next/link'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { getAdminAuditEvents } from '../../src/audit/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default async function AdminAuditPage() {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('audit:read')) {
    return <main className="admin-page"><h1>Không có quyền truy cập</h1><p className="admin-muted">Tài khoản chưa được cấp quyền xem nhật ký.</p></main>
  }

  const events = await getAdminAuditEvents()
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div><p className="admin-eyebrow">Quản trị</p><h1>Nhật ký thao tác</h1><p className="admin-muted">50 thay đổi gần nhất do nhân viên thực hiện.</p></div>
        <Link href="/" className="admin-link">Về trang tổng quan</Link>
      </header>
      {!events ? (
        <section className="admin-panel"><h2>Chưa tải được nhật ký</h2><p className="admin-muted">Không có dữ liệu được hiển thị khi nguồn nhật ký không khả dụng.</p></section>
      ) : events.length === 0 ? (
        <section className="admin-panel admin-empty"><h2>Chưa có thao tác</h2><p className="admin-muted">Các thay đổi đã ghi audit sẽ xuất hiện tại đây.</p></section>
      ) : (
        <section className="admin-panel" aria-label="Nhật ký Admin">
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Thời gian</th><th>Thao tác</th><th>Đối tượng</th><th>ID</th><th>Trường thay đổi</th><th>Request</th></tr></thead>
            <tbody>{events.map((event) => <tr key={event.id}>
              <td>{formatDate(event.created_at)}</td><td>{event.action}</td><td>{event.entity_type}</td><td>{event.entity_id}</td>
              <td>{event.changed_fields.join(', ') || '—'}</td><td>{event.request_id ?? '—'}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
      )}
    </main>
  )
}
