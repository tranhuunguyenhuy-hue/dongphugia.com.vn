import { notFound } from 'next/navigation'

import { requireActiveStaff } from '../../../src/auth/require-staff'
import { getAdminProductCatalogue } from '../../../src/catalogue/queries'
import { ProductEditor } from '../product-editor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminProductDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const staff = await requireActiveStaff()
  if (!staff.capabilities.includes('products:read')) {
    return <main className="admin-page"><h1>Không có quyền truy cập</h1><p className="admin-muted">Tài khoản chưa được cấp quyền xem sản phẩm.</p></main>
  }
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isSafeInteger(id) || id < 1) notFound()
  const result = await getAdminProductCatalogue({ productId: id, limit: 1 })
  const product = result?.products[0]
  if (!product) notFound()
  return <ProductEditor product={product} canWrite={staff.capabilities.includes('products:write')} searchParams={await searchParams} />
}
