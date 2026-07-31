# PROJECT-STATUS — Đông Phú Gia

> **Current update:** 01/08/2026 — platform/domain migration in progress.
> Đọc `docs/operations/MIGRATION-CHARTER.md` và hand-off mới nhất trước mọi
> mutation. Nội dung snapshot 27/05/2026 ở nửa sau file là lịch sử sản phẩm.

## Trạng thái migration hiện tại

| Area | Current verified state | Next gate |
|---|---|---|
| Public production | `www.dongphugia.com.vn` chạy trên Vercel; old apex redirect 307 tới `www` | Giữ nguyên làm rollback |
| Target domain | `www.dongphugia.vn`; apex sẽ redirect 308 | Chưa đổi DNS/traffic |
| PR #26 | Head `9aa93c3c565e23e459d4e4f24ba363805ab88134`; required checks xanh | Giữ exact green evidence |
| Accepted source | `090ff89c981f8c6b2d851bf99d7fb8572dacc4da` application baseline | Không dùng experimental red head |
| Staging | Accepted digest `sha256:65fd6460f910468bba5e6d131e45ad63bcf6cd9fb1e067ffe0398423212e03df` | Giữ stable |
| Dark production | Production-specific digest `sha256:e5eaadf454abe9b01bb35389e80b0828dac237d9cb4195dc289345627bfeab9b` validated without public traffic | Re-verify before cutover |
| Target PostgreSQL | Provisioned/validated with TLS `verify-full` | Production data not migrated |
| Bunny media | Read and disposable object smoke passed | No production reference mutation |
| Data cutover | Not started | New `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE` |
| DNS/TLS cutover | Target `www.dongphugia.vn` chưa resolve công khai | Zone exports, TLS and `DNS-SWITCH-APPROVAL-GATE` |

The reserved 31/07/2026 maintenance window has expired. It grants no authority
for an action on or after 01/08/2026. PM must approve a new window and named
operators before write-freeze or DNS mutation.

## Current critical path

1. Obtain full `.vn` zone export from Mắt Bão and `.com.vn` export from
   P.A Việt Nam without changing records.
2. Refresh backup/restore/reconciliation evidence for the selected cutover
   window.
3. Re-verify exact source/image/dark deployment, target TLS and rollback.
4. Present the production-data gate with downtime, owners and rollback trigger.
5. After approved data cutover and acceptance, present the DNS gate.
6. Keep Vercel and old domain through observation; delay old-domain redirect.

## Hard stops

- No production write-freeze, final dump/copy or target production writes
  without a new data-gate approval.
- No DNS, nameserver, canonical traffic or old-domain redirect without DNS-gate
  approval.
- No deletion/change of Vercel rollback or the old domain during observation.
- One mutation owner per resource; every takeover uses the operations hand-off
  standard.

---

## Historical product snapshot — 27/05/2026

The sections below are retained for product/application context. Where they
conflict with the current migration charter, the charter and latest verified
hand-off take precedence.

---

## Tình trạng tổng thể

| | |
|--|--|
| **Production** | ✅ Live tại `dongphugia.com.vn` — đang chạy tốt |
| **Build** | ✅ Ổn định |
| **Database** | ✅ PostgreSQL Supabase — 29 models, unified schema |
| **Admin** | ✅ RBAC 3 roles hoạt động đầy đủ |
| **Cart/Checkout** | ✅ Hoạt động — Zustand + localStorage + POST /api/orders |

---

## ✅ Đã hoàn thành (tính đến 27/05/2026)

### Core Platform
- [x] Next.js 16 App Router + TypeScript + Tailwind v4
- [x] PostgreSQL schema — 29 models (unified, đã tái cấu trúc từ schema cũ 53 models)
- [x] Prisma ORM + Supabase
- [x] Bunny CDN tích hợp cho ảnh sản phẩm

### Frontend Public
- [x] Homepage — HeroBanner, BrandSlider, Featured Products ×4, Blog preview, Contact form
- [x] Category pages — 4 danh mục với filter sidebar + mobile drawer
- [x] Product detail — gallery, variant selector (TOTO), price, CTA
- [x] Cart drawer + Cart page (`/gio-hang`)
- [x] Checkout form + Order success (`/dat-hang-thanh-cong`)
- [x] Tìm kiếm full-text (`/tim-kiem`) — PostgreSQL tsvector + ILIKE fallback
- [x] Blog listing + detail (`/tin-tuc` rewrite → `/blog`)
- [x] Liên hệ, Về chúng tôi, Đối tác, Dự án, Dịch vụ lắp đặt
- [x] 6 trang Chính sách pháp lý & Footer links (LEO-446)

