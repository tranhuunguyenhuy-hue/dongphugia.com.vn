/* global React */
const { useState } = React;

// ============================================================
// Hero banner — full-width photo, 8px radius, nav arrows
// ============================================================
function HeroBanner() {
  return <section style={{ padding: '32px 0' }}>
    <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden',
      boxShadow: 'var(--shadow-md)', aspectRatio: '1216 / 568',
      background: `url(../../assets/hero-banner.png) center/cover` }}>
      <IconButton variant="outline" size={48}
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', borderRadius: '50%' }}
        icon={<Icon.ChevLeft />} />
      <IconButton variant="outline" size={48}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', borderRadius: '50%' }}
        icon={<Icon.ChevRight />} />
    </div>
  </section>;
}

// ============================================================
// Partner row — "Được hơn 50 đối tác tin tưởng"
// ============================================================
const PARTNER_LOGOS = ['TOTO','INAX','KOHLER','American Standard','GROHE','CAESAR'];

function PartnerRow() {
  return <section style={{ padding: '32px 0 40px', display: 'flex', flexDirection: 'column',
    gap: 24, alignItems: 'center' }}>
    <p style={{ textAlign: 'center', color: 'var(--stone-700)' }}>
      Được hơn 50 đối tác tin tưởng
    </p>
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
      {PARTNER_LOGOS.map((p, i) => (
        <div key={i} style={{ height: 64, padding: '0 32px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: 8, background: 'var(--stone-50)',
          border: '1px solid var(--stone-200)', minWidth: 140,
          fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 600,
          color: 'var(--stone-500)', letterSpacing: '.04em' }}>
          {p}
        </div>
      ))}
    </div>
  </section>;
}

// ============================================================
// Category cards — 4 across, 280×192, radius 16
// ============================================================
const CATEGORIES = [
  { title: 'Thiết Bị Vệ Sinh', img: '../../assets/cat-bath.png' },
  { title: 'Thiết Bị Bếp',     img: '../../assets/thumb-faucet-bath.png' },
  { title: 'Thiết Bị Nước',    img: '../../assets/thumb-outdoor-faucet.png' },
  { title: 'Gạch Ốp Lát',      img: '../../assets/thumb-lavabo.png' },
];

function CategoryCard({ title, img }) {
  const [hov, setHov] = useState(false);
  return <a onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{ display: 'block', borderRadius: 16, overflow: 'hidden',
      border: '1px solid var(--stone-200)', background: '#fff',
      boxShadow: hov ? 'var(--shadow-lg)' : 'var(--shadow-md)',
      transition: 'box-shadow 200ms var(--ease-out)', cursor: 'pointer',
      transform: hov ? 'translateY(-2px)' : 'translateY(0)',
    }}>
    <div style={{ aspectRatio: '280 / 122', position: 'relative',
      background: `url(${img}) center/cover var(--stone-50)` }}>
      <div style={{ position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(250,250,249,0) 62%, rgb(250,250,249) 100%)' }} />
    </div>
    <div style={{ background: 'var(--stone-50)', padding: '4px 16px 12px', fontSize: 16,
      lineHeight: '24px', fontWeight: 500, color: 'var(--stone-800)' }}>
      {title}
    </div>
  </a>;
}

function CategoryGrid() {
  return <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
    {CATEGORIES.map((c, i) => <CategoryCard key={i} {...c} />)}
  </section>;
}

// ============================================================
// Subcategory carousel — scrolling thumbnail rail
// ============================================================
const SUBCATS = [
  { label: 'Sen Tắm',        img: '../../assets/thumb-shower.png' },
  { label: 'Chậu Lavabo',    img: '../../assets/thumb-lavabo.png' },
  { label: 'Bồn Cầu',        img: '../../assets/thumb-toilet.png' },
  { label: 'Bồn Tắm',        img: '../../assets/thumb-bathtub.png' },
  { label: 'Phụ Kiện Phòng Tắm', img: '../../assets/thumb-accessories.png' },
  { label: 'Vòi Lavabo',     img: '../../assets/thumb-lavabo-faucet.png' },
  { label: 'Vòi Xả Tắm',     img: '../../assets/thumb-faucet-bath.png' },
  { label: 'Nắp Bồn Cầu',    img: '../../assets/thumb-toilet-lid.png' },
  { label: 'Bồn Tiểu',       img: '../../assets/thumb-urinal.png' },
  { label: 'Vòi nước',       img: '../../assets/thumb-outdoor-faucet.png' },
];

function SubThumb({ label, img }) {
  const [hov, setHov] = useState(false);
  return <a onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{ flex: '0 0 124px', height: 150, borderRadius: 12, background: 'var(--stone-50)',
      padding: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      boxShadow: hov ? 'var(--shadow-lg)' : 'none',
      transition: 'box-shadow 200ms var(--ease-out)', cursor: 'pointer' }}>
    <div style={{ width: 112, height: 112, background: `url(${img}) center/contain no-repeat` }} />
    <div style={{ fontSize: 14, lineHeight: '18px', fontWeight: 500,
      color: 'var(--stone-700)', textAlign: 'center' }}>{label}</div>
  </a>;
}

function SubcategoryCarousel({ title }) {
  const [idx, setIdx] = useState(0);
  const perPage = 8;
  const max = Math.max(0, SUBCATS.length - perPage);
  return <section style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3>{title}</h3>
      <div style={{ display: 'flex', gap: 8 }}>
        <IconButton variant="outline" size={40}
          icon={<Icon.ChevsLeft />}
          disabled={idx === 0}
          style={{ opacity: idx === 0 ? .4 : 1 }}
          onClick={() => setIdx(Math.max(0, idx - 1))} />
        <IconButton variant="outline" size={40}
          icon={<Icon.ChevsRight />}
          disabled={idx >= max}
          style={{ opacity: idx >= max ? .4 : 1 }}
          onClick={() => setIdx(Math.min(max, idx + 1))} />
      </div>
    </div>
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 12, transition: 'transform 320ms var(--ease-out)',
        transform: `translateX(calc(-${idx} * (124px + 12px)))` }}>
        {SUBCATS.map((s, i) => <SubThumb key={i} {...s} />)}
      </div>
    </div>
  </section>;
}

Object.assign(window, { HeroBanner, PartnerRow, CategoryGrid, SubcategoryCarousel });
