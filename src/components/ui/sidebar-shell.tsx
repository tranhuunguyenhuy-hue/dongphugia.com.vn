import { ReactNode } from "react";

interface SidebarShellProps {
    title: string;
    children: ReactNode;
    className?: string; // Allow additional classes for width or positioning
}

export function SidebarShell({ title, children, className = "w-[302px]" }: SidebarShellProps) {
    return (
        <div className={`shrink-0 ${className} relative z-20`}>
            <div className="bg-[#C5E8F5] border border-[#44A0BA] rounded-3xl shadow-[0px_6px_15px_0px_rgba(16,24,40,0.08)] overflow-hidden">
                {/* Header */}
                <div className="px-5 pt-4 pb-4">
                    <h3 className="font-semibold text-[18px] leading-[28px] text-[#0F2E3A]">
                        {title}
                    </h3>
                </div>

                {/* Content Container */}
                <div className="bg-white rounded-[24px] overflow-hidden flex flex-col py-2">
                    {children}
                </div>
            </div>
        </div>
    );
}
