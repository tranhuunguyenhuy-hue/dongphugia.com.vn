import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đông Phú Gia — Đang nâng cấp hệ thống",
  description:
    "Website Đông Phú Gia đang được nâng cấp. Vui lòng quay lại sau hoặc liên hệ trực tiếp.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500&display=swap');

            * { margin: 0; padding: 0; box-sizing: border-box; }

            html, body { height: 100%; }

            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              background: #fafbfc;
              color: #1a1a1a;
              overflow-x: hidden;
            }

            .maintenance-root {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              position: relative;
              padding: 32px 24px;
            }

            /* Soft blue gradient BG — low opacity for contrast */
            .bg-gradient {
              position: fixed;
              inset: 0;
              z-index: 0;
              pointer-events: none;
              overflow: hidden;
            }

            .bg-gradient::before {
              content: '';
              position: absolute;
              width: 140%;
              height: 140%;
              top: -20%;
              left: -20%;
              background:
                radial-gradient(ellipse 60% 50% at 20% 50%, rgba(147, 197, 253, 0.25) 0%, transparent 70%),
                radial-gradient(ellipse 50% 60% at 70% 30%, rgba(96, 165, 250, 0.2) 0%, transparent 70%),
                radial-gradient(ellipse 40% 50% at 80% 70%, rgba(103, 232, 249, 0.15) 0%, transparent 70%),
                radial-gradient(ellipse 50% 40% at 40% 80%, rgba(147, 197, 253, 0.18) 0%, transparent 70%);
              animation: drift 20s ease-in-out infinite alternate;
            }

            @keyframes drift {
              0% { transform: translate(0, 0) scale(1); }
              100% { transform: translate(30px, -20px) scale(1.03); }
            }

            /* Semi-transparent white overlay for contrast */
            .bg-gradient::after {
              content: '';
              position: absolute;
              inset: 0;
              background: rgba(250, 251, 252, 0.55);
            }

            .content {
              position: relative;
              z-index: 2;
              text-align: center;
              max-width: 580px;
              width: 100%;
            }

            /* Logo */
            .logo-group {
              display: inline-flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 72px;
            }

            .logo-icon { height: 28px; width: auto; }

            .logo-text-wrap {
              display: flex;
              flex-direction: column;
              gap: 2px;
            }

            .logo-text-img { height: 18px; width: auto; }
            .logo-tagline-img { height: 6px; width: auto; opacity: 0.7; }

            /* Eyebrow */
            .eyebrow {
              font-size: 13px;
              font-weight: 500;
              color: #888;
              letter-spacing: 0.02em;
              margin-bottom: 20px;
            }

            /* Heading — serif, large, neutral */
            .heading {
              font-family: 'DM Serif Display', 'Georgia', serif;
              font-size: 52px;
              font-weight: 400;
              line-height: 1.15;
              color: #1a1a1a;
              letter-spacing: -0.02em;
              margin-bottom: 24px;
            }

            /* Subtext */
            .subtext {
              font-size: 15px;
              line-height: 1.7;
              color: #666;
              font-weight: 400;
              max-width: 440px;
              margin: 0 auto 20px;
            }

            /* Date/location line */
            .meta-line {
              font-size: 13px;
              color: #999;
              margin-bottom: 32px;
              letter-spacing: 0.01em;
            }

            .meta-separator {
              display: inline-block;
              margin: 0 8px;
              color: #ccc;
            }

            /* CTA — dark minimal pill */
            .cta-btn {
              display: inline-flex;
              align-items: center;
              gap: 0;
              background: #1a1a1a;
              color: #fff;
              font-family: 'Inter', sans-serif;
              font-size: 14px;
              font-weight: 500;
              padding: 12px 28px;
              border-radius: 100px;
              text-decoration: none;
              border: none;
              cursor: pointer;
              transition: background 0.2s ease, transform 0.15s ease;
              letter-spacing: -0.01em;
            }

            .cta-btn:hover {
              background: #333;
              transform: translateY(-1px);
            }

            /* Bottom info */
            .bottom-info {
              position: relative;
              z-index: 2;
              display: flex;
              justify-content: center;
              gap: 32px;
              margin-top: 80px;
            }

            .info-item {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
              color: #888;
            }

            .info-item svg {
              width: 16px;
              height: 16px;
              color: #aaa;
              flex-shrink: 0;
            }

            .info-item a {
              color: #555;
              text-decoration: none;
              font-weight: 500;
            }

            .info-item a:hover { color: #1a1a1a; }

            /* Footer */
            .footer-text {
              position: relative;
              z-index: 2;
              margin-top: 40px;
              font-size: 11px;
              color: #bbb;
              text-align: center;
            }

            /* Responsive */
            @media (max-width: 640px) {
              .heading { font-size: 36px; }
              .subtext { font-size: 14px; }
              .bottom-info {
                flex-direction: column;
                gap: 12px;
                align-items: center;
              }
              .logo-group { margin-bottom: 48px; }
            }

            @media (prefers-reduced-motion: reduce) {
              .bg-gradient::before { animation: none; }
            }
          `,
        }}
      />

      <div className="maintenance-root">
        {/* Soft blue gradient background */}
        <div className="bg-gradient" />

        <div className="content">
          {/* Logo */}
          <div className="logo-group">
            <img src="/images/logo-icon.svg" alt="" className="logo-icon" />
            <div className="logo-text-wrap">
              <img
                src="/images/logo-text.svg"
                alt="ĐÔNG PHÚ GIA"
                className="logo-text-img"
              />
              <img
                src="/images/logo-tagline.svg"
                alt="Đồng hành - Phát triển"
                className="logo-tagline-img"
              />
            </div>
          </div>

          {/* Eyebrow */}
          <p className="eyebrow">
            Hệ thống đang được nâng cấp toàn diện
          </p>

          {/* Heading */}
          <h1 className="heading">Đông Phú Gia</h1>

          {/* Subtext */}
          <p className="subtext">
            Chúng tôi đang hoàn thiện trải nghiệm mua sắm vật liệu xây dựng
            mới. Vui lòng liên hệ trực tiếp để được tư vấn.
          </p>

          {/* Meta line */}
          <p className="meta-line">
            151 Phan Đình Phùng, Đà Lạt
            <span className="meta-separator">&middot;</span>
            0263 3828 122
          </p>

          {/* CTA */}
          <a href="tel:02633828122" className="cta-btn">
            Liên hệ tư vấn
          </a>
        </div>

        {/* Bottom info */}
        <div className="bottom-info">
          <div className="info-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <a href="tel:02633828122">0263 3828 122</a>
          </div>
          <div className="info-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            Showroom Đà Lạt
          </div>
        </div>

        <p className="footer-text">
          © 2026 Đông Phú Gia
        </p>
      </div>
    </>
  );
}
