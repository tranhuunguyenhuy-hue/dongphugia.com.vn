import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireActiveStaff } from '../../../src/auth/require-staff'
import { getGuestOrder } from '../../../src/orders/queries'
import { parseOrderRequestStatus } from '../../../src/orders/contracts'
import { OrderStatusEditor } from '../order-status-editor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

export default async function AdminGuestOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('orders:read') && !staff.capabilities.includes('orders:read_assigned')) notFound()

  const { id: rawId } = await params
  const orderId = Number(rawId)
  if (!Number.isSafeInteger(orderId) || orderId < 1) notFound()
  const result = await getGuestOrder(orderId)
  if (!result) notFound()

  const { order, items } = result
  const status = parseOrderRequestStatus(order.status)
  if (!status) notFound()
  const canUpdate = staff.capabilities.includes('orders:update_status')

  return (
    <main className="admin-page">
      <p className="admin-eyebrow"><Link className="admin-link" href="/orders">Yêu cầu đặt hàng</Link> / Chi tiết</p>
      <header className="admin-page-header">
        <div>
          <h1>{order.order_number}</h1>
          <p className="admin-muted">Yêu cầu đang chờ trao đổi với khách. Chưa phải đơn đã thanh toán.</p>
        </div>
        <Link href="/orders" className="admin-button admin-button-secondary">Quay lại danh sách</Link>
      </header>

      <div className="admin-detail-grid">
        <section className="admin-panel">
          <h2>Thông tin khách hàng</h2>
          <dl className="admin-definition-list">
            <div><dt>Họ tên</dt><dd>{order.customer_name}</dd></div>
            <div><dt>Điện thoại</dt><dd><a className="admin-link" href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></dd></div>
            {order.customer_email ? <div><dt>Email</dt><dd><a className="admin-link" href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd></div> : null}
            {order.customer_address ? <div><dt>Địa chỉ nhận hàng</dt><dd>{order.customer_address}</dd></div> : null}
            {order.note ? <div><dt>Ghi chú của khách</dt><dd>{order.note}</dd></div> : null}
          </dl>
        </section>

        <section className="admin-panel">
          <h2>Xử lý yêu cầu</h2>
          {canUpdate ? <OrderStatusEditor orderId={order.id} status={status} /> : <p className="admin-muted">Bạn có quyền xem yêu cầu được phân công nhưng không có quyền cập nhật trạng thái.</p>}
          <p className="admin-muted">Thanh toán: {order.payment_status === 'unpaid' ? 'Chưa thanh toán' : order.payment_status}</p>
          <p className="admin-muted">Mọi xác nhận thương mại và thanh toán cần được trao đổi riêng với khách.</p>
        </section>

        <section className="admin-panel admin-detail-wide">
          <h2>Sản phẩm khách yêu cầu</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Sản phẩm</th><th>SKU</th><th>Số lượng</th><th>Giá tại thời điểm gửi</th><th>Tạm tính</th></tr></thead>
              <tbody>
                {items.map((item) => {
                  const finalUnitPrice = Number(item.commercial_snapshot.final_unit_price)
                  const hasSnapshotPrice = Number.isFinite(finalUnitPrice) && finalUnitPrice > 0
                  return (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td>{item.product_sku}</td>
                      <td>{item.quantity}</td>
                      <td>{hasSnapshotPrice ? formatPrice(finalUnitPrice) : formatPrice(item.unit_price)}</td>
                      <td>{formatPrice(item.total_price)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-order-totals">
            <p><span>Tạm tính</span><strong>{formatPrice(order.subtotal)}</strong></p>
            <p><span>Ưu đãi online tham khảo</span><strong>{formatPrice(order.discount)}</strong></p>
            <p><span>Phí vận chuyển</span><strong>{formatPrice(order.shipping_fee)}</strong></p>
            <p className="admin-total-row"><span>Tổng tham khảo</span><strong>{formatPrice(order.total)}</strong></p>
          </div>
        </section>
      </div>
    </main>
  )
}
