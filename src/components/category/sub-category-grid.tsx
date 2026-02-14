import Image from 'next/image';
import Link from 'next/link';

interface SubCategoryItem {
    id: string;
    name: string;
    slug: string;
    image: string | null;
    _count: { products: number };
}

interface SubCategoryGridProps {
    categoryName: string;
    productTypes: SubCategoryItem[];
    categorySlug: string;
    title?: React.ReactNode;
    activeId?: string;
}

export function SubCategoryGrid({ categoryName, productTypes, categorySlug, title, activeId }: SubCategoryGridProps) {
    if (productTypes.length === 0) return null;

    return (
        <div className="flex flex-col gap-6">
            {title ? (
                <div className="text-2xl font-semibold text-[#111827] tracking-tight">
                    {title}
                </div>
            ) : (
                <h2 className="text-2xl font-semibold text-[#111827] tracking-tight">
                    Vui lòng chọn{' '}
                    <span className="font-bold text-[#15803d]">loại gạch</span>
                    {' '}cần thiết
                </h2>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-5">
                {productTypes.map((pt) => {
                    const isActive = pt.id === activeId;
                    return (
                        <Link
                            key={pt.id}
                            href={isActive ? `/danh-muc/${categorySlug}` : `/danh-muc/${categorySlug}?productType=${pt.id}`}
                            className="group flex flex-col gap-3 items-start"
                        >
                            <div className={`w-full aspect-square rounded-2xl overflow-hidden shadow-[0px_2px_6px_0px_rgba(16,24,40,0.06)] bg-white transition-all duration-300 ${isActive ? 'ring-2 ring-[#15803d] ring-offset-2' : ''}`}>
                                {pt.image ? (
                                    <Image
                                        src={pt.image}
                                        alt={pt.name}
                                        width={200}
                                        height={200}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs text-center p-2">
                                        {pt.name}
                                    </div>
                                )}
                            </div>
                            <p className={`font-semibold text-lg leading-7 transition-colors ${isActive ? 'text-[#15803d]' : 'text-[#4b5563] group-hover:text-[#15803d]'}`}>
                                {pt.name}
                            </p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
