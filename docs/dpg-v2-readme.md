# DPG Design System

**Brand:** Đồng Phú Gia (DPG) — a Vietnamese e-commerce retailer specialising in premium home fixtures: **thiết bị vệ sinh** (bathroom), **thiết bị bếp** (kitchen), **thiết bị nước** (plumbing / water), and **gạch ốp lát** (tiles).

Tagline: **"Đồng hành – Phát triển"** ("Accompanying – Developing"). The product positioning is luxurious, minimal, and clean — trustworthy mid-to-premium fixtures for family homes and developer projects, with a "Liên hệ tư vấn" (contact for consulting) CTA as the primary commerce surface rather than immediate checkout.

## Sources

- **Figma file** — `DPG. Design system ver 2.0.fig` (mounted as read-only VFS). 8 pages: FOUNDATION, Color, Header---Navigation, Typography, Button, Grid, icon, HOMEPAGE.
- **Fonts** — `uploads/Be_Vietnam_Pro.zip` (pointed to by user; we load via Google Fonts in CSS for portability).

## Index (what lives where)

| Path | What |
| --- | --- |
| `README.md` | This file — brand, content, visual foundations |
| `colors_and_type.css` | CSS variables for color + type + spacing + shadows |
| `SKILL.md` | Agent-Skill manifest (cross-compatible with Claude Code) |
| `assets/` | Logo (`logo-dpg.png`), hero banner, product thumbnails |
| `preview/` | Small HTML cards rendered in the Design System tab |
| `ui_kits/website/` | Hi-fi React UI kit — Home, PDP, Cart, Checkout, Contact |
| `fonts/` | Playfair Display TTFs (local, referenced by `colors_and_type.css`) |

## CONTENT FUNDAMENTALS

**Language.** The product is Vietnamese-first. All product copy, nav labels, CTAs in Vietnamese. English appears only in technical tokens (e.g. spec sheets).

**Tone.** Formal but warm — the site addresses customers with implicit respect ("Liên hệ tư vấn" = "contact for consultation", not "Buy now"). Advisory, not aggressive. No slang, no emoji, no exclamation marks in UI copy.

**Casing.** Vietnamese **Title Case** for category and product names — every significant word capitalised, including function words on category labels: *"Thiết Bị Vệ Sinh"*, *"Bồn Cầu"*, *"Chậu Lavabo"*, *"Nắp Bồn Cầu"*. Body / descriptive copy uses sentence case: *"Được hơn 50 đối tác tin tưởng"*.

**Person.** Third-person / passive for trust-statements ("Được hơn 50 đối tác tin tưởng" — "Trusted by over 50 partners"). Direct imperative for CTAs ("Liên hệ tư vấn", "Xem tất cả").

**Examples actually in the file.**
- Nav: *Sản phẩm*, *Dự án*, *Đối tác*, *Về chúng tôi*
- CTAs: *Liên hệ tư vấn* (contact consulting), *Xem tất cả* (view all)
- Categories: *Thiết Bị Vệ Sinh*, *Thiết Bị Bếp*, *Thiết Bị Nước*, *Gạch Ốp Lát*
- Sub-categories: *Bồn Cầu*, *Chậu Lavabo*, *Sen Tắm*, *Bồn Tắm*, *Phụ Kiện Phòng Tắm*, *Vòi Chậu*, *Bồn Tiểu*, *Vòi nước*, *Nắp Bồn Cầu*, *Vòi Rửa Chén*, *Chậu Rửa Chén*, *Bếp Điện Từ*, *Máy Hút Mùi*, *Máy Rửa Chén*, *Bếp Gas*, *Lò Nướng*, *Máy Nước Nóng*, *Máy Lọc Nước*, *Gạch Vân Đá Marble*, *Gạch Vân Gỗ*

**No emoji. No unicode icon glyphs.** Icons are always Lucide SVGs. Even in nav, arrows are rendered as Lucide `ChevronDown` / `ChevronRight`.

## VISUAL FOUNDATIONS

**Colors.** Single dominant brand color: DPG cyan / sky — `rgb(55,180,209)` = `#37B4D1`. A warm **stone** neutral scale (Tailwind Stone) handles everything else — text, borders, surfaces. A tiny brand tint (`#ECFEFF`, `#D2F9FD`) appears as `bg` for secondary buttons. Pure white is the dominant page background; `#FAFAF9` (stone-50) is used sparingly for alt sections. Danger red `#F24040` exists but is rare. See `colors_and_type.css`.

**Typography.** Two families:
- **Be Vietnam Pro** — the workhorse sans for all body + UI. Medium (500) is the default body weight — the Figma uses it on 176 instances. Sizes: 12, 14, 16, 20, 24, 32. 16 / 24-line-height is the workhorse. `var(--font-sans)`.
- **Playfair Display** — editorial display serif for luxury headlines, campaign h1, marketing h2, and emphasised quotations. Weights 400–900 incl. italics (italic is the *only* place italics appear — used sparingly for accent words, often in `--accent-500`). `var(--font-serif)` / `var(--font-display)`. Loaded locally from `fonts/*.ttf`.

