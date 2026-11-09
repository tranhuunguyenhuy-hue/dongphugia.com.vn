import { APPLICATIONS } from '@dpg/app-contracts'

import { requireActiveStaff } from '../src/auth/require-staff'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminFoundationPage() {
  const staff = await requireActiveStaff()

  return (
    <main data-application={APPLICATIONS.admin.name} data-route-owner="admin">
      <h1>Dong Phu Gia Admin Application</h1>
      <p>Xin chào {staff.display_name}. Phiên Admin đang hoạt động.</p>
      <p>{staff.email}</p>
      <p>Vai trò: {staff.roles.join(', ') || 'chưa gán'}</p>
      <p>Quyền hiện hành: {staff.capabilities.length}</p>
      {staff.capabilities.includes('orders:read') || staff.capabilities.includes('orders:read_assigned') ? (
        <p><a href="/orders">Mở hàng đợi yêu cầu đặt hàng</a></p>
      ) : null}
      {staff.capabilities.includes('audit:read') ? (
        <p><a href="/audit">Mở nhật ký thao tác</a></p>
      ) : null}
      <a href="/auth/logout">Đăng xuất</a>
    </main>
  )
}
