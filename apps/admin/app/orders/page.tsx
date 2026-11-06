import Link from 'next/link'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { ORDER_REQUEST_STATUSES, parseOrderRequestStatus, parseOrderSearchQuery } from '../../src/orders/contracts'
import { getOrderInbox } from '../../src/orders/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<(typeof ORDER_REQUEST_STATUSES)[number], string> = {
  pending: 'Chờ xử lý',
  received: 'Đã tiếp nhận',
  confirmed: 'Đã xác nhận',
  inventory_check: 'Kiểm tra kho',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

const STATUS_FILTERS = [
  { value: '', label: 'Tất cả yêu cầu' },
  ...ORDER_REQUEST_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
]

function formatPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default async function AdminOrderInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; q?: string }>
}) {
  const staff = await requireActiveStaff()
  const canReadOrders = staff.capabilities.includes('orders:read') || staff.capabilities.includes('orders:read_assigned')
  if (!canReadOrders) {
    return <main className="admin-page"><h1>Không có quyền truy cập</h1><p>Bạn chưa được cấp quyền xem yêu cầu đặt hàng.</p></main>
  }

  const params = await searchParams
  const status = params.status ? parseOrderRequestStatus(params.status) : null
  const search = parseOrderSearchQuery(params.q)
  const requestedPage = Number(params.page || 1)
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, 401)) : 1
  const pageSize = 25
  const result = search.error ? null : await getOrderInbox({ status, search: search.value, limit: pageSize, offset: (page - 1) * pageSize })
  const selectedStatus = status ?? ''
  const query = new URLSearchParams()
  if (selectedStatus) query.set('status', selectedStatus)
  if (search.value) query.set('q', search.value)
  const queryPrefix = query.toString()
  const filteredPath = `/orders?${queryPrefix ? `${queryPrefix}&` : ''}`
  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Bán hàng</p>
          <h1>Yêu cầu đặt hàng</h1>
          <p className="admin-muted">Khách gửi yêu cầu; nhân viên xác nhận lại giá, tồn kho và thông tin giao nhận.</p>
        </div>
        <Link href="/" className="admin-link">Về trang tổng quan</Link>
      </header>

      <nav className="admin-filter-row" aria-label="Lọc trạng thái yêu cầu">
        {STATUS_FILTERS.map((filter) => {
          const active = selectedStatus === filter.value
          const nextQuery = new URLSearchParams()
          if (filter.value) nextQuery.set('status', filter.value)
          if (search.value) nextQuery.set('q', search.value)
          const serialized = nextQuery.toString()
          const href = serialized ? `/orders?${serialized}` : '/orders'
          return <Link key={filter.value} href={href} aria-current={active ? 'page' : undefined} className={active ? 'admin-filter admin-filter-active' : 'admin-filter'}>{filter.label}</Link>
        })}
      </nav>

      <form action="/orders" method="get" className="admin-search-form" role="search">
        {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
        <label htmlFor="order-search">Tìm theo mã tiếp nhận, tên hoặc số điện thoại</label>
        <div className="admin-search-controls">
          <input id="order-search" name="q" type="search" maxLength={100} value={search.value} placeholder="Ví dụ: DPG-…, Nguyễn Văn A" />
          <button className="admin-button" type="submit">Tìm kiếm</button>
          {search.value ? <Link className="admin-button admin-button-secondary" href={selectedStatus ? `/orders?status=${selectedStatus}` : '/orders'}>Xóa lọc</Link> : null}
        </div>
        {search.error ? <p className="admin-error" role="alert">{search.error}</p> : null}
      </form>

      {search.error ? (
        <section className="admin-panel"><h2>Từ khóa chưa hợp lệ</h2><p className="admin-muted">Hãy rút gọn từ khóa còn tối đa 100 ký tự và thử lại.</p></section>
      ) : !result ? (
        <section className="admin-panel"><h2>Chưa tải được danh sách</h2><p className="admin-muted">Hàng đợi chưa khả dụng. Vui lòng thử tải lại sau.</p></section>
      ) : result.orders.length === 0 ? (
        <section className="admin-panel admin-empty"><h2>Chưa có yêu cầu phù hợp</h2><p className="admin-muted">Các yêu cầu mới từ Public sẽ xuất hiện tại đây.</p></section>
      ) : (
        <section className="admin-panel" aria-label="Danh sách yêu cầu đặt hàng">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Mã tiếp nhận</th><th>Khách hàng</th><th>Liên hệ</th><th>Trạng thái</th><th>Tạm tính tham khảo</th><th>Ngày gửi</th><th /></tr></thead>
              <tbody>
                {result.orders.map((order) => (
                  <tr key={order.id}>
                    <td><Link className="admin-link admin-order-number" href={`/orders/${order.id}`}>{order.order_number}</Link></td>
                    <td>{order.customer_name}</td>
                    <td><a className="admin-link" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></td>
                    <td><span className="admin-status-pill">{STATUS_LABELS[order.status]}</span></td>
                    <td>{formatPrice(order.total)}</td>
                    <td>{formatDate(order.created_at)}</td>
                    <td><Link className="admin-link" href={`/orders/${order.id}`}>Chi tiết</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="admin-table-footer">
            <span>Hiển thị {result.orders.length} / {result.total} yêu cầu</span>
            <div className="admin-button-row">
              {page > 1 ? <Link className="admin-button admin-button-secondary" href={`${filteredPath}page=${page - 1}`}>Trước</Link> : null}
              <span>Trang {page} / {totalPages}</span>
              {page < totalPages ? <Link className="admin-button admin-button-secondary" href={`${filteredPath}page=${page + 1}`}>Sau</Link> : null}
            </div>
          </footer>
        </section>
      )}
    </main>
  )
}
