
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils'; // Make sure you have this utility

interface CategoryItemProps {
    category: any;
    className?: string; // Allow passing Tailwind classes for styling (e.g., bg color, borders)
}

export function CategoryItem({ category, className }: CategoryItemProps) {
    return (
        <Link
            href={`/danh-muc/${category.slug}`}
            className={cn(
                "flex h-[60px] items-center justify-between p-5 w-full bg-white hover:bg-gray-50 transition-colors border-b last:border-b-0",
                className // Apply custom classes if provided
            )}
        >
            <p className="font-semibold text-sm text-gray-600">{category.name}</p>
            <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>
    );
}
