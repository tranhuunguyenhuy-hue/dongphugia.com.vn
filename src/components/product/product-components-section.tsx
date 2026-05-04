import Link from 'next/link';
import Image from 'next/image';
import { Package, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ComponentProduct {
  id: number;
  child_sku: string;
  relationship_type: string;
  sort_order: number;
  child: {
    id: number;
    name: string;
    display_name: string | null;
    slug: string;
    sku: string;
    price: number | null;
    price_display: string | null;
    image_main_url: string | null;
    subcategories: { slug: string } | null;
  } | null;
}

interface ProductComponentsSectionProps {
  components: ComponentProduct[];
  basePath?: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
    .format(price)
    .replace('₫', 'đ');
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ProductComponentsSection({ components, basePath = '/thiet-bi-ve-sinh' }: ProductComponentsSectionProps) {
  if (!components || components.length === 0) return null;

  // Only show resolved components (child != null)
  const resolved = components
    .filter(c => c.child !== null)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (resolved.length === 0) return null;

  return (
    <div className="mt-16 border rounded-xl p-5 bg-white shadow-sm border-stone-200">
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-5 h-5 text-stone-900" />
        <h3 className="text-lg font-semibold text-stone-900">Trọn bộ sản phẩm bao gồm</h3>
        <Badge variant="secondary" className="bg-stone-100 text-stone-600 hover:bg-stone-100 font-medium">
          {resolved.length} món
        </Badge>
      </div>

      {/* Component Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resolved.map(({ child, child_sku, sort_order }) => {
          if (!child) return null;
          const displayName = child.display_name || child.name;
          const href = `${basePath}/${child.subcategories?.slug || 'san-pham'}/${child.slug}`;

          return (
            <Link
              key={child_sku}
              href={href}
              target="_blank"
              className="group flex items-center gap-4 p-3 rounded-xl border border-stone-100 bg-white hover:border-[#2E7A96]/30 hover:bg-[#2E7A96]/[0.02] transition-all duration-200"
            >

              {/* Ảnh nhỏ */}
              <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-stone-50 overflow-hidden border border-stone-100 relative">
                {child.image_main_url ? (
                  child.image_main_url.includes('vietceramics.com') ? (
                    <img
                      src={child.image_main_url}
                      alt={displayName}
                      className="w-full h-full object-cover mix-blend-multiply"
                    />
                  ) : (
                    <Image
                      src={child.image_main_url}
                      alt={displayName}
                      fill
                      className="object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-300 p-1"
                      unoptimized={false}
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-[#2E7A96] mb-1 uppercase tracking-wider">
                  {/* Có thể thay bằng child.component_type từ DB nếu có */}
                  Linh kiện
                </p>
                <p className="text-[13px] font-medium text-stone-800 group-hover:text-[#2E7A96] leading-snug line-clamp-2 transition-colors">
                  {displayName}
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5 font-mono">SKU: {child.sku}</p>
                {child.price ? (
                  <p className="text-[12px] font-semibold text-[#2E7A96] mt-1">{formatPrice(child.price)}</p>
                ) : child.price_display ? (
                  <p className="text-[12px] font-medium text-stone-500 mt-1">{child.price_display}</p>
                ) : null}
              </div>

              {/* Arrow */}
              <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#2E7A96] transition-colors flex-shrink-0" />
            </Link>
          );
        })}
      </div>

      {/* Note */}
      <p className="mt-4 text-[12px] text-stone-400 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        Bạn có thể mua riêng từng linh kiện hoặc mua nguyên bộ tại Đông Phú Gia.
      </p>
    </div>
  );
}
