# Đông Phú Gia — Conventions & Rules

> File này chứa quy tắc kỹ thuật chung cho TẤT CẢ agents (Claude Code, Antigravity, Gemini).
> Đọc file này trước khi bắt đầu bất kỳ task nào.
> Cập nhật: 27/03/2026

---

## Dự án

**Đông Phú Gia** (`dongphugia.com.vn`) — Website showcase VLXD, không giỏ hàng, dùng hệ thống Báo giá.

**5 danh mục:** Gạch ốp lát, TB Vệ sinh, TB Bếp, Sàn gỗ, Vật liệu nước.

**Scope loại bỏ:** `dien_*` (Điện), `khoa_*` (Khóa) — schema còn trong DB, KHÔNG phát triển.

---

## Tech Stack

```
Frontend:   Next.js 16 + React 19 + TypeScript 5
Styling:    Tailwind CSS v4 (@theme directive — KHÔNG có tailwind.config.js)
UI:         shadcn/ui (Radix UI) + Lucide React icons
Auth:       HMAC-SHA256 cookie (ADMIN_PASSWORD + AUTH_SECRET)
Database:   Supabase PostgreSQL
ORM:        Prisma 5.22.0 (53 models)
Storage:    Supabase Storage (bucket: images)
Deploy:     Vercel
```

---

## Conventions

### Ngôn ngữ
- Giao tiếp: Tiếng Việt
- Biến/hàm/file: Tiếng Anh (camelCase)
- Comments: Tiếng Anh
- UI text: Tiếng Việt

### Tailwind CSS v4
- KHÔNG tạo `tailwind.config.js`
- Config trong `src/app/globals.css` → block `@theme { }`
- ĐỪNG sửa dòng `@source ".."`
- Design tokens: Primary `#16a34a`, Foreground `#0f172a`, Border `#e2e8f0`, Destructive `#ef4444`

### Image Upload
- Dùng `<ImageUploader>` → Supabase Storage
- KHÔNG lưu vào `public/uploads/` (broken trên Vercel)
- Domain: `tygjmrhandbffjllxveu.supabase.co`

### Server Actions
- File: `src/lib/{entity}-actions.ts` + Zod schemas cùng file
- KHÔNG dùng `redirect()` trong programmatic call → return `{ success: true }`
- `redirect()` chỉ OK trong loginAction/logoutAction

### Admin CRUD Pattern
```
admin/{entity}/products/
├── page.tsx                        # Server component
├── {entity}-product-form.tsx       # Client form + ImageUploader
├── {entity}-product-delete-button.tsx
├── new/page.tsx
└── [id]/page.tsx
```

### Auth
- HMAC-SHA256(ADMIN_PASSWORD, AUTH_SECRET) → cookie `dpg-admin-session`
- Files: `src/lib/admin-auth.ts` + `src/app/admin/login/actions.ts`
- Guard: `src/app/admin/(dashboard)/layout.tsx` → `verifyAdminSession()`

---

## Gotchas

- Prisma sau schema thay đổi: `npx prisma generate` + restart dev server
- PostgreSQL sequence out of sync: `SELECT setval('table_id_seq', (SELECT MAX(id) FROM table))`
- Public API caching: `cache()` + `revalidate = 3600` → ISR 1 giờ
- `slugify("Đá Marble")` → `"da-marble"` (đ → d trước normalize)
- KHÔNG dùng `prisma migrate` — DB quản lý thủ công qua SQL

---

## Quản lý dự án

**Linear:** [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0)

**Trạng thái hiện tại:** xem `PROJECT-STATUS.md`

### Workflow cho agents

1. Đọc file này (`CLAUDE.md`) — nắm conventions
2. Đọc `PROJECT-STATUS.md` — nắm trạng thái + danh sách issues
3. Lấy issue được assign từ Linear → làm theo checklist
4. Khi xong: cập nhật Linear issue status (Done) + comment kết quả

### Phân công

- **Claude Code**: Backend, Prisma, Server Actions, Admin CMS, Build fix
- **Antigravity (Tninie)**: Frontend, UI/UX, Components
- **PM (Huy + Cowork)**: Strategy, review, deploy, quản lý Linear

---

## Skills

Vị trí: `.agents/skills/` — 15 skills, symlinked cho tất cả agents.

| Task | Skills |
|------|--------|
| React / Next.js | `frontend-design`, `vercel-react-best-practices`, `nextjs-app-router-patterns` |
| Database / Prisma | `postgresql-table-design`, `sql-optimization-patterns` |
| Styling | `tailwind-design-system`, `responsive-design` |
| SEO | `seo-audit`, `schema-markup`, `programmatic-seo` |
| Testing | `webapp-testing`, `code-review-excellence` |
