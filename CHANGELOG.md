# Changelog

Tất cả thay đổi quan trọng của dự án Đông Phú Gia sẽ được ghi lại tại đây.

## [Unreleased] - Project Cleanup & Docs Consolidation (2026-03-27)

### Changed
- **Project Cleanup**: Dọn dẹp root directory (xóa 10+ file rác), tổ chức `scripts/` thành 4 subfolders
- **Docs Consolidation**: Gộp 42 file trong `docs/` thành `DOCS.md` duy nhất
- **README.md**: Viết lại hoàn toàn — README của dự án Đông Phú Gia (thay README Antigravity IDE)
- **CLAUDE.md**: Cập nhật cấu trúc project, model count (53), thêm blog/partners/projects APIs

### Removed
- **`docs/` directory**: 42 file Antigravity IDE documentation (không liên quan dự án)
- **Root files rác**: `query-db.cjs`, `test_prisma.ts`, `GEMINI.new.md`, `skills-lock.json`, etc.

---

## [0.3.0] - Partners, Projects & Polish Sprint (2026-03-23)

### Added
- **Partners DB + CMS**: Bảng `partners` + Admin CMS `/admin/doi-tac` + Frontend `/doi-tac` real data
- **Projects DB + CMS**: Bảng `projects` + Admin CMS `/admin/du-an` + Frontend `/du-an` real data
- **Floating Contact Widget**: Zalo, Messenger, Phone buttons nổi trên mọi trang public
- **Hero Banners AI**: 3 banner hero tạo bằng AI + seed script
- **About Page Redesign**: Editorial layout + ảnh AI-generated cho `/ve-chung-toi`
- **Prisma Schema**: Mở rộng lên 53 models (thêm `partners`, `projects`, `dien_*` × 4, `khoa_*` × 4)
- **Performance**: `unstable_cache` cho Prisma queries — fix cold-start delays
- **TipTap SSR fix**: `immediatelyRender: false` — fix hydration mismatch

---

## [0.2.0] - Blog & Final Completion (2026-03-03)

### Added
- **Blog Backend**: 4 bảng `blog_*` + `public-api-blog.ts` + `blog-actions.ts` + Admin CMS
- **Blog Frontend**: `/blog`, `/blog/[categorySlug]`, `/blog/[categorySlug]/[postSlug]`
- **RichTextEditor**: TipTap editor cho blog posts
- **Quote Reply Modal**: Admin Dashboard phản hồi báo giá
- **SEO + Sitemap**: `sitemap.ts` crawl full 5 danh mục + blog
- **Admin Crawler**: `/admin/crawler` — tool cào dữ liệu sản phẩm

---

## [Unreleased] - Admin UI Pro Max (2026-02-15)


### Added
- **Admin UI Pro Max** — 8 User Stories hoàn thành:
  - US-1: Login page split-screen premium (gradient + form)
  - US-2: Collapsible sidebar với icon-only mode, active indicator
  - US-3: AdminHeader component (auto-breadcrumb + frosted glass)
  - US-4: Dashboard gradient stat cards (7 màu)
  - US-5: Enhanced data table (thumbnails, hover, status badges)
  - US-6: Tile products premium cards (image headers, icon badges)
  - US-7: Micro-interactions (fade-in, card-hover, press-effect, badge-pulse)
  - US-8: Design tokens overhaul (50+ tokens, 5 animations)
- **PROJECT.md** — Tài liệu handoff cho AI Agent

### Changed
- **globals.css**: Rewrite hoàn toàn — 266 lines design tokens + animations + utilities
- **sidebar-nav.tsx**: Collapsible sidebar, gradient avatar, section labels
- **layout.tsx**: Tích hợp AdminHeader, animate-page-enter, sidebar-transition
- **page.tsx (dashboard)**: Gradient stat cards, quick actions, enhanced table
- **login/page.tsx**: Split-screen layout
- **login/login-form.tsx**: Icon inputs, show/hide password, spinner
- **tile-products-client.tsx**: Image cards, icon badges, add-new card

### Infrastructure
- **.gitignore**: Thêm entries cho public/uploads/, building-materials-web/, .agent/, prisma/dev.db
- **Cleanup**: Xóa cleanup.js, tsconfig.tsbuildinfo, untracked building-materials-web/

---

## [0.1.0] - MVP Sprint (2026-02-13)

### Added
- **Image Upload API** (`/api/upload`): Upload ảnh JPG/PNG/WebP/GIF (max 5MB) vào `public/uploads/`
- **ImageUploader Component** (`components/ui/image-uploader.tsx`): Drag-drop, multi-file, preview, remove
- **ProductType CRUD Actions** (`lib/actions.ts`): `createProductType()`, `updateProductType()`, `deleteProductType()` với Zod validation
- **ProductType Dialog** (`gach-op-lat/product-type-dialog.tsx`): Dialog tạo/sửa loại gạch với auto-slug và image upload
- **Admin Page CRUD UI** (`gach-op-lat/tile-products-client.tsx`): Nút thêm, dropdown sửa/xóa, confirm dialog
- **CHANGELOG.md**: Hệ thống theo dõi thay đổi

### Changed
- **Admin Gạch ốp lát page** (`gach-op-lat/page.tsx`): Chuyển sang kiến trúc Server Component + Client Component tách biệt
- **Tile Product Form** đã tích hợp sẵn upload qua `/api/upload`

### Infrastructure
- **Database**: Supabase PostgreSQL (production-ready)
- **Schema**: 12 models (AdminUser, Category, Brand, ProductType, Collection, Product, Banner, Post, Partner, Project, QuoteRequest, QuoteItem)
- **Seed data**: 5 categories, 20 product types, 8 collections, 15+ products, 3 banners, 3 posts, 5 partners, 2 projects