The two pair by division of labour, not mixing: Playfair owns headlines ≥ 36px; Be Vietnam Pro owns everything under and all interactive UI. Never set Playfair on buttons, inputs, or small labels.

**Spacing.** 4-pt rhythm (4, 8, 12, 16, 20, 24, 32, 48, 64, 80). Page horizontal gutter is 80px; container max 1280px; inner section padding 32px. Megamenu columns are 280px wide with 32px gutters.

**Backgrounds.** Flat white. **No gradient backgrounds**, **no noisy textures**, **no illustrations** as page bg. Full-bleed *imagery* appears inside cards — hero banner is a single full-bleed product photo with a darker overlay-free treatment. Category cards use a subtle top-down fade-to-white over the photo so product text sits on neutral.

**Imagery.** Product photography is e-commerce-standard: bright, clean, shot on white or in warm bathroom/kitchen scenes. No b&w. No heavy grain. Cool-neutral color vibe, consistent with the brand cyan.

**Animation.** Sparse. Hover state = color change (e.g. primary button `#2D90AF → #25738E`); no scale transforms, no bounces. Dropdowns fade/open instantly. 120–200ms `cubic-bezier(0.16, 1, 0.3, 1)` easing.

**Hover states.**
- Primary buttons: bg darkens one step (`brand-500 → brand-600`).
- Outline buttons: bg goes from `stone-50` to `stone-100`.
- Ghost/link items in megamenu: text goes from `stone-400` (placeholder) or `stone-600` to `stone-900`; no bg fill.
- Nav pills: bg appears (`stone-100`) only on **focus/active**, not hover.

**Press / active.** Just a tone darker; no scale shrink. Focus state on nav pills shows a rounded (12px) stone-100 bg.

**Borders.** 1px solid `stone-200` hairlines for card outlines; `stone-300` for form inputs and outline-buttons. The only colored border is the secondary button: 1px `brand-400` over `brand-50` fill.

**Shadows.** Four-tier system, recipes lifted verbatim from figma:
- `sm` `0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)` — default buttons
- `md` `0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.06)` — header, hero banner
- `lg` `0 10px 15px rgba(0,0,0,.10), 0 4px 6px rgba(0,0,0,.05)` — elevated cards, hover
- `xl` `0 25px 50px rgba(0,0,0,.25)` — sticky header drop (strong)

No **inner** shadows. Header uses `backdrop-filter: blur(7.3px)` on a white/opaque bg — an optional translucency effect.

**Corner radii.**
- `8px` — buttons (default)
- `12px` — icon-only buttons, thumbnails, focus pills
- `16px` — category cards
- `5px` — wireframe containers only (dashed, designer-mode, not production)

**Cards.**
- **Category card** — 280×192, `16px` radius, 1px `stone-200` border, `lg` shadow, photo fades into a flat white strip where the title sits in stone-800.
- **Subcategory thumbnail** — 124×150 tile, 12px radius, `stone-50` bg, `lg` shadow on hover; centered product image + centered 14px label.
- **Hero banner** — full-width image card, 8px radius, `md` shadow, with two 48×48 outline circular nav buttons overlaid.

**Transparency & blur.** Used only on the sticky header (7.3px blur, white@~100%). No glassmorphism elsewhere.

**Layout rules.** Fixed elements: top nav (88px tall, sticky), logo-left / nav-center / actions-right, 1280px max container with 32px inner gutter.

## ICONOGRAPHY

**Icon system: Lucide.** The figma "icon" page is wall-to-wall Lucide glyphs (ChevronDown, ShoppingCart, PhoneCall, Menu, Search, Heart, etc.) — verified by name inventory. We load them via the Lucide CDN (no local copy needed; this keeps the kit tiny and always up-to-date):

```html
<script src="https://unpkg.com/lucide@latest"></script>
```

- **Stroke weight:** 2px (Lucide default).
- **Sizes:** 16, 20, 24 px. `24` on buttons, `20` in dense nav, `16` inline with body text.
- **Color:** inherits `currentColor` — stone-700 inline, white inside primary buttons, brand-500 on CTAs like "Xem tất cả →".
- **No emoji. No unicode arrow glyphs. No png icons.** The only png image is the DPG logo.

## Logos & Brand Assets

- `assets/logo-dpg.png` — horizontal logomark + wordmark "ĐỒNG PHÚ GIA / Đồng hành - Phát triển" in brand cyan. 184×36 rendered size in header.
- `assets/hero-banner.png` — primary homepage hero image.
- `assets/thumb-*.png` — ten real product thumbnails (toilet, bathtub, shower, faucets, lavabo, accessories, urinal, toilet-lid).
- `assets/cat-bath.png` — category card illustration.

## Notes / Substitutions

- Font files: we load Be Vietnam Pro from **Google Fonts** rather than the uploaded ZIP for zero-setup portability. The zip is preserved in `uploads/` as-is.
- Icons: loaded from **Lucide CDN** — the Figma uses a Lucide-based system verbatim, so this is a 1:1 match, not a substitution.