### Admin CMS
- [x] Auth — bcrypt + session DB, rate limit 5 attempts/IP
- [x] RBAC — 3 roles: admin / sale_manager / sale
- [x] Product CRUD — 40+ fields, TipTap editor, dnd-kit image gallery
- [x] Orders — status workflow, A4 print, staff assignment
- [x] Quote requests — Quote Builder, A4 print, VAT config
- [x] Customer CRM
- [x] Blog CMS — TipTap editor, tags, SEO fields, draft/published
- [x] Users management — create/edit/deactivate

### SEO & Infrastructure
- [x] JSON-LD — LocalBusiness, Product, BreadcrumbList, Article
- [x] Sitemap (dynamic, 2000 products/file)
- [x] 3,323 old slug redirects (Edge Middleware + JSON map)
- [x] OpenGraph + meta tags
- [x] GTM integration
- [x] Maintenance mode (env flag)
- [x] Health endpoint `/api/health`

### Data
- [x] TOTO — sản phẩm đầy đủ nhất, variant system đang chạy
- [x] INAX, Caesar, Kohler và các brand khác — cơ bản

---

## 🔄 Đang phát triển

### Variant System — Nâng cấp
- **Trạng thái:** Logic cơ bản đã chạy tốt với TOTO
- **Cần làm:** Nâng cấp để áp dụng cho các brand khác (INAX, Caesar, v.v.)
- **Blocker:** Cần spec từ Tech Lead trước khi implement

### QR VietQR — Checkout
- **Trạng thái:** Thông tin tài khoản ngân hàng ĐPG đã có, chưa build
- **Cần làm:** Tích hợp QR vào trang `/dat-hang-thanh-cong`

### Design System
- **Trạng thái:** Implement một phần
- **Cần làm:** Hoàn thiện color palette + typography áp dụng đồng bộ toàn site

---

## 🔴 Known Issues cần xử lý

### Security (cần đánh giá trước khi fix)
| # | Issue | Location | Risk |
|---|-------|----------|------|
| 1 | Upload API không có auth | `/api/upload-image` | Ai cũng upload được lên Bunny CDN |
| 2 | Orders API không có rate limit | `/api/orders` | Có thể bị spam |
| 3 | Search API không có rate limit | `/api/search` | Có thể bị abuse |

> **Note:** Tech Lead cần đánh giá risk thực tế trước khi prioritize fix.

### Technical Debt (medium)
| # | Issue | Chi tiết |
|---|-------|---------|
| 4 | `images.unoptimized: true` | Next.js image optimization bị tắt — lý do chưa rõ |
| 5 | Revenue chart không dùng | `revenue-chart.tsx` tồn tại nhưng không import vào dashboard |
| 6 | Admin sidebar thiếu entries | Banners, Đối tác, Dự án có pages nhưng không trong sidebar |
| 7 | Dead links sidebar | Settings, Feedback, Support — không có trang thực tế |
| 8 | Dual order number format | REST API dùng `DPG-YYYYMMDD-XXXX`, Server Action dùng 6-digit random |

---

## 📋 Backlog (chưa lên lịch)

Theo thứ tự ưu tiên PM đã xác nhận (27/05/2026):

1. **Security assessment + fix** — Đánh giá 3 issues trên, implement fix phù hợp
2. **Variant system upgrade** — Nâng cấp để apply cho các brand khác ngoài TOTO
3. **Data expansion** — Crawl thêm INAX, Caesar, Kohler; hoàn thiện dữ liệu Gạch + Nước
4. **SEO optimization** — Lighthouse >90, internal linking, URL structure
5. **QR VietQR** — Tích hợp vào checkout
6. **Design system** — Hoàn thiện và đồng bộ toàn site
7. **Admin UX fixes** — Sidebar entries, dead links, revenue chart
8. **Thanh toán online** — VNPay/MoMo/ZaloPay (long-term)

---

## 📁 Cấu trúc tài liệu

| File | Nội dung |
|------|---------|
| `CLAUDE.md` | Tech conventions, workflow, rules — đọc mỗi session |
| `PROJECT-STATUS.md` | File này — snapshot hiện tại |
| `GEMINI.md` | Antigravity agent config |
| `docs/HANDOVER.md` | Bàn giao chi tiết 27/05/2026 — kiến trúc, APIs, tất cả |
| `docs/plans/` | Scope plans lịch sử |
| `docs/prd/` | PRD documents |

---

> **Tech Lead:** Cập nhật section "Đang phát triển" và "Known Issues" khi có thay đổi.
> **Antigravity:** Đọc file này đầu mỗi session. Không tự sửa — báo Tech Lead nếu có gì sai.
