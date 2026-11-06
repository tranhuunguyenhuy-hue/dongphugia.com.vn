'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import type { AdminOrderItem, OrderConfirmation, OrderRequestStatus } from '../../src/orders/contracts'
import { confirmGuestOrderCommercialTerms } from './actions'

function formatPrice(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount)
}

export function OrderConfirmationEditor({
  orderId,
  status,
  items,
  confirmation,
  editable,
}: {
  orderId: number
  status: OrderRequestStatus
  items: AdminOrderItem[]
  confirmation: OrderConfirmation | null
  editable: boolean
}) {
  const router = useRouter()
  const [shippingFee, setShippingFee] = useState('')
  const [installationFees, setInstallationFees] = useState<Record<number, string>>(() => Object.fromEntries(
    items.map((item) => [item.id, item.commercial_snapshot.install_option === 'none' ? '0' : '']),
  ))
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()
  const lastAttempt = useRef<{ signature: string; key: string } | null>(null)

  if (confirmation) {
    return (
      <section className="admin-panel" aria-label="Snapshot thương mại đã xác nhận">
        <h2>Giá cuối đã xác nhận</h2>
        <p><span>Phí vận chuyển</span> <strong>{formatPrice(confirmation.shipping_fee)}</strong></p>
        <ul>
          {confirmation.installation_fees.map((fee) => (
            <li key={fee.order_item_id}>{fee.product_sku}: {fee.install_option === 'none' ? 'Không lắp đặt' : formatPrice(fee.fee_per_unit)} / sản phẩm</li>
          ))}
        </ul>
        <p><span>Tổng tham khảo trước phí</span> <strong>{formatPrice(confirmation.base_total)}</strong></p>
        <p className="admin-total-row"><span>Tổng đã xác nhận</span> <strong>{formatPrice(confirmation.confirmed_total)}</strong></p>
        <p className="admin-muted">Snapshot được ghi lúc {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(confirmation.confirmed_at))}. Thanh toán vẫn chưa được xác nhận.</p>
      </section>
    )
  }

  if (!editable || status !== 'received') return null

  function submit() {
    const parsedShipping = Number(shippingFee)
    const fees = items.map((item) => ({
      orderItemId: item.id,
      feePerUnit: item.commercial_snapshot.install_option === 'none' ? 0 : Number(installationFees[item.id]),
    }))
    if (shippingFee.trim() === '' || items.some((item) =>
      item.commercial_snapshot.install_option !== 'none' && (installationFees[item.id] ?? '').trim() === '',
    ) || !Number.isSafeInteger(parsedShipping) || parsedShipping < 0 || fees.some((fee) => !Number.isSafeInteger(fee.feePerUnit) || fee.feePerUnit < 0)) {
      setMessage('Nhập rõ phí vận chuyển và phí lắp đặt bằng số nguyên không âm theo VND. Không để trống phí đang chờ xác nhận.')
      return
    }

    const signature = JSON.stringify({ orderId, shippingFee: parsedShipping, installationFees: fees })
    if (!lastAttempt.current || lastAttempt.current.signature !== signature) {
      lastAttempt.current = { signature, key: window.crypto.randomUUID() }
    }
    setMessage('')
    startTransition(async () => {
      const result = await confirmGuestOrderCommercialTerms({
        orderId,
        shippingFee: parsedShipping,
        installationFees: fees,
        idempotencyKey: lastAttempt.current!.key,
      })
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      lastAttempt.current = null
      router.refresh()
    })
  }

  return (
    <section className="admin-panel" aria-label="Xác nhận giá và phí">
      <h2>Chốt giá và phí trước khi xác nhận</h2>
      <p className="admin-muted">Đơn giá, ưu đãi và sản phẩm trong yêu cầu được giữ nguyên. Phí được lưu thành snapshot riêng; thao tác này không xác nhận thanh toán.</p>
      <label className="admin-form-field">
        <span>Phí vận chuyển (VND)</span>
        <input type="number" min="0" step="1000" inputMode="numeric" value={shippingFee} onChange={(event) => setShippingFee(event.target.value)} />
      </label>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Sản phẩm</th><th>Phương án</th><th>Phí lắp đặt / sản phẩm (VND)</th></tr></thead>
          <tbody>
            {items.map((item) => {
              const option = item.commercial_snapshot.install_option
              const hasInstall = option === 'install' || option === 'replace'
              return (
                <tr key={item.id}>
                  <td>{item.product_name} <small>{item.product_sku}</small></td>
                  <td>{option === 'install' ? 'Lắp mới' : option === 'replace' ? 'Thay thế' : 'Không lắp đặt'}</td>
                  <td>
                    <input
                      aria-label={`Phí lắp đặt ${item.product_sku}`}
                      type="number" min="0" step="1000" inputMode="numeric"
                      disabled={!hasInstall}
                      value={installationFees[item.id] ?? '0'}
                      onChange={(event) => setInstallationFees((current) => ({ ...current, [item.id]: event.target.value }))}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="admin-button" type="button" disabled={pending} onClick={submit}>
        {pending ? 'Đang lưu snapshot…' : 'Lưu snapshot và xác nhận yêu cầu'}
      </button>
      {message ? <p className="admin-error" role="alert">{message}</p> : null}
    </section>
  )
}
