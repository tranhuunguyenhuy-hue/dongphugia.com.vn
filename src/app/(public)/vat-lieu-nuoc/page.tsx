import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vật Liệu Nước | Đông Phú Gia",
  description: "Vật liệu nước cao cấp tại Đông Phú Gia",
}

// LEO-366: Page will be rebuilt in Phase 3 with unified product schema
export default function VatLieuNuocPage() {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Vật Liệu Nước</h1>
      <p className="text-muted-foreground">
        Trang đang được nâng cấp. Vui lòng quay lại sau.
      </p>
    </div>
  )
}
