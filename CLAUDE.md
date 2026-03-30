# Đông Phú Gia — Agent Handbook

> **ĐỌC FILE NÀY TRƯỚC KHI BẮT ĐẦU BẤT KỲ TASK NÀO.**
> Không đọc = không được phép thực hiện task.
> Cập nhật: 30/03/2026

---

## 1. Dự án

**Đông Phú Gia** (`dongphugia.com.vn`) — Website showcase VLXD, không có giỏ hàng, dùng hệ thống Báo giá.

| Key | Value |
|-----|-------|
| Loại | E-commerce showcase — hệ thống "Báo giá" (không có cart) |
| Ngôn ngữ UI | Tiếng Việt |
| Deploy | Vercel |
| Linear | [Đông Phú Gia - Website VLXD](https://linear.app/leonguyen/project/djong-phu-gia-website-vlxd-179a568436a0) |

**5 danh mục:** Gạch ốp lát, TB Vệ sinh, TB Bếp, Sàn gỗ, Vật liệu nước.

**Scope loại bỏ:** `dien_*` (Điện), `khoa_*` (Khóa) — schema còn trong DB, KHÔNG phát triển.

---

## 2. Tech Stack

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

## 3. Cấu trúc thư mục

```
/
├── src/
│   ├── app/
│   │   ├── (public)/          # Frontend công khai (5 danh mục, blog, about, partners, projects)
│   │   ├── admin/             # Admin CMS (14 modules, auth-protected)
│   │   └── api/               # API routes (crawler, image processing)
│   ├── components/
│   │   ├── ui/                # shadcn/ui + ImageUploader
│   │   ├── layout/            # Header, Footer, FloatingContact
│   │   ├── home/              # Homepage sections
│   │   ├── category/          # SmartFilter, CollectionCarousel, FilterDrawer
│   │   └── product/           # ProductImageGallery, ProductDetailTabs
│   └── lib/
│       ├── {entity}-actions.ts     # Server actions (Zod + Prisma)
│       ├── public-api-{entity}.ts  # Public APIs (cache() + ISR 3600s)
│       ├── admin-auth.ts           # HMAC cookie auth
│       ├── prisma.ts               # Prisma client singleton
│       └── utils.ts                # cn(), slugify() (đã fix cho đ/Đ)
├── prisma/
│   ├── schema.prisma          # Source of truth — 53 models, 1031 lines
│   └── migrations/            # SQL migration files (reference only)
├── public/
│   └── images/                # brands/, categories/, pattern-types/, icons/
├── scripts/
│   ├── db/                    # DB utility + migration scripts
│   ├── seed/                  # Seed data
│   ├── tdm-import/            # TDM product import (~3,787 sản phẩm)
│   ├── brands/                # Brand data scripts
│   └── utils/                 # Utility scripts
├── backups/
│   └── archives/              # Docs cũ + handoff logs
├── .ai/
│   └── shared/                # Cross-agent coordination (tracked bởi git)
│       ├── TASK-QUEUE.md      # Tasks cần phối hợp giữa agents
│       └── HANDOFF.md         # Handoff notes đang active
├── CLAUDE.md                  # File này — đọc đầu mỗi session
├── PROJECT-STATUS.md          # Trạng thái hiện tại — đọc đầu mỗi session
└── PROJECT-SCOPE-V2.md        # Scope V2 (29/03/2026) — tham khảo khi plan
```

---

## 4. Conventions

### Ngôn ngữ
- Giao tiếp: **Tiếng Việt**
- Biến/hàm/file: **Tiếng Anh** (camelCase)
- Comments trong code: **Tiếng Anh**
- UI text: **Tiếng Việt**

### Tailwind CSS v4 — CRITICAL
- **KHÔNG tạo `tailwind.config.js`**
- Config trong `src/app/globals.css` → block `@theme { }`
- **ĐỪNG sửa dòng `@source ".."`**
- Design tokens: Primary `#16a34a`, Foreground `#0f172a`, Border `#e2e8f0`, Destructive `#ef4444`

### Server Actions
- File: `src/lib/{entity}-actions.ts` + Zod schemas cùng file
- **KHÔNG dùng `redirect()` trong programmatic call** → `return { success: true }`
- `redirect()` chỉ OK trong loginAction/logoutAction

### Admin CRUD Pattern
```
admin/{entity}/
├── page.tsx                       # Server component — list + filter tabs
├── {entity}-form.tsx              # Client component — create + edit + ImageUploader
├── {entity}-delete-button.tsx     # Two-click delete confirmation
├── new/page.tsx                   # Create page
└── [id]/page.tsx                  # Edit page (params: Promise<{id: string}>)
```

### Image Upload
- Dùng `<ImageUploader>` → Supabase Storage (bucket: `images`)
- **KHÔNG lưu vào `public/uploads/`** (broken trên Vercel)
- Domain: `tygjmrhandbffjllxveu.supabase.co`

### Auth
- HMAC-SHA256(ADMIN_PASSWORD, AUTH_SECRET) → cookie `dpg-admin-session`
- Guard: `src/app/admin/(dashboard)/layout.tsx` → `verifyAdminSession()`

### Next.js 15+ Patterns
- `params` và `searchParams` là **Promise** — phải `await`
- `cache()` + `revalidate = 3600` → ISR 1 giờ cho public pages

---

## ⚠️ 5. STOP & ASK — Khi nào được tự làm, khi nào phải hỏi

> **ĐÂY LÀ QUY TẮC QUAN TRỌNG NHẤT.**
> Agent tự làm mà không hỏi khi không hiểu = vi phạm quy trình.

### 🔴 BẮT BUỘC phải hỏi PM trước khi làm

| Tình huống | Câu hỏi mẫu |
|-----------|-------------|
| Linear issue không có checklist chi tiết | "Issue [LEO-XXX] chưa có acceptance criteria. Cần làm gì cụ thể?" |
| Task liên quan xóa/rename bảng hoặc column DB | "Xóa bảng [X] sẽ ảnh hưởng production data. PM xác nhận?" |
| Task thay đổi API interface mà Antigravity đang dùng | "API [X] đang được dùng. Cần báo Antigravity trước khi thay?" |
| Task có vẻ thuộc scope của agent khác | "Task này là frontend. Antigravity đã làm chưa hay tôi nên làm?" |
| Phát hiện bug nghiêm trọng ngoài scope hiện tại | "Phát hiện bug [X] khi làm [Y]. Tôi có nên fix luôn không?" |
| Task yêu cầu env var mới | "Cần env var [X]. PM đã set trên Vercel chưa?" |
| Không chắc về approach khi có nhiều cách | "Có 2 cách implement [X]. Approach nào phù hợp hơn?" |
| Task liên quan đến production deploy | "Confirm deploy lên production?" |

### 🟡 Làm nhưng phải báo cáo ngay sau đó

- Phát hiện bug nhỏ khi làm task khác → Comment trên Linear issue liên quan
- Xóa/move file khi refactor → Mention rõ trong commit message
- Thay đổi naming pattern → Note trong commit

### 🟢 Được tự làm không cần hỏi

- Bug fix rõ ràng **nằm trong scope task đang làm**
- Thêm TypeScript types/interfaces
- Cập nhật comment/documentation
- Refactor code không thay đổi behavior (cùng input → cùng output)
- Thêm Zod validation cho form existing
- Fix TypeScript compile errors

### ❌ KHÔNG BAO GIỜ tự ý làm — dù PM không nhắc

- Xóa bảng/column trong production DB
- Thay đổi Prisma schema mà không có SQL migration tương ứng
- Push lên `main` mà chưa `npx tsc --noEmit` pass
- Deploy lên Vercel khi không được chỉ thị
- Thêm npm dependency major version mới
- Thay đổi auth flow
- Xóa file lớn/folder mà không có `.gitignore` hoặc backup

---

## 6. Session Start Checklist

> **Làm theo thứ tự này TRƯỚC KHI bắt đầu code mỗi session.**

```
□ 1. Đọc CLAUDE.md (file này) — section liên quan đến task
□ 2. Đọc PROJECT-STATUS.md — nắm trạng thái hiện tại
□ 3. git pull origin main — đảm bảo code mới nhất
□ 4. git status — không có conflict hay uncommitted changes
□ 5. Đọc Linear issue được assign: TOÀN BỘ description + checklist
□ 6. Nếu issue không rõ → comment hỏi PM, đợi reply trước khi code
□ 7. Xác định loại task → đọc Workflow tương ứng (Mục 7)
□ 8. Đọc skill liên quan (Mục 8) trước khi bắt đầu code
□ 9. Đọc rule files liên quan (Mục 8 — Rules) trong `.agents/rules/`
```

---

## 7. Workflows theo loại Task

### 7.1 Thêm Prisma Model + CRUD mới

**Trigger:** Tạo entity mới, thêm bảng mới vào hệ thống.

**Command:** `/new-entity` → `.agents/commands/new-entity.md`

**Skills cần đọc:** `postgresql-table-design`, `sql-optimization-patterns`

```
Step 1 — Thiết kế schema
  ├── Đọc skill postgresql-table-design
  ├── Xem prisma/schema.prisma để hiểu patterns hiện tại
  └── Design SQL: columns, types, constraints, indexes

Step 2 — Tạo bảng trong DB
  ├── Viết SQL → chạy trong Supabase Dashboard (SQL Editor)
  ├── KHÔNG dùng `prisma migrate`
  └── Verify: bảng xuất hiện trong Supabase Table Editor

Step 3 — Sync Prisma
  ├── npx prisma db pull
  ├── npx prisma generate
  └── Restart dev server (Turbopack cache cũ)

Step 4 — Server Actions
  ├── Tạo src/lib/{entity}-actions.ts
  ├── Zod schema + createAction + updateAction + deleteAction
  └── revalidatePath() sau mỗi mutation

Step 5 — Public API
  ├── Tạo src/lib/public-api-{entity}.ts
  └── Wrap tất cả queries với cache() + revalidate: 3600

Step 6 — Admin CMS
  ├── Theo Admin CRUD Pattern (Mục 4)
  ├── ImageUploader nếu entity có image field
  └── Update sidebar-nav.tsx nếu cần link mới

Step 7 — Verify
  ├── npx tsc --noEmit (zero errors)
  └── Test CRUD flow trong browser (/admin)

Step 8 — Commit + Linear
  ├── git add -A && git commit -m "feat: add [entity] CRUD ([LEO-XXX])"
  └── Update Linear: status=Done, comment kết quả
```

---

### 7.2 Bug Fix

**Trigger:** Có lỗi runtime, UI broken, data sai, form không submit được.

**Command:** `/fix-issue` → `.agents/commands/fix-issue.md`

**Skills cần đọc:** `debugging-strategies`

```
Step 1 — Reproduce
  ├── Xác định EXACT steps to reproduce
  └── Nếu không reproduce được → hỏi PM mô tả thêm, DỪNG lại

Step 2 — Kiểm tra Lessons Learned (Mục 10)
  └── Xem có bug tương tự đã gặp và có fix documented không

Step 3 — Root Cause Analysis
  ├── Dùng console.log / TypeScript error / Network tab để trace
  └── Tìm ROOT CAUSE, không fix symptom

Step 4 — Fix
  └── Fix ở 1 chỗ, tránh ripple effect sang file khác

Step 5 — Verify
  ├── Test lại exact steps to reproduce → không còn lỗi
  └── npx tsc --noEmit (zero errors)

Step 6 — Commit + Linear
  └── git commit -m "fix: [mô tả ngắn gọn] ([LEO-XXX])"
```

---

### 7.3 Build Fix (TypeScript / Next.js errors)

**Trigger:** `npm run build` hoặc `npx tsc --noEmit` có errors.

**Không cần đọc skill đặc biệt.**

```
Step 1 — Xem toàn bộ errors
  └── npx tsc --noEmit 2>&1 | head -100

Step 2 — Nhóm errors theo loại
  ├── Type mismatch → fix types
  ├── Missing props → fix component interface
  ├── Unknown property → check Prisma model vs code
  └── Import error → fix import path

Step 3 — Fix theo batch (không dùng `any` để bypass)
  └── npx tsc --noEmit sau mỗi batch để track tiến độ

Step 4 — Verify
  └── npx tsc --noEmit → zero errors

Step 5 — Commit CHỈ khi zero errors
  └── KHÔNG push code có TypeScript errors
```

---

### 7.4 Admin CMS Feature mới

**Trigger:** Thêm màn hình admin, thêm field vào form existing.

**Skills cần đọc:** `nextjs-app-router-patterns`

```
Step 1 — Xem pattern mẫu
  └── Xem src/app/admin/(dashboard)/products/ làm reference

Step 2 — Server Actions trước
  └── Tạo/update src/lib/{entity}-actions.ts với Zod validation

Step 3 — Form Component
  ├── Client component với React Hook Form + Zod
  └── ImageUploader nếu có image field

Step 4 — Pages
  └── page.tsx (list) + new/page.tsx + [id]/page.tsx

Step 5 — Sidebar Nav (nếu cần)
  └── Update src/app/admin/(dashboard)/sidebar-nav.tsx

Step 6 — Verify + Commit
  ├── Test full CRUD flow trong browser
  └── npx tsc --noEmit → commit
```

---

### 7.5 Frontend Page (Public)

**Trigger:** Tạo/cập nhật public page.

**Skills cần đọc:** `nextjs-app-router-patterns`, `frontend-design`, `vercel-react-best-practices`

```
Step 1 — Check API available
  └── Đọc src/lib/public-api-{entity}.ts — data nào có sẵn

Step 2 — Check pattern mẫu
  └── Xem src/app/(public)/gach-op-lat/ làm reference

Step 3 — Implement
  ├── Server Component cho data fetching
  ├── Client Component cho interactive UI
  └── ISR: export const revalidate = 3600

Step 4 — Verify
  ├── Test responsive: mobile/tablet/desktop
  └── npx tsc --noEmit → commit
```

---

### 7.6 Database Schema Change

**Trigger:** Thêm column, index mới, thay đổi constraint.

**Command:** `/db-change` → `.agents/commands/db-change.md`

**⚠️ KHÔNG xóa column/bảng mà không hỏi PM trước.**

**Skills cần đọc:** `postgresql-table-design`, `sql-optimization-patterns`

```
Step 1 — Viết SQL migration
  ├── Tạo file scripts/db/migration-{YYYY-MM-DD}-{description}.sql
  └── Test trong Supabase Dashboard trước

Step 2 — Chạy SQL
  ├── Chạy trong Supabase SQL Editor
  └── Verify không có data loss

Step 3 — Sync Prisma
  ├── npx prisma db pull
  ├── npx prisma generate
  └── Restart dev server

Step 4 — Update code nếu cần
  ├── Update Zod schemas
  ├── Update form components
  └── Update TypeScript types

Step 5 — Verify + Commit
```

---

### 7.7 Deploy lên Vercel

**Trigger:** PM yêu cầu deploy. ⚠️ KHÔNG tự ý deploy.

**Command:** `/deploy` → `.agents/commands/deploy.md`

```
Step 1 — Verify local
  ├── npx tsc --noEmit (zero errors)
  ├── git status (working tree clean)
  └── git push origin main

Step 2 — Confirm env vars với PM
  └── DATABASE_URL, DIRECT_URL, AUTH_SECRET, ADMIN_PASSWORD,
      NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

Step 3 — Deploy
  └── npx vercel --prod

Step 4 — Verify production
  ├── Mở URL production → check homepage
  ├── Check /admin/login hoạt động
  └── Report kết quả cho PM trên Linear
```

---

### 7.8 Cleanup / Refactor

**Trigger:** LEO task cleanup, remove dead code, tổ chức lại files.

**⚠️ Confirm với PM trước khi xóa file quan trọng.**

```
Step 1 — Audit
  ├── List tất cả files/code sẽ xóa/move
  └── grep -r "[filename|pattern]" src/ để check references

Step 2 — Confirm
  └── Báo danh sách cho PM, đợi confirm

Step 3 — Backup nếu cần
  └── Copy vào backups/archives/ trước khi xóa

Step 4 — Execute
  ├── Xóa/move files
  └── Update imports bị broken

Step 5 — Verify
  ├── npx tsc --noEmit (zero errors)
  └── grep để check không còn broken references

Step 6 — Commit
  └── git commit -m "chore: [mô tả cleanup] ([LEO-XXX])"
```

---

## 8. Skills → Task Mapping

> **Đọc skill TRƯỚC khi bắt đầu code task tương ứng.**
> Vị trí: `.agents/skills/{skill-name}/` (symlinked, available cho tất cả agents)

| Task | Skill cần đọc |
|------|--------------|
| Thiết kế bảng DB, thêm model | `postgresql-table-design` |
| Tối ưu SQL query, indexes | `sql-optimization-patterns` |
| Next.js pages, Server/Client components | `nextjs-app-router-patterns` |
| React components, UI patterns | `frontend-design` |
| Performance, bundle size, React patterns | `vercel-react-best-practices` |
| Tailwind styling, design tokens | `tailwind-design-system` |
| Responsive layout, mobile-first | `responsive-design` |
| REST API design | `api-design-principles` |
| Node.js backend, middleware | `nodejs-backend-patterns` |
| SEO audit, meta tags, indexation | `seo-audit` |
| JSON-LD, schema.org structured data | `schema-markup` |
| Tạo pages at scale cho SEO | `programmatic-seo` |
| Content planning, topic clusters | `content-strategy` |
| Site structure, navigation, URLs | `site-architecture` |
| Debug bug, performance issue | `debugging-strategies` |
| Code review, PR feedback | `code-review-excellence` |
| Testing UI trong browser | `webapp-testing` |
| Web design, accessibility | `web-design-guidelines` |

### Commands — `.agents/commands/`

> **Gọi command file khi bắt đầu task tương ứng.** Mỗi file có format: Trigger → Preconditions → Steps → Verify → Output Template.

| Command | Khi nào dùng |
|---------|-------------|
| `/deploy.md` | Deploy lên Vercel production (phải có PM approval) |
| `/fix-issue.md` | Bug fix — Linear issue label Bug hoặc runtime error |
| `/review.md` | Code review trước khi Done, hoặc review code của người khác |
| `/new-entity.md` | Tạo Prisma model mới + full CRUD scaffold |
| `/handoff.md` | Bàn giao giữa Claude Code ↔ Antigravity, hoặc end-of-session |
| `/db-change.md` | Thay đổi DB schema: thêm column, index, constraint |

---

### Rules — `.agents/rules/`

> **Đọc rule file liên quan trước khi bắt đầu code.** Mỗi file ≤ 200 dòng, format: Purpose → Rules → Examples → Anti-patterns.

| Rule file | Khi nào đọc |
|-----------|------------|
| `code-style.md` | Mọi task viết TypeScript/React |
| `naming-conventions.md` | Tạo file, route, component, slug mới |
| `git-workflow.md` | Trước khi commit hoặc tạo branch |
| `database.md` | Thay đổi DB schema, Prisma models |
| `api-conventions.md` | Viết Server Actions hoặc Public API |
| `security.md` | Liên quan đến auth, env vars, secrets |
| `error-handling.md` | Viết form submit, server actions, error UI |
| `testing.md` | Trước khi commit — pre-commit checklist |

---

## 9. Handoff Protocol

### Claude Code → Antigravity (backend xong, cần frontend)

Comment template trên Linear issue:

```
✅ [Claude] Backend ready cho Antigravity

Server Actions: src/lib/{entity}-actions.ts
  - create{Entity}(data: FormData) → { success: true, id }
  - update{Entity}(id, data: FormData) → { success: true }
  - delete{Entity}(id) → { success: true }

Public API: src/lib/public-api-{entity}.ts
  - get{Entity}List(filters) → {Entity}[]
  - get{Entity}BySlug(slug) → {Entity} | null

Prisma types: import từ @prisma/client (tự động generate)

📌 Notes:
  - URL pattern: /{category}/[typeSlug]/[productSlug]
  - Filter params: ?collection=&color=&size=
  - [Ghi chú đặc biệt nào khác]
```

### Antigravity → Claude Code (cần backend support)

```
❓ [Antigravity] Cần backend support

Component cần data: src/components/xxx/XxxComponent.tsx
Cần thêm:
  - API function: get{Xxx}ByCondition(params)
  - Field mới trong bảng: {field} (type: string, nullable)
  - Server action: bulk{Xxx}Update()

Context: [mô tả tại sao cần]
```

### Sau khi hoàn thành task — update Linear

1. Comment kết quả (theo template trên nếu có handoff)
2. Update status → **Done**
3. Nếu phát sinh task mới → tạo Linear issue mới, **KHÔNG tự ý làm thêm**
4. Nếu có blocker → comment blocker, update status → **Blocked**, tag PM

---

## 10. Gotchas & Lessons Learned

| Vấn đề | Nguyên nhân | Fix |
|--------|------------|-----|
| `NEXT_REDIRECT` error trong server action | `redirect()` trong programmatic call | Return `{ success: true }`, dùng `router.push()` ở client |
| Prisma types cũ sau schema change | Turbopack cache | `npx prisma generate` + restart dev server |
| P2002 error khi tạo record mới sau seed | PostgreSQL SERIAL sequence out of sync | `SELECT setval('table_id_seq', (SELECT MAX(id) FROM table))` |
| `slugify("Đá Marble")` → `"-arble"` | `đ` không được handle trước `normalize()` | Xem `src/lib/utils.ts` — đã fix (đ→d trước normalize) |
| Vercel build fail — WASM Prisma validation | Missing back-relations trong schema | Thêm đủ back-relations vào models `colors`, `origins`, etc. |
| `params` là `undefined` hoặc lỗi async | Next.js 15+: params là Promise | `const { slug } = await params` |
| `SmartFilter` nhận `sizes` sai shape | `s.label` không phải `s.name` | Map `s.label → name` khi truyền vào SmartFilter |
| Build WASM error trên Vercel | `@prisma/adapter-*` không có trong deps | Chỉ dùng Prisma standard client, không dùng adapters |

---

## 11. Database

```bash
# Sync schema từ production DB (sau khi thay đổi SQL)
npx prisma db pull

# Regenerate Prisma Client (BẮT BUỘC sau db pull, sau đó restart dev server)
npx prisma generate

# Visual DB browser
npx prisma studio

# KHÔNG dùng prisma migrate — DB quản lý thủ công qua SQL
```

**Environment Variables:**
```
DATABASE_URL=    # Supabase pooler — phải có ?pgbouncer=true
DIRECT_URL=      # Supabase direct — dùng cho prisma db pull/push
AUTH_SECRET=     # Random secret (HMAC)
ADMIN_PASSWORD=  # Mật khẩu /admin
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## 12. Development Commands

```bash
# Dev server
npm run dev           # http://localhost:3000

# Verify code (không cần DB)
npx tsc --noEmit      # TypeScript check — PHẢI pass trước khi commit

# Full build (cần DB connection)
npm run build

# Lint
npm run lint

# Verify trước khi commit
npx tsc --noEmit && git status && git diff --staged

# Clean cache (khi Turbopack bị stale)
rm -rf .next && npm run dev
rm -rf .turbo
```

> **Claude Code Permissions:** Đã config trong `.claude/settings.json` (shared) — define allowed tools và blocked commands.
> Personal overrides: `.claude/settings.local.json` (gitignored, không commit).
> Xem LEO-312 để biết danh sách đầy đủ.

---

## 13. Team & Phân công

> Chi tiết xem `.agents/profiles/` — mỗi agent có profile riêng với scope, constraints, tools, và handoff protocol.

| Agent | Scope tóm tắt | Profile |
|-------|--------------|---------|
| **Claude Code** | Prisma, Server Actions, Public API, Admin CMS, Build fix, DB scripts | `.agents/profiles/claude-code.md` |
| **Antigravity (Tninie)** | React components, public pages, Tailwind styling, responsive UI | `.agents/profiles/antigravity.md` |
| **PM Assistant** | Linear management, sprint planning, docs, cross-agent coordination | `.agents/profiles/pm-assistant.md` |
| **PM (Huy)** | Strategy, final approval, deploy trigger, conflict resolution | — |

### Scope Boundary Quick Reference

| Nếu task liên quan đến... | Assign cho |
|--------------------------|------------|
| DB, Prisma, Server Actions, Admin CMS | **Claude Code** |
| Public pages, React UI, Tailwind, Figma | **Antigravity** |
| Linear, sprint planning, docs | **PM Assistant** |
| Deploy Vercel, merge PR, arch decisions | **PM (Huy) — human only** |
| **Không rõ scope** | → Hỏi PM trước khi làm |

**Không overlap scope mà không xác nhận với PM.**
