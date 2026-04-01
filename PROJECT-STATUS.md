# PROJECT STATUS — Đông Phú Gia

> Cập nhật: 02/04/2026 (00:10 — sau kế hoạch V2 Sprint Roadmap)  
> Linear: [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)  
> **Cập nhật file này sau mỗi milestone hoàn thành.**

---

## Trạng thái hiện tại

| Metric | Value |
|--------|-------|
| Build | ✅ TypeScript PASS |
| Prisma | 53 models |
| Database | Supabase PostgreSQL (production) |
| Deploy | ✅ Live tại dongphugia.com.vn (31/03/2026) |
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

---

## Sprint 1 — Hoàn thành ✅

| Issue | Nội dung | Ngày xong |
|-------|---------|-----------|
| LEO-307 | Cleanup folder — xóa 75MB dữ liệu thừa | 29/03/2026 |
| LEO-308 | Clone fresh + cleanup codebase | 30/03/2026 |
| LEO-289-291 | DB Audit + xóa dien_*/khoa_* | 30/03/2026 |
| LEO-309-319 | Agent Framework: Rules, Commands, Profiles | 30-31/03/2026 |
| LEO-292 | Vercel deploy production | 30/03/2026 |
| LEO-278 | DNS trỏ dongphugia.com.vn | 31/03/2026 |
| LEO-320 | Phân tích data hita.com.vn | 31/03/2026 |
| LEO-321 | Hita crawler + import 5,254 SP | 01/04/2026 |
| LEO-322 | Mirror 5,254 ảnh hita → Supabase Storage | 01/04/2026 |

---

## Issues đang Active

### 🔄 In Progress

| Issue | Nội dung | Tiến độ | ETA |
|-------|---------|---------|-----|
| **LEO-323** | Gallery crawl TBVS | 🔄 1,100/4,467 SP (99.8% có gallery) | ~04:30 sáng 02/04 |

---

## V2 — Sprint Queue (Backlog — chờ PM approve)

> Chi tiết xem `PLAN-v2-sprint-roadmap.md` (artifact)  
> Linear Milestones: Sprint 2 (26/04) → Sprint 3 (10/05) → Sprint 4 (31/05)

### 🗄️ Sprint 2 — Database + Design (02/04 → 26/04)

| Issue | Nội dung | Status | Phụ thuộc |
|-------|---------|--------|-----------|
| LEO-294 | Design system mới (tokens, palette) | Backlog | PM: reference sites |
| LEO-295 | Redesign base components | Backlog | LEO-294 done |
| **LEO-326** *(đề xuất)* | Dead URL detector — 5,254 SP | Chờ PM | LEO-323 done |
| **LEO-327** *(đề xuất)* | Price refresh từ hita | Chờ PM | LEO-323 done |
| **LEO-328** *(đề xuất)* | Gallery BEP + NUOC | Chờ PM | LEO-323 TBVS eval |
| **LEO-330** *(đề xuất)* | Data strategy Gạch + Sàn gỗ | Chờ PM | PM decision |

### 🛒 Sprint 3 — Cart + Redesign (27/04 → 10/05)

| Issue | Nội dung | Status |
|-------|---------|--------|
| LEO-298 | Backend Orders schema + Admin CMS | Backlog |
| LEO-299 | Frontend Cart + Checkout flow | Backlog |
| LEO-300 | Redesign pages (Homepage, Category, Product) | Backlog |
| **LEO-331** *(đề xuất)* | Product image gallery UI (carousel/lightbox) | Chờ PM |

### ✨ Sprint 4 — Polish + Launch (11/05 → 31/05)

| Issue | Nội dung | Status |
|-------|---------|--------|
| LEO-303 | SEO: Schema markup + Lighthouse >90 | Backlog |
| LEO-304 | Mega Dropdown Menu | Backlog |
| LEO-302 | Fix ảnh Gạch/Sàn gỗ (vietceramics) | Backlog |
| LEO-305 | Blog content thực (10+ bài) | Backlog |
| LEO-306 | E2E Testing + Final Deploy V2 | Backlog |

---

## 📌 Data Strategy (cập nhật 02/04/2026)

| Category | Nguồn | Products | Ảnh chính | Gallery | Status |
|---|---|---|---|---|---|
| TB Vệ Sinh | hita.com.vn | **4,472 SP** | ✅ Supabase | 🔄 Crawling (1,100/4,467) | In Progress |
| TB Bếp | hita.com.vn | **597 SP** | ✅ Supabase | ⏸️ Chờ TBVS eval | Pending |
| Vật Liệu Nước | hita.com.vn | **185 SP** | ✅ Supabase | ⏸️ Chờ TBVS eval | Pending |
| Gạch Ốp Lát | TDM/vietceramics | — | ❌ 400 broken | — | ⚠️ Chờ PM decision |
| Sàn Gỗ | TDM | — | ❌ 400 broken | — | ⚠️ Chờ PM decision |

---

## 🔴 Quyết định cần PM (chốt trước 05/04)

| # | Câu hỏi | Options |
|---|---------|---------|
| 1 | DB Restructure approach? | **C-Hybrid (Khuyến nghị)** / A-Giữ nguyên / B-Gộp hoàn toàn |
| 2 | Gạch + Sàn gỗ thiếu ảnh? | A-Download vietceramics / B-Nguồn mới / **C-Tạm ẩn** |
| 3 | Design reference sites? | PM cung cấp |
| 4 | Approve Cart/Checkout Sprint 3? | Yes / No |
| 5 | Approve LEO-326/327 (hita enrichment)? | Yes / No |

---

## Scope loại bỏ

- `dien_*` (Điện) — đã xóa khỏi DB + Prisma schema (LEO-291)
- `khoa_*` (Khóa) — đã xóa khỏi DB + Prisma schema (LEO-291)
- TDM data cho TBVS/Bếp/Nước — pivot sang hita (LEO-321)
