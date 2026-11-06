import { APPLICATIONS } from '@dpg/app-contracts'
import Link from 'next/link'

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
        <p><Link href="/orders">Mở hàng đợi yêu cầu đặt hàng</Link></p>
      ) : null}
      {staff.capabilities.includes('audit:read') ? (
        <p><Link href="/audit">Mở nhật ký thao tác</Link></p>
      ) : null}
      {staff.capabilities.includes('products:read') ? (
        <p><Link href="/products">Mở danh mục sản phẩm</Link></p>
      ) : null}
      {staff.capabilities.includes('blog:read') ? (
        <p><Link href="/blog">Quản lý bài viết</Link></p>
      ) : null}
      {staff.capabilities.includes('categories:read') ? (
        <p><Link href="/content">Quản lý nội dung website</Link></p>
      ) : null}
      <Link href="/auth/logout">Đăng xuất</Link>
    </main>
  )
}
