import Link from 'next/link'

import { requireActiveStaff } from '../../src/auth/require-staff'
import { parseAdminProductSearch } from '../../src/catalogue/contracts'
import { getAdminProductCatalogue } from '../../src/catalogue/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatPrice(value: number | null) {
  return value === null ? 'Liên hệ' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

export default async function AdminProductsPage({ searchParams }: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; error?: string }>
}) {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('products:read')) {
    return <main className="admin-page"><h1>Không có quyền truy cập</h1><p className="admin-muted">Tài khoản chưa được cấp quyền xem danh mục sản phẩm.</p></main>
  }
  const params = await searchParams
  const search = parseAdminProductSearch(params.q)
  const status = params.status === 'draft' || params.status === 'public' ? params.status : null
  const requestedPage = Number(params.page || 1)
  const page = Number.isSafeInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, 401)) : 1
  const pageSize = 25
  const result = search.error ? null : await getAdminProductCatalogue({
    search: search.value, publicationStatus: status, limit: pageSize, offset: (page - 1) * pageSize,
  })
  const totalPages = result ? Math.max(1, Math.ceil(result.total / pageSize)) : 1
  const urlFor = (next: { status?: string | null; page?: number }) => {
    const query = new URLSearchParams()
    if (search.value) query.set('q', search.value)
    const nextStatus = Object.prototype.hasOwnProperty.call(next, 'status') ? next.status : status
    if (nextStatus) query.set('status', nextStatus)
    if (next.page) query.set('page', String(next.page))
    const serialized = query.toString()
    return serialized ? `/products?${serialized}` : '/products'
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div><p className="admin-eyebrow">Danh mục</p><h1>Sản phẩm</h1><p className="admin-muted">Giá chỉnh sửa sẽ chuyển về chưa xác minh cho đến khi được rà soát.</p></div>
        <Link href="/" className="admin-link">Về trang tổng quan</Link>
      </header>
      {params.error === 'forbidden' ? <p className="admin-error" role="alert">Tài khoản không có quyền truy cập danh mục này.</p> : null}
      <nav className="admin-filter-row" aria-label="Lọc trạng thái xuất bản">
        {[
          { value: null, label: 'Tất cả' },
          { value: 'draft', label: 'Bản nháp' },
          { value: 'public', label: 'Công khai' },
        ].map((filter) => <Link key={filter.value ?? 'all'} href={urlFor({ status: filter.value })}
          aria-current={status === filter.value ? 'page' : undefined}
          className={status === filter.value ? 'admin-filter admin-filter-active' : 'admin-filter'}>{filter.label}</Link>)}
      </nav>
      <form action="/products" method="get" className="admin-search-form" role="search">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label htmlFor="product-search">Tìm theo SKU, tên hoặc đường dẫn sản phẩm</label>
        <div className="admin-search-controls"><input id="product-search" name="q" type="search" maxLength={100} value={search.value} />
          <button className="admin-button" type="submit">Tìm kiếm</button>
          {search.value ? <Link className="admin-button admin-button-secondary" href={urlFor({})}>Xóa lọc</Link> : null}
        </div>
        {search.error ? <p className="admin-error" role="alert">{search.error}</p> : null}
      </form>
      {search.error ? (
        <section className="admin-panel"><h2>Từ khóa chưa hợp lệ</h2><p className="admin-muted">Rút gọn từ khóa còn tối đa 100 ký tự.</p></section>
      ) : !result ? (
        <section className="admin-panel"><h2>Chưa tải được danh mục</h2><p className="admin-muted">Không có dữ liệu nào được hiển thị khi nguồn danh mục không khả dụng.</p></section>
      ) : result.products.length === 0 ? (
        <section className="admin-panel admin-empty"><h2>Không có sản phẩm phù hợp</h2></section>
      ) : (
        <section className="admin-panel" aria-label="Danh sách sản phẩm">
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>SKU</th><th>Sản phẩm</th><th>Giá</th><th>Trạng thái</th><th>Biến thể</th><th>Cập nhật</th><th /></tr></thead>
            <tbody>{result.products.map((product) => <tr key={product.id}>
              <td>{product.sku}</td><td>{product.display_name || product.name}</td>
              <td>{formatPrice(product.sale_price ?? product.price)}<br /><small>{product.price_state} · {product.price_confidence}</small></td>
              <td>{product.publication_status} · {product.is_active ? 'Đang hoạt động' : 'Đã tắt'}</td>
              <td>{product.variant_group ? `${product.variant_group} / ${product.variant_label ?? 'Chưa có lựa chọn'}` : '—'}</td>
              <td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(product.updated_at))}</td>
              <td><Link className="admin-link" href={`/products/${product.id}`}>Chi tiết</Link></td>
            </tr>)}</tbody>
          </table></div>
          <footer className="admin-table-footer"><span>Hiển thị {result.products.length} / {result.total} sản phẩm</span>
            <div className="admin-button-row">{page > 1 ? <Link className="admin-button admin-button-secondary" href={urlFor({ page: page - 1 })}>Trước</Link> : null}
              <span>Trang {page} / {totalPages}</span>{page < totalPages ? <Link className="admin-button admin-button-secondary" href={urlFor({ page: page + 1 })}>Sau</Link> : null}</div>
          </footer>
        </section>
      )}
    </main>
  )
}
