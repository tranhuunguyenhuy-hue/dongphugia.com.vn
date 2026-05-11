'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronsUpDown, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { assignOrder } from '@/lib/order-actions'

export function OrderAssignSelect({
    orderId,
    currentAssigneeId,
    staffMembers
}: {
    orderId: number
    currentAssigneeId: number | null
    staffMembers: { id: number; name: string; email: string; role: string }[]
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const selectedStaff = staffMembers.find((s) => s.id === currentAssigneeId)

    const handleAssign = async (userId: number | null) => {
        setOpen(false)
        if (userId === currentAssigneeId) return

        setLoading(true)
        const res = await assignOrder(orderId, userId)
        if (res.success) {
            toast.success("Cập nhật người phụ trách thành công")
            router.refresh()
        } else {
            toast.error(res.error || "Không thể cập nhật người phụ trách")
        }
        setLoading(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={loading}
                    className="w-full justify-between"
                >
                    {selectedStaff ? (
                        <div className="flex items-center gap-2 truncate">
                            <span className="font-medium truncate">{selectedStaff.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <UserPlus className="h-4 w-4" />
                            <span>Chưa phân công</span>
                        </div>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Tìm nhân viên..." />
                    <CommandList>
                        <CommandEmpty>Không tìm thấy nhân viên.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="unassigned"
                                onSelect={() => handleAssign(null)}
                                className="text-muted-foreground"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        currentAssigneeId === null ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                Bỏ phân công
                            </CommandItem>
                            {staffMembers.map((staff) => (
                                <CommandItem
                                    key={staff.id}
                                    value={staff.name + ' ' + staff.email}
                                    onSelect={() => handleAssign(staff.id)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentAssigneeId === staff.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{staff.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{staff.email}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
