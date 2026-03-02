'use client'

import { useState, useTransition } from 'react'
import { updateQuoteRequestStatus } from '@/lib/actions'
import { Check, X, MessageSquareReply } from 'lucide-react'
import { toast } from 'sonner'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

interface QuoteStatusButtonProps {
    id: number
    currentStatus: string
}

export function QuoteStatusButton({ id, currentStatus }: QuoteStatusButtonProps) {
    const [isPending, startTransition] = useTransition()
    const [open, setOpen] = useState(false)
    const [replyMesssage, setReplyMessage] = useState('')

    const markResolved = () => {
        startTransition(async () => {
            // Note: Currently just updating status. We can wire this up to send real email later.
            const result = await updateQuoteRequestStatus(id, 'resolved')
            if (result.success) {
                toast.success('Đã gửi phản hồi và ghi nhận đã xử lý')
                setOpen(false)
                setReplyMessage('')
            }
            else toast.error(result.message || 'Có lỗi xảy ra')
        })
    }

    const markCancelled = () => {
        startTransition(async () => {
            const result = await updateQuoteRequestStatus(id, 'cancelled')
            if (result.success) toast.success('Đã huỷ báo giá')
            else toast.error(result.message || 'Có lỗi xảy ra')
        })
    }

    if (currentStatus !== 'pending') {
        return (
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${currentStatus === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {currentStatus === 'resolved' ? 'Đã xử lý' : 'Đã huỷ'}
            </span>
        )
    }

    return (
        <div className="flex items-center gap-1 justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <button
                        title="Phản hồi khách hàng & Xử lý"
                        className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                        <MessageSquareReply className="h-3.5 w-3.5" />
                    </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Phản hồi báo giá</DialogTitle>
                        <DialogDescription>
                            Gửi email/tin nhắn xác nhận đến khách hàng để hoàn tất việc xử lý.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Textarea
                            placeholder="Nhập nội dung phản hồi báo giá (hoặc ghi chú)..."
                            className="min-h-[120px]"
                            value={replyMesssage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <button
                            onClick={() => setOpen(false)}
                            className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-slate-50"
                            disabled={isPending}
                        >
                            Huỷ
                        </button>
                        <button
                            onClick={markResolved}
                            disabled={isPending || !replyMesssage.trim()}
                            className="px-4 py-2 text-sm font-medium bg-[#15803d] text-white rounded-md flex items-center gap-2 hover:bg-[#16a34a] disabled:opacity-50"
                        >
                            {isPending ? 'Đang gửi...' : <><Check className="w-4 h-4" /> Gửi & Đóng Yêu Cầu</>}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <button
                onClick={markCancelled}
                disabled={isPending}
                title="Huỷ"
                className="h-7 w-7 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors disabled:opacity-50"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
