# PROJECT STATUS — Đông Phú Gia

> Cập nhật: 30/03/2026
> Linear: [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)
> **Cập nhật file này sau mỗi milestone hoàn thành.**

---

## Trạng thái hiện tại

| Metric | Value |
|--------|-------|
| Build | ✅ TypeScript PASS |
| Prisma | 53 models |
| Database | Supabase PostgreSQL (production) |
| Deploy | ⏳ Pending (Vercel — LEO-277) |
| Git | `main` branch, clean |

---

## V1 — Hoàn thành ✅

### Backend + Frontend (5 danh mục)
- ✅ Gạch ốp lát: Server Actions + Public API + Admin CMS + Public pages
- ✅ TB Vệ sinh: Server Actions + Public API + Admin CMS + Public pages
- ✅ TB Bếp: Server Actions + Public API + Admin CMS + Public pages
- ✅ Vật liệu nước: Server Actions + Public API + Admin CMS + Public pages
- ✅ Sàn gỗ: Server Actions + Public API + Admin CMS + Public pages

### Content & Pages
- ✅ Blog: 4 bảng (posts, categories, tags, comments), TipTap editor, admin + public
- ✅ Đối tác (Partners): DB + Admin CMS + Public page
- ✅ Dự án (Projects): DB + Admin CMS + Public page
- ✅ Về chúng tôi (About): Editorial layout + AI-generated images
- ✅ Trang chủ: Hero banners (3 AI images), featured sections, blog section, projects section

### Infrastructure
- ✅ Auth: HMAC-SHA256 cookie
- ✅ ImageUploader → Supabase Storage
- ✅ Sitemap động: 5 danh mục + blog
- ✅ Quote Request system: submit + admin manage status
- ✅ Admin Crawler: AI-powered product data ingestion (Gemini)
- ✅ Floating Contact Widget: Zalo, Messenger, Phone

### Vừa xong
- ✅ LEO-307: Cleanup folder — xóa 75MB dữ liệu thừa (30/03/2026)
- ✅ Deploy Vercel thành công (30/03/2026) — Vercel nhận CI từ GitHub

---

## V2 — Sprint 2 (29/03 → 31/05/2026)

> Chi tiết xem `PROJECT-SCOPE-V2.md`

| Workstream | Nội dung | Status |
|-----------|---------|--------|
| WS1 | Database audit — 53 models, simplify, add Cart/Order | 🔜 |
| WS2 | Design System overhaul — new color palette, 90% redesign | 🔜 |
| WS3 | Shopping Cart + Checkout (localStorage, bank transfer) | 🔜 |
| WS4 | Data cleanup — validate products, fix images, enhance SEO | 🔜 |
| WS5 | Deployment + E2E testing | 🔜 |
| WS6 | Content + Polish — blog thực, mega menu, performance | 🔜 |

---

## Issues đang active (xem Linear để chi tiết)

| Issue | Nội dung | Priority | Milestone |
|-------|---------|----------|-----------|
| LEO-277 | Deploy Vercel production + DNS | Urgent | Sprint 1 (07/04) |
| LEO-278 | DNS & SSL cho dongphugia.com.vn | Urgent | Sprint 1 (07/04) |
| LEO-285 | Import ~3,787 SP từ TDM vào DB | High | Sprint 2 (31/05) |
| LEO-279 | Fix ảnh crawler hotlink bị 400 | High | Sprint 2 (31/05) |
| LEO-286 | SEO: schema markup, Open Graph, CWV | Medium | Sprint 2 (31/05) |
| LEO-287 | Nhập nội dung Blog thực | Medium | Sprint 2 (31/05) |
| LEO-284 | Mega dropdown menu navigation | Low | Sprint 2 (31/05) |

---

## Scope loại bỏ

- `dien_*` (Điện) — 5 bảng còn trong DB schema, KHÔNG phát triển
- `khoa_*` (Khóa) — 5 bảng còn trong DB schema, KHÔNG phát triển
