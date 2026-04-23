/* global React */
// New components — forms, product card, breadcrumb, badge, toast, modal,
// pagination, tabs, empty state, rating, filter sidebar, accordion.
// Use together with components.jsx (which exports Icon, Button, IconButton).
const { useState, useEffect, useRef } = React;

// Extra icons we need
const _ic = (p) => ({ width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ...p });
const Icon2 = {
  Check:  (p) => <svg {..._ic(p)}><path d="M20 6 9 17l-5-5"/></svg>,
  X:      (p) => <svg {..._ic(p)}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  Info:   (p) => <svg {..._ic(p)}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  Warn:   (p) => <svg {..._ic(p)}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  Plus:   (p) => <svg {..._ic(p)}><path d="M12 5v14"/><path d="M5 12h14"/></svg>,
  Minus:  (p) => <svg {..._ic(p)}><path d="M5 12h14"/></svg>,
  Star:   (p) => <svg {..._ic(p)}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Filter: (p) => <svg {..._ic(p)}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Box:    (p) => <svg {..._ic(p)}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>,
};

// ============================================================
// Form — Input
// ============================================================
function Input({ label, hint, error, icon, style, ...rest }) {
  const [focus, setFocus] = useState(false);
  const border = error ? 'var(--danger)' : focus ? 'var(--brand-400)' : 'var(--stone-300)';
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
    {label && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--stone-700)' }}>{label}</span>}
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
      background: '#fff', border: `1px solid ${border}`, borderRadius: 8,
      boxShadow: focus ? (error ? 'var(--ring-danger)' : 'var(--ring)') : 'none',
      transition: 'all 160ms var(--ease-out)',
    }}>
      {icon && <span style={{ paddingLeft: 12, color: 'var(--stone-500)', display: 'flex' }}>{icon}</span>}
      <input {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
        style={{ flex: 1, border: 0, outline: 'none', background: 'transparent',
          padding: icon ? '10px 12px 10px 8px' : '10px 12px',
          fontFamily: 'inherit', fontSize: 16, lineHeight: '24px', color: 'var(--stone-800)',
        }}/>
    </div>
    {hint && !error && <span style={{ fontSize: 12, color: 'var(--stone-500)' }}>{hint}</span>}
    {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
  </label>;
}

function Textarea({ label, rows = 4, ...rest }) {
  const [focus, setFocus] = useState(false);
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--stone-700)' }}>{label}</span>}
    <textarea rows={rows} {...rest}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ resize: 'vertical', background: '#fff',
        border: `1px solid ${focus ? 'var(--brand-400)' : 'var(--stone-300)'}`, borderRadius: 8,
        boxShadow: focus ? 'var(--ring)' : 'none', outline: 'none',
        padding: '10px 12px', fontFamily: 'inherit', fontSize: 16, lineHeight: '24px', color: 'var(--stone-800)',
        transition: 'all 160ms var(--ease-out)'
      }}/>
  </label>;
}

function Select({ label, options = [], value, onChange }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--stone-700)' }}>{label}</span>}
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={onChange}
        style={{ width: '100%', appearance: 'none', background: '#fff',
          border: '1px solid var(--stone-300)', borderRadius: 8, padding: '10px 40px 10px 12px',
          fontFamily: 'inherit', fontSize: 16, lineHeight: '24px', color: 'var(--stone-800)', cursor: 'pointer' }}>
        {options.map((o, i) => <option key={i} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
      <Icon.ChevDown width={18} height={18}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--stone-500)', pointerEvents: 'none' }}/>
    </div>
  </label>;
}

function Checkbox({ label, checked, onChange }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
    <span style={{ position: 'relative', width: 18, height: 18, borderRadius: 4,
      border: `1px solid ${checked ? 'var(--brand-500)' : 'var(--stone-300)'}`,
      background: checked ? 'var(--brand-500)' : '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 120ms var(--ease-out)' }}>
      {checked && <Icon2.Check width={12} height={12} strokeWidth={3} style={{ color: '#fff' }}/>}
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', margin: 0, cursor: 'pointer' }}/>
    </span>
    <span style={{ fontSize: 14, color: 'var(--stone-700)' }}>{label}</span>
  </label>;
}

