'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { allowedOrderRequestStatusTransitions, type OrderRequestStatus } from '../../src/orders/contracts'
import { updateGuestOrderStatus } from './actions'

const LABELS: Record<OrderRequestStatus, string> = {
  pending: 'Chờ nhân viên xử lý',
  received: 'Đã tiếp nhận',
  confirmed: 'Đã xác nhận với khách',
  inventory_check: 'Đang kiểm tra kho',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
}

export function OrderStatusEditor({
  orderId,
  status,
}: {
  orderId: number
  status: OrderRequestStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const retryKeys = useRef(new Map<OrderRequestStatus, string>())
  const nextStatuses = allowedOrderRequestStatusTransitions(status)

  if (nextStatuses.length === 0) {
    return <p className="admin-muted">Yêu cầu này không còn trạng thái cần xác nhận.</p>
  }

  function update(nextStatus: OrderRequestStatus) {
    const idempotencyKey = retryKeys.current.get(nextStatus) ?? window.crypto.randomUUID()
    retryKeys.current.set(nextStatus, idempotencyKey)
    setMessage('')
    startTransition(async () => {
      const result = await updateGuestOrderStatus({
        orderId,
        status: nextStatus,
        idempotencyKey,
      })
      if (!result.ok) {
        setMessage(result.message)
        return
      }
      retryKeys.current.delete(nextStatus)
      router.refresh()
    })
  }

  return (
    <div className="admin-status-actions" aria-busy={pending}>
      <p className="admin-muted">Trạng thái hiện tại: {LABELS[status]}</p>
      <div className="admin-button-row">
        {nextStatuses.map((nextStatus) => (
          <button
            key={nextStatus}
            type="button"
            className={nextStatus === 'cancelled' ? 'admin-button admin-button-secondary' : 'admin-button'}
            disabled={pending}
            onClick={() => update(nextStatus)}
          >
            {pending ? 'Đang cập nhật…' : LABELS[nextStatus]}
          </button>
        ))}
      </div>
      {message ? <p className="admin-error" role="alert">{message}</p> : null}
      <p className="admin-muted">Cập nhật trạng thái không thu tiền và không tự động xác nhận thanh toán.</p>
    </div>
  )
}
