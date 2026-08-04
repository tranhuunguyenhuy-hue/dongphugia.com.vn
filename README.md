# Đông Phú Gia — Website Vật Liệu Xây Dựng

> **Website:** [www.dongphugia.vn](https://www.dongphugia.vn)
> **Admin:** [www.dongphugia.vn/admin](https://www.dongphugia.vn/admin)

Website thương mại điện tử VLXD dành cho Đông Phú Gia — hỗ trợ catalogue sản phẩm, hệ thống báo giá, blog tin tức và quản trị nội dung toàn diện.

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Next.js 16 + React 19 + TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui (Radix UI) |
| **Database** | AWS PostgreSQL + Prisma ORM |
| **Storage** | Bunny CDN (`cdn.dongphugia.com.vn`) |
| **Auth** | HMAC-SHA256 cookie (Admin only) |
| **Deploy** | AWS EC2/Coolify, immutable ARM64 image |

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

- Node.js >= 18
- npm >= 9

### Các bước

```bash
# 1. Cài đặt dependencies
npm ci

# 2. Cấu hình môi trường
cp .env.example .env
# Điền đầy đủ các biến trong .env (xem hướng dẫn bên dưới)

# 3. Generate Prisma Client
npx prisma generate
```

### Biến môi trường (.env)

| Biến | Mô tả |
|------|-------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct URL cho Prisma migrations |
| `ADMIN_PASSWORD` | Mật khẩu Admin CMS |
| `ADMIN_JWT_SECRET` | Secret key cho JWT session |
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

Merge vào `main` không tự động deploy production. Rollout AWS/Coolify cần PM
window, exact immutable ARM64 image, backup và rollback gates theo
[`docs/WORKFLOW-WITH-CODEX.md`](docs/WORKFLOW-WITH-CODEX.md).

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

Truy cập: `/admin` → Đăng nhập bằng `ADMIN_PASSWORD`

**Modules:**
- 📦 Sản phẩm (CRUD + ảnh + variants)
- 📋 Đơn hàng (xem + cập nhật trạng thái)
- 📝 Blog (tạo/sửa/xóa bài viết)
- 🖼️ Banner (quản lý banner trang chủ)
- 🤝 Đối tác (danh sách partner)
- 🏗️ Dự án (portfolio dự án đã làm)

---

## Liên Hệ & Hỗ Trợ

- **Website:** [www.dongphugia.vn](https://www.dongphugia.vn)
- **Email:** info@dongphugia.com.vn
