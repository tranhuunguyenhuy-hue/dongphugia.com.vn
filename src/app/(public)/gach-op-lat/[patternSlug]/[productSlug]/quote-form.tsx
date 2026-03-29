'use client'

import { useActionState, useEffect } from 'react'
import { submitQuoteRequest } from '@/lib/actions'
import { CheckCircle2, Loader2, Phone } from 'lucide-react'
import { toast } from 'sonner'

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

    useEffect(() => {
        if (state.success) {
            toast.success(state.message || 'Gửi yêu cầu thành công!');
        } else if (state.message) {
            toast.error(state.message);
        }
    }, [state]);

    if (state.success) {
        return (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-[#2E7A96]" />
                <h3 className="text-lg font-semibold text-[#192125]">Gửi yêu cầu thành công!</h3>
                <p className="text-[#6A8A97] text-sm max-w-xs">{state.message}</p>
            </div>
        )
    }

    return (
        <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="product_id" value={productId} />

            <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-medium text-[#3C4E56]">
                    Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    className="h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7A96]/30 focus:border-[#2E7A96] transition-colors"
                />
                {state.errors?.name && <p className="text-xs text-red-500">{state.errors.name[0]}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="phone" className="text-sm font-medium text-[#3C4E56]">
                    Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="0912 345 678"
                    className="h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7A96]/30 focus:border-[#2E7A96] transition-colors"
                />
                {state.errors?.phone && <p className="text-xs text-red-500">{state.errors.phone[0]}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#3C4E56]">
                    Email <span className="text-[#88A3AE] font-normal text-xs">(không bắt buộc)</span>
                </label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="email@example.com"
                    className="h-10 px-3 rounded-lg border border-[#E4EEF2] text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7A96]/30 focus:border-[#2E7A96] transition-colors"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="message" className="text-sm font-medium text-[#3C4E56]">
                    Ghi chú <span className="text-[#88A3AE] font-normal text-xs">(không bắt buộc)</span>
                </label>
                <textarea
                    id="message"
                    name="message"
                    rows={3}
                    placeholder={`Tôi muốn hỏi về ${productName}...`}
                    className="px-3 py-2 rounded-lg border border-[#E4EEF2] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E7A96]/30 focus:border-[#2E7A96] transition-colors"
                />
            </div>

            {state.message && !state.success && (
                <p className="text-sm text-red-500 text-center">{state.message}</p>
            )}

            <button
                type="submit"
                disabled={pending}
                className="w-full h-12 rounded-xl bg-[#2E7A96] hover:bg-[#0F2E3A] text-white font-semibold text-base transition-colors disabled:opacity-70 flex items-center justify-center gap-2 press-effect"
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
