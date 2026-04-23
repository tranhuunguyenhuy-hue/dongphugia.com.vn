import Link from 'next/link';
import Image from 'next/image';

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
    <section className="mt-16 pt-8 border-t border-stone-100">
      {/* Section Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            Linh kiện trong bộ
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            Bộ sản phẩm này bao gồm {resolved.length} linh kiện
          </p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          Chính hãng
        </span>
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
              className="group flex items-center gap-3 p-3.5 rounded-xl border border-stone-200 bg-white hover:border-[#2E7A96]/30 hover:shadow-sm transition-all duration-200"
            >
              {/* Số thứ tự */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-bold text-stone-500">
                {sort_order + 1}
              </div>

              {/* Ảnh nhỏ */}
              <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-stone-50 overflow-hidden border border-stone-100">
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
                      width={56}
                      height={56}
                      className="object-cover mix-blend-multiply"
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
                <p className="text-[12.5px] font-medium text-stone-800 group-hover:text-[#2E7A96] leading-snug line-clamp-2 transition-colors">
                  {displayName}
                </p>
                <p className="text-[11px] text-stone-400 mt-0.5 font-mono">{child.sku}</p>
                {child.price ? (
                  <p className="text-[12px] font-semibold text-[#2E7A96] mt-1">{formatPrice(child.price)}</p>
                ) : child.price_display ? (
                  <p className="text-[12px] font-medium text-stone-500 mt-1">{child.price_display}</p>
                ) : null}
              </div>

              {/* Arrow */}
              <svg className="w-4 h-4 text-stone-300 group-hover:text-[#2E7A96] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
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
    </section>
  );
}