function Radio({ label, checked, onChange, name }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
    <span style={{ width: 18, height: 18, borderRadius: '50%',
      border: `1px solid ${checked ? 'var(--brand-500)' : 'var(--stone-300)'}`,
      background: '#fff', position: 'relative',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      {checked && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-500)' }}/>}
      <input type="radio" name={name} checked={checked} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}/>
    </span>
    <span style={{ fontSize: 14, color: 'var(--stone-700)' }}>{label}</span>
  </label>;
}

// ============================================================
// Badge / Tag / Chip
// ============================================================
function Badge({ variant = 'neutral', children, style }) {
  const v = {
    neutral: { bg: 'var(--stone-100)', fg: 'var(--stone-700)' },
    brand:   { bg: 'var(--brand-50)',  fg: 'var(--brand-600)' },
    accent:  { bg: 'var(--accent-50)', fg: 'var(--accent-600)' },
    success: { bg: 'var(--success-50)', fg: 'var(--success)' },
    danger:  { bg: 'var(--danger-50)', fg: 'var(--danger)' },
    warning: { bg: 'var(--warning-50)', fg: 'var(--warning)' },
  }[variant];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, lineHeight: '20px',
    background: v.bg, color: v.fg, ...style }}>{children}</span>;
}

function Tag({ children, onRemove }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 10px', borderRadius: 6, fontSize: 14, color: 'var(--stone-700)',
    background: 'var(--stone-100)' }}>
    {children}
    {onRemove && <button onClick={onRemove} style={{ border: 0, background: 'transparent', cursor: 'pointer',
      color: 'var(--stone-500)', padding: 0, display: 'flex' }}><Icon2.X width={14} height={14}/></button>}
  </span>;
}

// ============================================================
// Breadcrumb
// ============================================================
function Breadcrumb({ items = [] }) {
  return <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
    color: 'var(--stone-500)', lineHeight: '20px' }}>
    {items.map((it, i) => (
      <React.Fragment key={i}>
        {i > 0 && <Icon.ChevRight width={14} height={14}/>}
        {i === items.length - 1
          ? <span style={{ color: 'var(--stone-800)', fontWeight: 500 }}>{it.label}</span>
          : <a style={{ color: 'var(--stone-500)', cursor: 'pointer' }}>{it.label}</a>}
      </React.Fragment>
    ))}
  </nav>;
}

// ============================================================
// Rating stars
// ============================================================
function Rating({ value = 0, max = 5, size = 16, showValue = true }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ display: 'inline-flex' }}>
      {Array.from({ length: max }).map((_, i) => (
        <Icon2.Star key={i} width={size} height={size}
          style={{ color: i < Math.round(value) ? 'var(--accent-400)' : 'var(--stone-200)',
            fill: i < Math.round(value) ? 'var(--accent-400)' : 'transparent' }}/>
      ))}
    </span>
    {showValue && <span style={{ fontSize: 13, color: 'var(--stone-600)', fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(1)}</span>}
  </span>;
}

// ============================================================
// Product card
// ============================================================
const vndFmt = new Intl.NumberFormat('vi-VN');
const vnd = (n) => vndFmt.format(n) + '₫';

