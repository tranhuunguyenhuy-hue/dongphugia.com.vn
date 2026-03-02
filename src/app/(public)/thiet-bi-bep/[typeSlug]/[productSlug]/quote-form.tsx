'use client'

import { useActionState } from 'react'
import { submitQuoteRequest } from '@/lib/actions'
import { CheckCircle2, Loader2, Phone } from 'lucide-react'

interface QuoteFormProps {
    productId: number
    productName: string
}

type QuoteState = {
    success: boolean
    message?: string
    errors?: Record<string, string[]>
}

const initialState: QuoteState = { success: false }

export function QuoteForm({ productId, productName }: QuoteFormProps) {
    const [state, formAction, pending] = useActionState<QuoteState, FormData>(
        submitQuoteRequest as any,
        initialState
    )

    if (state.success) {
        return (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-[#15803d]" />
                <h3 className="text-lg font-semibold text-[#0f172a]">Gửi yêu cầu thành công!</h3>
                <p className="text-[#64748b] text-sm max-w-xs">{state.message}</p>
            </div>
        )
    }

    return (
        <form action={formAction} className="flex flex-col gap-4">
            {/* Adding BEP prefix inside message to distincuate later if needed */}
            <input type="hidden" name="product_id" value={productId} />

            <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-[#374151]">
                    Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    className="h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d] transition-colors"
                />
                {state.errors?.name && <p className="text-xs text-red-500">{state.errors.name[0]}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-sm font-medium text-[#374151]">
                    Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="0912 345 678"
                    className="h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d] transition-colors"
                />
                {state.errors?.phone && <p className="text-xs text-red-500">{state.errors.phone[0]}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#374151]">
                    Email <span className="text-[#94a3b8] font-normal text-xs">(không bắt buộc)</span>
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    className="h-10 px-3 rounded-lg border border-[#e2e8f0] text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d] transition-colors"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="message" className="text-sm font-medium text-[#374151]">
                    Ghi chú <span className="text-[#94a3b8] font-normal text-xs">(không bắt buộc)</span>
                </label>
                <textarea
                    id="message"
                    name="message"
                    rows={3}
                    placeholder={`Tôi muốn hỏi về ${productName}...`}
                    className="px-3 py-2 rounded-lg border border-[#e2e8f0] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d] transition-colors"
                />
            </div>

            {state.message && !state.success && (
                <p className="text-sm text-red-500 text-center">{state.message}</p>
            )}

            <button
                type="submit"
                disabled={pending}
                className="w-full h-12 rounded-xl bg-[#15803d] hover:bg-[#14532d] text-white font-semibold text-base transition-colors disabled:opacity-70 flex items-center justify-center gap-2 press-effect"
            >
                {pending ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Đang gửi...</>
                ) : (
                    <><Phone className="h-5 w-5" /> Yêu cầu báo giá</>
                )}
            </button>
        </form>
    )
}
