# Đông Phú Gia — Website Vật Liệu Xây Dựng

Website showcase + quản trị sản phẩm VLXD tại [dongphugia.com.vn](https://dongphugia.com.vn)

## Tech Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript 5
- **Styling**: Tailwind CSS v4 + shadcn/ui (Radix UI)
- **Database**: Supabase PostgreSQL + Prisma 5
- **Storage**: Supabase Storage (ảnh sản phẩm)
- **Deploy**: Vercel

## Tính năng

- 🏗️ **5 danh mục sản phẩm**: Gạch ốp lát, Thiết bị vệ sinh, Thiết bị bếp, Vật liệu nước, Sàn gỗ
- 📝 **Blog / Tin tức**: Hệ thống blog với editor TipTap
- 💰 **Hệ thống Báo giá**: Form yêu cầu báo giá + Admin phản hồi
- 🤝 **Đối tác & Dự án**: Quản lý Partners + Projects với Admin CMS
- ⚙️ **Admin CMS**: 14 modules quản lý (sản phẩm, blog, đối tác, dự án, banner, báo giá...)
- 🔍 **SEO**: Dynamic sitemap, meta tags cho từng sản phẩm
- 📱 **Responsive**: Tối ưu cho mobile, tablet, desktop
- 💬 **Floating Contact**: Widget Zalo, Messenger, Phone nổi trên mọi trang

## Cài Đặt

```bash
# Clone & cài đặt
git clone <repo-url>
cd dongphugia
npm install

# Cấu hình môi trường
cp .env.example .env
# Điền DATABASE_URL, ADMIN_PASSWORD, SUPABASE keys vào .env

# Generate Prisma Client
npx prisma generate
```

## Chạy Dev

```bash
npm run dev           # http://localhost:3000
npx prisma studio     # Database browser
```

## Build

```bash
npm run build         # Production build
npm run start         # Production server
```

## Cấu Trúc

```
src/
├── app/(public)/     # Frontend công khai (5 danh mục + blog)
├── app/admin/        # Admin CMS (dashboard + CRUD)
├── components/       # UI components (shadcn + custom)
└── lib/              # Prisma, actions, public APIs, auth
prisma/               # Schema + migrations + seed
scripts/              # Utility scripts (xem scripts/README.md)
```

## Tài liệu

- 📚 [DOCS.md](./DOCS.md) — Tài liệu đầy đủ (conventions, tech stack, deployment, troubleshooting)
- 🤖 [CLAUDE.md](./CLAUDE.md) — Context cho AI Agent
- 📊 [PROJECT-STATUS.md](./PROJECT-STATUS.md) — Trạng thái dự án
- 📝 [CHANGELOG.md](./CHANGELOG.md) — Lịch sử thay đổi