function ProductCard({ name, brand, img, price, originalPrice, rating, reviews, badge }) {
  const [hov, setHov] = useState(false);
  const discount = originalPrice && originalPrice > price
    ? Math.round((1 - price / originalPrice) * 100) : 0;
  return <a onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    style={{ display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden',
      border: '1px solid var(--stone-200)', background: '#fff', cursor: 'pointer',
      boxShadow: hov ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
      transform: hov ? 'translateY(-2px)' : 'translateY(0)',
      transition: 'all 200ms var(--ease-out)' }}>
    <div style={{ position: 'relative', aspectRatio: '1 / 1', background: `var(--stone-50) url(${img}) center/contain no-repeat` }}>
      {badge && <div style={{ position: 'absolute', top: 12, left: 12 }}>{badge}</div>}
      {discount > 0 && <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <Badge variant="accent">-{discount}%</Badge>
      </div>}
    </div>
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {brand && <div style={{ fontSize: 12, color: 'var(--stone-500)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{brand}</div>}
      <div style={{ fontSize: 15, lineHeight: '22px', fontWeight: 500, color: 'var(--stone-800)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 44 }}>{name}</div>
      {rating != null && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Rating value={rating} size={14} showValue={false}/>
        <span style={{ fontSize: 12, color: 'var(--stone-500)' }}>({reviews ?? 0})</span>
      </div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: discount > 0 ? 'var(--accent-500)' : 'var(--stone-900)',
          fontVariantNumeric: 'tabular-nums' }}>{vnd(price)}</span>
        {discount > 0 && <span style={{ fontSize: 13, color: 'var(--stone-500)', textDecoration: 'line-through',
          fontVariantNumeric: 'tabular-nums' }}>{vnd(originalPrice)}</span>}
      </div>
    </div>
  </a>;
}

// ============================================================
// Toast / Alert (inline)
// ============================================================
function Alert({ variant = 'info', title, children, onClose }) {
  const v = {
    info:    { bg: 'var(--info-50)',    fg: 'var(--brand-600)',   ic: <Icon2.Info/> },
    success: { bg: 'var(--success-50)', fg: 'var(--success)',     ic: <Icon2.Check/> },
    warning: { bg: 'var(--warning-50)', fg: 'var(--warning)',     ic: <Icon2.Warn/> },
    danger:  { bg: 'var(--danger-50)',  fg: 'var(--danger)',      ic: <Icon2.Warn/> },
  }[variant];
  return <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderRadius: 12,
    background: v.bg, color: v.fg, alignItems: 'flex-start' }}>
    <span style={{ flex: '0 0 auto', display: 'flex', paddingTop: 2 }}>{v.ic}</span>
    <div style={{ flex: 1, fontSize: 14, lineHeight: '20px' }}>
      {title && <div style={{ fontWeight: 600, color: 'var(--stone-900)', marginBottom: 2 }}>{title}</div>}
      <div style={{ color: 'var(--stone-700)' }}>{children}</div>
    </div>
    {onClose && <button onClick={onClose}
      style={{ border: 0, background: 'transparent', color: v.fg, cursor: 'pointer', display: 'flex', padding: 0 }}>
      <Icon2.X width={18} height={18}/>
    </button>}
  </div>;
}

// ============================================================
// Modal
// ============================================================
function Modal({ open, onClose, title, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--overlay)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
    <div onClick={(e) => e.stopPropagation()}
      style={{ width, maxWidth: 'calc(100vw - 32px)', background: '#fff', borderRadius: 16,
        boxShadow: 'var(--shadow-xl)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 24px', borderBottom: '1px solid var(--stone-200)' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--stone-900)' }}>{title}</div>
        <IconButton variant="ghost" icon={<Icon2.X/>} onClick={onClose}/>
      </div>
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>{children}</div>
      {footer && <div style={{ padding: '16px 24px', borderTop: '1px solid var(--stone-200)',
        display: 'flex', gap: 12, justifyContent: 'flex-end' }}>{footer}</div>}
    </div>
  </div>;
}

// ============================================================
// Pagination
// ============================================================
function Pagination({ page = 1, pages = 10, onChange }) {
  const btnStyle = (active) => ({
    minWidth: 36, height: 36, borderRadius: 8, border: `1px solid ${active ? 'var(--brand-400)' : 'var(--stone-200)'}`,
    background: active ? 'var(--brand-50)' : '#fff', color: active ? 'var(--brand-600)' : 'var(--stone-700)',
    fontFamily: 'inherit', fontWeight: 500, fontSize: 14, cursor: 'pointer', padding: '0 10px',
  });
  const items = [];
  const push = (n) => items.push(n);
  push(1);
  if (page > 3) push('…1');
  for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) push(i);
  if (page < pages - 2) push('…2');
  if (pages > 1) push(pages);
  return <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
    <button style={btnStyle(false)} disabled={page === 1} onClick={() => onChange?.(page - 1)}>
      <Icon.ChevLeft width={16} height={16}/></button>
    {items.map((it, i) => typeof it === 'string'
      ? <span key={i} style={{ color: 'var(--stone-400)', padding: '0 6px' }}>…</span>
      : <button key={i} style={btnStyle(it === page)} onClick={() => onChange?.(it)}>{it}</button>)}
    <button style={btnStyle(false)} disabled={page === pages} onClick={() => onChange?.(page + 1)}>
      <Icon.ChevRight width={16} height={16}/></button>
  </div>;
}

// ============================================================
// Tabs
// ============================================================
function Tabs({ tabs = [], value, onChange }) {
  return <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--stone-200)' }}>
    {tabs.map((t, i) => {
      const active = value === t.value;
      return <button key={i} onClick={() => onChange?.(t.value)}
        style={{ border: 0, background: 'transparent', padding: '12px 16px', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
          color: active ? 'var(--stone-900)' : 'var(--stone-500)',
          borderBottom: `2px solid ${active ? 'var(--brand-500)' : 'transparent'}`,
          marginBottom: -1, transition: 'all 160ms var(--ease-out)' }}>
        {t.label}
      </button>;
    })}
  </div>;
}

// ============================================================
// Accordion
// ============================================================
function AccordionItem({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div style={{ borderBottom: '1px solid var(--stone-200)' }}>
    <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center', padding: '16px 0',
      border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 16, fontWeight: 500, color: 'var(--stone-900)', textAlign: 'left' }}>
      <span>{title}</span>
      <Icon.ChevDown width={20} height={20}
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms var(--ease-out)',
          color: 'var(--stone-500)' }}/>
    </button>
    {open && <div style={{ paddingBottom: 16, fontSize: 15, lineHeight: '24px', color: 'var(--stone-700)' }}>
      {children}
    </div>}
  </div>;
}

