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
import { assignQuote } from './[id]/builder/actions'

export function QuoteAssignSelect({
    quoteId,
    currentAssigneeId,
    staffMembers
}: {
    quoteId: number
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
        const res = await assignQuote(quoteId, userId)
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
                    className="w-[180px] justify-between h-8 px-2 text-xs"
                >
                    {selectedStaff ? (
                        <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium truncate">{selectedStaff.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UserPlus className="h-3 w-3" />
                            <span>Chưa phân công</span>
                        </div>
                    )}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="end">
                <Command>
                    <CommandInput placeholder="Tìm nhân viên..." className="text-xs" />
                    <CommandList>
                        <CommandEmpty className="text-xs py-2">Không tìm thấy.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="unassigned"
                                onSelect={() => handleAssign(null)}
                                className="text-xs text-muted-foreground"
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-3.5 w-3.5",
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
                                    className="text-xs"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-3.5 w-3.5",
                                            currentAssigneeId === staff.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span>{staff.name}</span>
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
