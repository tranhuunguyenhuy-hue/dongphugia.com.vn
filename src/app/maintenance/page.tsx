import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đông Phú Gia — Đang nâng cấp hệ thống",
  description: "Website Đông Phú Gia đang được nâng cấp. Vui lòng quay lại sau hoặc liên hệ trực tiếp.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a1628 0%, #132743 50%, #1a3a5c 100%)",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: "#ffffff",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <img
            src="/images/logo.png"
            alt="Đông Phú Gia"
            style={{
              height: 80,
              objectFit: "contain",
              filter: "brightness(1.1) drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
            }}
          />
        </div>

        {/* Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            margin: "0 auto 32px",
            borderRadius: "50%",
            background: "rgba(46, 122, 150, 0.15)",
            border: "2px solid rgba(46, 122, 150, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
          }}
        >
          🔧
        </div>

        {/* Heading */}
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 16,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
          }}
        >
          Chúng tôi đang nâng cấp
          <br />
          <span style={{ color: "#5bb5d5" }}>trải nghiệm mới</span>
        </h1>

        {/* Description */}
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.7,
            color: "rgba(255, 255, 255, 0.7)",
            marginBottom: 40,
            maxWidth: 420,
            margin: "0 auto 40px",
          }}
        >
          Website Đông Phú Gia đang được nâng cấp toàn diện để mang đến 
          trải nghiệm mua sắm vật liệu xây dựng tốt hơn cho Quý khách.
        </p>

        {/* Contact Card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 16,
            padding: "28px 24px",
            backdropFilter: "blur(10px)",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.5)",
              marginBottom: 16,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600,
            }}
          >
            Liên hệ mua hàng trực tiếp
          </p>

          {/* Phone */}
          <a
            href="tel:02633828122"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 22,
              fontWeight: 700,
              color: "#5bb5d5",
              textDecoration: "none",
              marginBottom: 12,
            }}
          >
            📞 0263 3828 122
          </a>

          {/* Address */}
          <p
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.5)",
              lineHeight: 1.5,
            }}
          >
            📍 151 Phan Đình Phùng, Phường 1, TP. Đà Lạt, Lâm Đồng
          </p>
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: 48,
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.3)",
          }}
        >
          © 2026 Đông Phú Gia — Nhà phân phối VLXD cao cấp tại Đà Lạt
        </p>
      </div>
    </div>
  );
}
