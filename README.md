# Đông Phú Gia — Website Vật Liệu Xây Dựng

> **Current production:**
> [www.dongphugia.com.vn](https://www.dongphugia.com.vn) on Vercel; old apex
> redirects to `www`.
>
> **Target production:** [www.dongphugia.vn](https://www.dongphugia.vn) on
> AWS/Coolify. DNS and production data have not switched.

Website thương mại điện tử VLXD dành cho Đông Phú Gia — hỗ trợ catalogue sản phẩm, hệ thống báo giá, blog tin tức và quản trị nội dung toàn diện.

Đây là giai đoạn migration đồng thời domain và hosting. Đọc
[`docs/operations/MIGRATION-CHARTER.md`](docs/operations/MIGRATION-CHARTER.md)
trước mọi release, database hoặc DNS action. Vercel và `.com.vn` phải được giữ
nguyên làm rollback baseline cho đến hết observation window.

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Next.js 16.2.10 + React 19.2.3 + TypeScript 5.9.3 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| **Database** | PostgreSQL + Prisma ORM; chuyển từ Supabase source sang target self-hosted TLS `verify-full` |
| **Storage** | Bunny Storage/CDN, giữ compatibility với media path hiện có |
| **Auth** | Custom database-backed admin session; secure HTTP-only cookie |
| **Current deploy** | Vercel rollback baseline |
| **Target deploy** | AWS EC2 Singapore → Coolify → immutable Linux/ARM64 GHCR image |
| **Canonical target** | `https://www.dongphugia.vn` |

---

## Tính Năng Chính

- 🏗️ **Catalogue sản phẩm** — 5 danh mục: Thiết bị vệ sinh, Thiết bị bếp, Gạch ốp lát, Vật liệu nước, Sàn gỗ (~5,000 sản phẩm)
- 🛒 **Giỏ hàng & Báo giá** — Thêm vào giỏ, yêu cầu báo giá, xác nhận đơn hàng
- 📝 **Blog / Tin tức** — Hệ thống blog với TipTap editor
- 🤝 **Đối tác & Dự án** — Trang giới thiệu Partners + Projects
- ⚙️ **Admin CMS** — Dashboard quản lý sản phẩm, đơn hàng, blog, banner, đối tác
- 🔍 **SEO** — Dynamic sitemap.xml (~5,000 URLs), meta tags, Open Graph
- 📱 **Responsive** — Mobile-first, tối ưu mọi thiết bị

---

## Cài Đặt

### Yêu cầu

- Node.js 24.x
- npm 11.6.2

### Các bước

```bash
# 1. Cài đặt dependencies
npm install

# 2. Cấu hình môi trường
cp .env.example .env
# Điền đầy đủ các biến trong .env (xem hướng dẫn bên dưới)

# 3. Generate Prisma Client
npx prisma generate
```

### Biến môi trường (.env)

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | Runtime PostgreSQL URL; target production bắt buộc TLS `verify-full` |
| `DIRECT_URL` | Direct PostgreSQL URL cho tác vụ được phê duyệt |
| `NEXT_PUBLIC_SITE_URL` | Public origin theo môi trường; target production là `https://www.dongphugia.vn` |
| `SESSION_HOURS` | Thời lượng admin session |
| `WRITE_FREEZE_MODE` | Mutation guard; production chỉ được bật trong approved data-cutover window |
| `BUNNY_CDN_HOSTNAME` | Hostname Bunny CDN |

> **Lưu ý:** Xem file `.env.example` để biết đầy đủ danh sách biến cần thiết.

---

## Chạy Development

```bash
npm run dev
# → http://localhost:3000
```

```bash
npx prisma studio
# → Database browser tại http://localhost:5555
```

---

## Build & Deploy

```bash
# Build production
npm run build

# Kiểm tra TypeScript
npx tsc --noEmit

# Chạy production server (local)
npm run start
```

Release target không được suy ra chỉ từ branch hoặc tag. Quy trình production:

1. Exact PR head phải xanh.
2. Build immutable Linux/ARM64 image, xác minh digest, SBOM, provenance và scan.
3. Deploy đúng digest vào staging/dark production và chạy acceptance.
4. Production data chỉ được chuyển sau
   `PRODUCTION-DATA-WRITE-FREEZE-APPROVAL-GATE`.
5. Domain/traffic chỉ được chuyển sau `DNS-SWITCH-APPROVAL-GATE`.

Vercel tiếp tục phục vụ `.com.vn` trong giai đoạn chuyển tiếp và không được xóa
hoặc thay đổi chỉ vì target image đã dark-deploy thành công.

---

## Cấu Trúc Thư Mục

```
src/
├── app/
│   ├── (public)/         # Public frontend (catalogue, blog, giỏ hàng...)
│   │   ├── page.tsx      # Trang chủ
│   │   ├── thiet-bi-ve-sinh/   # Danh mục TB Vệ sinh
│   │   ├── thiet-bi-bep/       # Danh mục TB Bếp
│   │   ├── gach-op-lat/        # Danh mục Gạch
│   │   ├── vat-lieu-nuoc/      # Danh mục Vật liệu nước
│   │   ├── gio-hang/           # Giỏ hàng
│   │   ├── blog/               # Blog tin tức
│   │   ├── doi-tac/            # Đối tác
│   │   └── du-an/              # Dự án
│   ├── admin/            # Admin CMS (yêu cầu đăng nhập)
│   ├── api/              # API routes (orders, quote-requests, upload...)
│   ├── actions/          # Server actions
│   └── maintenance/      # Trang bảo trì
├── components/
│   ├── ui/               # shadcn/ui base components
│   ├── layout/           # Header, Footer, Navigation
│   ├── product/          # Product Card, Gallery, Specs
│   ├── category/         # Category filters, grid
│   ├── cart/             # Cart drawer, checkout
│   ├── blog/             # Blog components
│   └── home/             # Home page sections
├── lib/
│   ├── prisma.ts         # Prisma client
│   ├── public-api-products.ts  # Product API layer
│   ├── actions.ts        # Server actions
│   ├── order-actions.ts  # Order management
│   └── admin-auth.ts     # Admin authentication
prisma/
├── schema.prisma         # Database schema (~23 models)
scripts/
├── seed/                 # Database seeding scripts
├── product-import/       # Product import utilities
└── db/                   # DB utility scripts
```

---

## Admin CMS

Truy cập: `/admin`. Admin credential được quản lý ngoài repository và không
được ghi vào tài liệu, commit hoặc chat.

**Modules:**
- 📦 Sản phẩm (CRUD + ảnh + variants)
- 📋 Đơn hàng (xem + cập nhật trạng thái)
- 📝 Blog (tạo/sửa/xóa bài viết)
- 🖼️ Banner (quản lý banner trang chủ)
- 🤝 Đối tác (danh sách partner)
- 🏗️ Dự án (portfolio dự án đã làm)

---

## Liên Hệ & Hỗ Trợ

- **Current website:** [www.dongphugia.com.vn](https://www.dongphugia.com.vn)
- **Target canonical:** [www.dongphugia.vn](https://www.dongphugia.vn)
- **Email:** info@dongphugia.com.vn
