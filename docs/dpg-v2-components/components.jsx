/* global React */
const { useState } = React;

// ============================================================
// Lucide-style icons (stroke 2, currentColor) — keep local so we
// don't depend on the runtime Lucide bundle.
// ============================================================
const ic = (props) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
  ...props });

const Icon = {
  Search:    (p) => <svg {...ic(p)}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Cart:      (p) => <svg {...ic(p)}><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>,
  Phone:     (p) => <svg {...ic(p)}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  ChevDown:  (p) => <svg {...ic(p)}><path d="M6 9l6 6 6-6"/></svg>,
  ChevUp:    (p) => <svg {...ic(p)}><path d="M6 15l6-6 6 6"/></svg>,
  ChevLeft:  (p) => <svg {...ic(p)}><path d="M15 18l-6-6 6-6"/></svg>,
  ChevRight: (p) => <svg {...ic(p)}><path d="M9 18l6-6-6-6"/></svg>,
  ChevsLeft: (p) => <svg {...ic(p)}><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></svg>,
  ChevsRight:(p) => <svg {...ic(p)}><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></svg>,
};

// ============================================================
// Buttons
// ============================================================
const baseBtn = {
  fontFamily: 'inherit', fontWeight: 500, fontSize: 16, lineHeight: '24px',
  border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
  justifyContent: 'center', gap: 8, transition: 'all 200ms cubic-bezier(0.16,1,0.3,1)',
};

function Button({ variant = 'primary', size = 'md', icon, children, style, ...rest }) {
  const v = {
    primary:   { background: 'var(--brand-500)', color: '#fff', boxShadow: 'var(--shadow-sm)' },
    secondary: { background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-400)', boxShadow: 'var(--shadow-sm)' },
    outline:   { background: 'var(--stone-50)', color: 'var(--stone-800)', border: '1px solid var(--stone-300)' },
    ghost:     { background: 'transparent', color: 'var(--stone-700)' },
  }[variant];
  const s = {
    sm: { padding: '6px 12px', fontSize: 14, lineHeight: '20px', borderRadius: 8 },
    md: { padding: '8px 16px', borderRadius: 8 },
    lg: { padding: '12px 20px', fontSize: 16, lineHeight: '24px', borderRadius: 8 },
  }[size];
  const [hov, setHov] = useState(false);
  const hover = hov && variant === 'primary' ? { background: 'var(--brand-600)' }
    : hov && variant === 'outline' ? { background: 'var(--stone-100)' }
    : hov && variant === 'ghost' ? { color: 'var(--stone-900)' } : {};
  return <button {...rest}
    style={{ ...baseBtn, ...v, ...s, ...hover, ...style }}
    onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
    {icon}{children}
  </button>;
}

function IconButton({ variant = 'outline', size = 40, icon, style, ...rest }) {
  const v = {
    primary:   { background: 'var(--brand-500)', color: '#fff', boxShadow: 'var(--shadow-sm)' },
    secondary: { background: 'var(--brand-50)', color: 'var(--brand-600)', border: '1px solid var(--brand-400)', boxShadow: 'var(--shadow-sm)' },
    outline:   { background: '#fff', color: 'var(--stone-700)', border: '1px solid var(--stone-300)', boxShadow: 'var(--shadow-sm)' },
    ghost:     { background: 'transparent', color: 'var(--stone-700)' },
  }[variant];
  const [hov, setHov] = useState(false);
  return <button {...rest}
    onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{ ...baseBtn, ...v, width: size, height: size, borderRadius: 12,
      background: hov && variant === 'outline' ? 'var(--stone-50)' : v.background, ...style }}>
    {icon}
  </button>;
}

// ============================================================
// Header — sticky, 88px, logo / nav / actions
// ============================================================
const NAV = [
  { label: 'Sản phẩm', dropdown: true },
  { label: 'Dự án' },
  { label: 'Đối tác' },
  { label: 'Về chúng tôi' },
];

const MEGAMENU = [
  { title: 'Thiết bị vệ sinh', items: ['Bồn Cầu','Chậu Lavabo','Sen Tắm','Bồn Tắm','Phụ Kiện Phòng Tắm','Vòi Chậu','Bồn Tiểu','Nắp Bồn Cầu'] },
  { title: 'Thiết bị bếp',     items: ['Vòi Rửa Chén','Chậu Rửa Chén','Bếp Điện Từ','Máy Hút Mùi','Máy Rửa Chén','Bếp Gas','Lò Nướng'] },
  { title: 'Thiết bị nước',    items: ['Máy Nước Nóng','Máy Lọc Nước','Bồn Chứa Nước','Máy bơm Nước','Vòi nước','Ống nước PPR'] },
  { title: 'Gạch ốp lát',      items: ['Gạch Vân Đá Marble','Gạch Vân Đá Tự Nhiên','Gạch Vân Gỗ','Gạch Trang Trí','Gạch Mosaic','Gạch Granite'] },
];

function NavPill({ label, dropdown, open, onToggle }) {
  const [hov, setHov] = useState(false);
  return <button
    onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    onClick={dropdown ? onToggle : undefined}
    style={{ ...baseBtn, padding: open ? '6px 14px' : '6px 14px',
      background: open ? 'var(--stone-100)' : 'transparent',
      borderRadius: open ? 12 : 8,
      color: open || hov ? 'var(--stone-900)' : 'var(--stone-600)',
    }}>
    {label}
    {dropdown && (open ? <Icon.ChevUp width={16} height={16}/> : <Icon.ChevDown width={16} height={16}/>)}
  </button>;
}

function Header({ onOpenMega, megaOpen }) {
  return <header style={{
    position: 'sticky', top: 0, zIndex: 50, height: 88, background: 'rgba(255,255,255,.96)',
    backdropFilter: 'blur(7.3px)', boxShadow: 'var(--shadow-md)',
  }}>
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '0 80px', height: '100%' }}>
      <div style={{ height: '100%', padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <img src="../../assets/logo-dpg.png" alt="Đồng Phú Gia" style={{ height: 36 }} />
        <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {NAV.map((n, i) => (
            <NavPill key={i} {...n} open={n.dropdown && megaOpen}
              onToggle={() => onOpenMega(!megaOpen)} />
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <IconButton variant="secondary" icon={<Icon.Cart />} />
          <Button variant="primary" icon={<Icon.Phone width={18} height={18}/>}>Liên hệ tư vấn</Button>
        </div>
      </div>
    </div>
    {megaOpen && <Megamenu onClose={() => onOpenMega(false)} />}
  </header>;
}

function Megamenu({ onClose }) {
  return <div onMouseLeave={onClose} style={{
    position: 'absolute', left: 0, right: 0, top: 88,
    background: '#fff', boxShadow: 'var(--shadow-md)',
    borderTop: '1px solid var(--stone-200)',
  }}>
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '24px 112px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {MEGAMENU.map((col, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              paddingBottom: 8, borderBottom: '1px solid var(--stone-200)', marginBottom: 8,
              fontSize: 14, fontWeight: 500, color: 'var(--stone-800)' }}>
              {col.title}
              <a style={{ fontSize: 14, color: 'var(--brand-500)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Xem tất cả <Icon.ChevRight width={14} height={14}/>
              </a>
            </div>
            {col.items.map((it, j) => (
              <a key={j} style={{ display: 'block', fontSize: 14, lineHeight: '28px', color: 'var(--stone-600)', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--stone-900)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--stone-600)'}>
                {it}
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>;
}

Object.assign(window, { Icon, Button, IconButton, NavPill, Header, Megamenu });