// ============================================================
// Empty state
// ============================================================
function EmptyState({ icon, title, description, action }) {
  return <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', gap: 12 }}>
    <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--stone-100)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--stone-500)' }}>
      {icon ?? <Icon2.Box width={28} height={28}/>}
    </div>
    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--stone-900)' }}>{title}</div>
    {description && <div style={{ fontSize: 14, color: 'var(--stone-600)', maxWidth: 360 }}>{description}</div>}
    {action && <div style={{ marginTop: 4 }}>{action}</div>}
  </div>;
}

// ============================================================
// Quantity stepper
// ============================================================
function QtyStepper({ value = 1, onChange, min = 1, max = 99 }) {
  return <div style={{ display: 'inline-flex', alignItems: 'center',
    border: '1px solid var(--stone-300)', borderRadius: 8, overflow: 'hidden', height: 40 }}>
    <button onClick={() => onChange?.(Math.max(min, value - 1))}
      style={{ width: 40, height: 40, border: 0, background: '#fff', cursor: 'pointer',
        color: 'var(--stone-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon2.Minus width={16} height={16}/>
    </button>
    <div style={{ minWidth: 48, padding: '0 8px', textAlign: 'center', fontWeight: 500,
      fontVariantNumeric: 'tabular-nums', borderLeft: '1px solid var(--stone-200)',
      borderRight: '1px solid var(--stone-200)', lineHeight: '40px' }}>{value}</div>
    <button onClick={() => onChange?.(Math.min(max, value + 1))}
      style={{ width: 40, height: 40, border: 0, background: '#fff', cursor: 'pointer',
        color: 'var(--stone-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon2.Plus width={16} height={16}/>
    </button>
  </div>;
}

// ============================================================
// Filter sidebar
// ============================================================
function FilterGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return <div style={{ padding: '16px 0', borderBottom: '1px solid var(--stone-200)' }}>
    <button onClick={() => setOpen(!open)} style={{ width: '100%', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center', border: 0, background: 'transparent',
      cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--stone-900)',
      padding: 0 }}>
      {title}
      <Icon.ChevDown width={18} height={18}
        style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 200ms var(--ease-out)',
          color: 'var(--stone-500)' }}/>
    </button>
    {open && <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {children}
    </div>}
  </div>;
}

Object.assign(window, {
  Icon2, Input, Textarea, Select, Checkbox, Radio,
  Badge, Tag, Breadcrumb, Rating, ProductCard,
  Alert, Modal, Pagination, Tabs, AccordionItem,
  EmptyState, QtyStepper, FilterGroup, vnd,
});
