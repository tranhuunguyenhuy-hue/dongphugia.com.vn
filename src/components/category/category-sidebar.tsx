'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { SidebarShell } from '@/components/ui/sidebar-shell';

interface Category {
    id: string;
    name: string;
    slug: string;
    children: { id: string; name: string; slug: string }[];
}

interface CategorySidebarProps {
    categories: Category[];
    activeSlug: string;
}

export function CategorySidebar({ categories, activeSlug }: CategorySidebarProps) {
    const pathname = usePathname();

    return (
        <SidebarShell title="Danh mục sản phẩm">
            {categories.map((cat, index) => {
                const isActive = cat.slug === activeSlug;
                const isLast = index === categories.length - 1;
                return (
                    <Link
                        key={cat.id}
                        href={`/danh-muc/${cat.slug}`}
                        className={`
                            flex items-center justify-between px-5 py-4 h-[60px]
                            transition-colors text-sm font-semibold
                            ${isActive
                                ? 'bg-green-50 text-[#15803d]'
                                : 'text-[#4b5563] hover:bg-gray-50'
                            }
                            ${index === 0 ? 'rounded-t-xl' : ''}
                            ${isLast ? 'rounded-b-3xl' : ''}
                        `}
                    >
                        <span>{cat.name}</span>
                        <ChevronRight className="h-5 w-5 opacity-40" />
                    </Link>
                );
            })}
        </SidebarShell>
    );
}
