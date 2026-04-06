import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Thiết Bị Bếp | Đông Phú Gia",
  description: "Thiết bị bếp cao cấp tại Đông Phú Gia",
}

// LEO-366: Page will be rebuilt in Phase 3 with unified product schema
export default function ThietBiBepPage() {
  return (
    <div className="container mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-bold mb-4">Thiết Bị Bếp</h1>
      <p className="text-muted-foreground">
        Trang đang được nâng cấp. Vui lòng quay lại sau.
      </p>
    </div>
  )
}
