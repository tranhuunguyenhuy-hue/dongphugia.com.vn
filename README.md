# Đông Phú Gia - Website Vật liệu Xây dựng

Website thương mại điện tử chuyên về vật liệu xây dựng: gạch ốp lát, thiết bị vệ sinh, thiết bị bếp, sàn gỗ.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Database**: SQLite (dev) / PostgreSQL (prod) via Prisma ORM
- **Auth**: NextAuth.js

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Generate Prisma client & run migrations
npx prisma generate
npx prisma migrate dev

# 4. Seed database
npx prisma db seed

# 5. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── admin/              # Admin panel
│   │   ├── login/          # Admin login
│   │   ├── products/       # Product CRUD
│   │   ├── layout.tsx      # Admin sidebar layout
│   │   └── page.tsx        # Admin dashboard
│   ├── api/auth/           # NextAuth API
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Homepage
├── components/ui/          # Shadcn UI components
├── lib/
│   ├── actions.ts          # Server actions
│   ├── prisma.ts           # Prisma client
│   └── utils.ts            # Utilities
├── auth.ts                 # NextAuth config
├── auth.config.ts          # Auth callbacks
└── middleware.ts            # Route protection
prisma/
├── schema.prisma           # Database schema
├── seed.ts                 # Seed data
└── migrations/             # Migration history
```

## Admin Access

- URL: `/admin`
- Email: `admin@dongphugia.com`
- Password: `adminpassword123`
