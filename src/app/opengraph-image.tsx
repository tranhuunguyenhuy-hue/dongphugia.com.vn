import { ImageResponse } from "next/og"

export const alt = "Đông Phú Gia - Vật liệu xây dựng cao cấp tại Đà Lạt"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "72px",
          color: "#ffffff",
          background: "linear-gradient(135deg, #0f2e3a 0%, #2e7a96 58%, #8ec9d8 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid rgba(255,255,255,0.28)",
            borderRadius: "28px",
            padding: "58px 64px",
            background: "rgba(8, 36, 46, 0.30)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700, letterSpacing: 1 }}>
            ĐÔNG PHÚ GIA
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", maxWidth: 900, fontSize: 64, fontWeight: 800, lineHeight: 1.12 }}>
              Vật liệu xây dựng cao cấp tại Đà Lạt
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#dff4fa" }}>
              Gạch ốp lát · Thiết bị vệ sinh · Thiết bị bếp
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
