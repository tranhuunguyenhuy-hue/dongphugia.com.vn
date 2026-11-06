import Link from 'next/link'

import type { AdminProduct } from '../../src/catalogue/contracts'
import { updateAdminProduct } from './actions'

function formatPrice(value: number | null) {
  return value === null ? 'Chưa có' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'Tài khoản không có quyền sửa trường này.',
  invalid: 'Dữ liệu sửa không hợp lệ.',
  price: 'Giá phải là số VND nguyên trong giới hạn cho phép; giá khuyến mãi phải thấp hơn giá thường.',
  stale: 'Sản phẩm đã được người khác sửa. Tải lại trang rồi thử lại.',
  variant: 'Nhóm biến thể không còn đạt điều kiện xác minh hoặc lựa chọn bị trùng.',
  save: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
}

export function ProductEditor({ product, canWrite, searchParams }: {
  product: AdminProduct
  canWrite: boolean
  searchParams: { saved?: string; error?: string }
}) {
  const initialOption = product.variant_options[0]
  const axisLabel = product.variant_axes[0]?.label ?? (product.variant_type === 'seat_type' ? 'Loại nắp' : 'Kích thước')

  return (
    <main className="admin-page">
      <p className="admin-eyebrow"><Link className="admin-link" href="/products">Sản phẩm</Link> / Chi tiết</p>
      <header className="admin-page-header">
        <div><h1>{product.display_name || product.name}</h1><p className="admin-muted">SKU {product.sku} · URL /{product.slug}</p></div>
        <Link href="/products" className="admin-button admin-button-secondary">Quay lại danh sách</Link>
      </header>
      {searchParams.saved ? <p className="admin-status-pill" role="status">{searchParams.saved === 'unchanged' ? 'Không có thay đổi mới.' : 'Đã lưu thay đổi.'}</p> : null}
      {searchParams.error ? <p className="admin-error" role="alert">{ERROR_MESSAGES[searchParams.error] ?? 'Không thể hoàn tất thao tác.'}</p> : null}

      <section className="admin-panel admin-form-section">
        <div>
          <h2>Thông tin và trạng thái</h2>
          <p className="admin-muted">Giá thay đổi sẽ chuyển về trạng thái chưa xác minh và không được coi là giá bán đã duyệt trên Public.</p>
        </div>
        {canWrite ? (
          <form action={updateAdminProduct} className="admin-form-section">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="version" value={product.version} />
            <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
            <div className="admin-field-grid">
              <label className="admin-field">Tên hiển thị
                <input name="displayName" maxLength={500} defaultValue={product.display_name || product.name} required />
              </label>
              <label className="admin-field">Trạng thái xuất bản
                <select name="publicationStatus" defaultValue={product.publication_status}>
                  <option value="draft">Bản nháp</option><option value="public">Công khai</option>
                </select>
              </label>
              <label className="admin-field">Giá thường (VND)
                <input name="price" type="number" inputMode="numeric" min="0" max="1000000000" step="1" defaultValue={product.price ?? ''} />
              </label>
              <label className="admin-field">Giá khuyến mãi (VND)
                <input name="salePrice" type="number" inputMode="numeric" min="0" max="1000000000" step="1" defaultValue={product.sale_price ?? ''} />
              </label>
              <label className="admin-field">Ưu đãi online (VND)
                <input name="onlineDiscountAmount" type="number" inputMode="numeric" min="0" max="1000000000" step="1" defaultValue={product.online_discount_amount ?? ''} />
              </label>
              <label className="admin-field">Hiển thị PDP
                <select name="pdpVisibility" defaultValue={product.pdp_visibility}><option value="public">Công khai</option><option value="hidden">Ẩn</option></select>
              </label>
              <label className="admin-field">Hiển thị listing
                <select name="listingVisibility" defaultValue={product.listing_visibility}><option value="default">Theo mặc định</option><option value="public">Công khai</option><option value="hidden">Ẩn</option></select>
              </label>
              <label className="admin-field">Hiển thị tìm kiếm
                <select name="searchVisibility" defaultValue={product.search_visibility}><option value="visible">Hiện</option><option value="hidden">Ẩn</option></select>
              </label>
              <label className="admin-field">SEO
                <select name="seoIndexing" defaultValue={product.seo_indexing}><option value="index">Cho lập chỉ mục</option><option value="noindex">Noindex</option></select>
              </label>
            </div>
            <label className="admin-field">Mô tả
              <textarea name="description" maxLength={20000} defaultValue={product.description ?? ''} />
            </label>
            <div className="admin-field-grid">
              <label className="admin-field-checkbox"><input name="isActive" type="checkbox" defaultChecked={product.is_active} /> Sản phẩm đang hoạt động</label>
              <label className="admin-field-checkbox"><input name="sitemapInclude" type="checkbox" defaultChecked={product.sitemap_include} /> Cho phép đưa vào sitemap</label>
            </div>

            {product.variant_group ? (
              <fieldset className="admin-panel admin-form-section">
                <legend>Biến thể · {product.variant_group}</legend>
                {product.variant_options_editable && product.variant_type ? (
                  <>
                    <p className="admin-muted">Chỉ sửa lựa chọn trong nhóm đã xác minh; không thể tạo hoặc chuyển thành viên SKU sang nhóm khác.</p>
                    <input type="hidden" name="variantType" value={product.variant_type} />
                    <div className="admin-field-grid">
                      <label className="admin-field">{axisLabel} · nhãn
                        <input name="variantLabel" maxLength={100} defaultValue={product.variant_label ?? ''} required />
                      </label>
                      <label className="admin-field">{axisLabel} · giá trị
                        <input name="variantValue" maxLength={100} defaultValue={initialOption?.value ?? product.variant_label ?? ''} required />
                      </label>
                    </div>
                  </>
                ) : (
                  <p className="admin-muted">Nhóm này chỉ xem được. Tài khoản không thể sửa quan hệ hoặc tổ hợp chưa được xác minh.</p>
                )}
              </fieldset>
            ) : <p className="admin-muted">Sản phẩm hiện chưa thuộc nhóm biến thể đã xác minh.</p>}
            <div className="admin-button-row"><button className="admin-button" type="submit">Lưu thay đổi</button><span className="admin-muted">Phiên bản {product.version}</span></div>
          </form>
        ) : (
          <div className="admin-detail-grid">
            <p>Giá thường: {formatPrice(product.price)}</p><p>Giá khuyến mãi: {formatPrice(product.sale_price)}</p>
            <p>Trạng thái: {product.publication_status} · {product.is_active ? 'Đang hoạt động' : 'Đã tắt'}</p>
            <p>Tình trạng xác minh giá: {product.price_state} ({product.price_confidence})</p>
          </div>
        )}
      </section>
    </main>
  )
}
