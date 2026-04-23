/* global React */
// Shared page chrome for secondary pages — reuses Header/Megamenu from components.jsx.
const { useState: _useState } = React;

function PageShell({ children }) {
  const [mega, setMega] = _useState(false);
  return <>
    <Header onOpenMega={setMega} megaOpen={mega} />
    <main className="u-container" style={{ padding: '24px 32px 80px' }}>
      {children}
    </main>
    <SiteFooter />
  </>;
}

function SiteFooter() {
  return <footer style={{ background: 'var(--stone-900)', color: 'var(--stone-300)',
    padding: '48px 80px', marginTop: 64 }}>
    <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid',
      gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 48 }}>
      <div>
        <div style={{ background: '#fff', padding: '8px 12px', borderRadius: 8, display: 'inline-block' }}>
          <img src="../../assets/logo-dpg.png" alt="DPG" style={{ height: 32, display: 'block' }}/>
        </div>
        <p style={{ color: 'var(--stone-400)', marginTop: 16, fontSize: 14, lineHeight: '22px' }}>
          Đồng hành – Phát triển. Nhà phân phối thiết bị vệ sinh, bếp và gạch ốp lát uy tín.
        </p>
      </div>
      <div>
        <h5 style={{ color: '#fff', marginBottom: 12 }}>Sản phẩm</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--stone-400)' }}>
          <a>Thiết bị vệ sinh</a><a>Thiết bị bếp</a><a>Thiết bị nước</a><a>Gạch ốp lát</a>
        </div>
      </div>
      <div>
        <h5 style={{ color: '#fff', marginBottom: 12 }}>Công ty</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--stone-400)' }}>
          <a href="./Contact.html">Liên hệ</a><a>Về chúng tôi</a><a>Dự án</a><a>Đối tác</a>
        </div>
      </div>
      <div>
        <h5 style={{ color: '#fff', marginBottom: 12 }}>Liên hệ</h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--stone-400)' }}>
          <span>1900 0000</span><span>contact@dongphugia.vn</span><span>Hà Nội · TP.HCM</span>
        </div>
      </div>
    </div>
  </footer>;
}

Object.assign(window, { PageShell, SiteFooter });
