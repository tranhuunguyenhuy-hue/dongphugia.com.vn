# PLAN: Hệ thống Blog — Đông Phú Gia

> **Ngày tạo:** 02/03/2026
> **Trạng thái:** Chờ triển khai (sau QA 5 danh mục sản phẩm)
> **Phân công:** Claude Code (Backend) → Antigravity (Frontend)

---

## Quyết định kỹ thuật (đã chốt)

| Hạng mục | Lựa chọn | Lý do |
|----------|----------|-------|
| **Content Editor** | TipTap | Dễ tích hợp Next.js, output HTML, không cần compile-time |
| **Content Storage** | `TEXT` (HTML) | Store HTML từ TipTap, render bằng `prose` class |
| **Scheduled Publishing** | Query `published_at <= NOW()` | Không cần cron, bài tự hiện khi đến giờ |
| **Related Posts** | Admin chọn thủ công | Đơn giản, kiểm soát tốt hơn auto-suggest |
| **View Count** | Server Action increment | Gọi khi page load, không cần real-time |
| **TOC** | Parse H2/H3 trên frontend | Regex đơn giản, không cần package thêm |
| **Comments** | Bỏ qua (MVP) | Phức tạp, ưu tiên thấp |
| **`blog_post_products`** | Phase 2, custom query | Không thể dùng Prisma include trực tiếp |

---

## Schema Database (7 bảng)

> Claude Code tạo SQL và chạy migration. Antigravity chờ API sẵn sàng.

```sql
-- Phase 1: Core tables
blog_categories     -- 6 chuyên mục cố định
blog_posts          -- Bài viết (có TipTap HTML content)
blog_tags           -- Tags
blog_post_tags      -- N-N: posts ↔ tags

-- Phase 2: Enhanced tables
blog_series         -- Chuỗi bài viết
blog_post_products  -- Polymorphic: liên kết đến sản phẩm (gach/tbvs/bep/nuoc/sango)
blog_related_posts  -- Admin chọn bài viết liên quan
```

Chi tiết SQL đầy đủ: xem `THIẾT KẾ BLOG - ĐÔNG PHÚ GIA` (Antigravity ownership doc).

---

## URL Structure

```
/blog/                                      → Trang chủ blog
/blog/[categorySlug]/                       → Danh sách theo chuyên mục
/blog/[categorySlug]/[postSlug]/            → Chi tiết bài viết
/blog/series/[seriesSlug]/                  → Chi tiết series (Phase 2)
/blog/tag/[tagSlug]/                        → Bài viết theo tag (Phase 2)
```

---

## PHASE 1 — Core MVP

### Backend (Claude Code)

- [x] **1.1** Tạo SQL schema: `blog_categories`, `blog_posts`, `blog_tags`, `blog_post_tags`
- [x] **1.2** Tạo SQL indexes (8 indexes)
- [x] **1.3** Seed data: 6 `blog_categories` (tin-tuc, kien-thuc, huong-dan-chon, du-an, xu-huong, thi-cong)
- [x] **1.4** `npx prisma db pull && npx prisma generate`
- [x] **1.5** Tạo `src/lib/public-api-blog.ts` — 6 hàm cache()
- [x] **1.6** Tạo `src/lib/blog-actions.ts` — createBlogPost, updateBlogPost, deleteBlogPost, createBlogTag, deleteBlogTag, incrementViewCount
- [x] **1.7** Admin CMS: `src/app/admin/(dashboard)/blog/posts/` — list + new + [id] + form + delete button
- [x] **1.8** Admin CMS: `src/app/admin/(dashboard)/blog/tags/` — inline create/delete
- [x] **1.9** Thêm "Blog" vào `sidebar-nav.tsx` (icon: `BookOpen`)
- [x] **1.10** Install TipTap + date-fns
- [x] **1.11** Tạo `src/components/ui/rich-text-editor.tsx` (TipTap wrapper, toolbar đầy đủ)
- [x] **1.12** Cập nhật `src/app/sitemap.ts` — thêm blog posts
- [x] **1.13** Build PASS — routes `/admin/blog/posts`, `/admin/blog/posts/[id]`, `/admin/blog/posts/new`, `/admin/blog/tags`

### Frontend (Antigravity) — chờ Backend xong 1.1–1.6

- [ ] **1.A** Tạo `src/app/(public)/blog/page.tsx`:
  - Hero: Featured post lớn
  - Grid: Latest posts (6–9 bài)
  - Sidebar: Categories + Popular Tags
- [ ] **1.B** Tạo `src/app/(public)/blog/[categorySlug]/page.tsx`:
  - Breadcrumb: Blog > [Tên chuyên mục]
  - Header chuyên mục (tên + mô tả)
  - Grid 3 cột bài viết
  - Pagination
- [ ] **1.C** Tạo `src/app/(public)/blog/[categorySlug]/[postSlug]/page.tsx`:
  - Cover image + metadata (ngày, tác giả, thời gian đọc)
  - Content render: `<div dangerouslySetInnerHTML={{ __html: post.content }} className="prose prose-lg max-w-none" />`
  - TOC sidebar: parse H2/H3 từ content HTML
  - Social share: Facebook, Zalo, Copy link
  - Related posts (3 bài)
  - Call view count increment khi mount
- [ ] **1.D** Tạo `src/components/blog/post-card.tsx` — Card bài viết tái sử dụng
- [ ] **1.E** Tạo `src/components/blog/toc.tsx` — Table of Contents (parse heading từ HTML)
- [ ] **1.F** Thêm link "Blog" vào `header.tsx`
- [ ] **1.G** Install `@tailwindcss/typography`: `npm install @tailwindcss/typography` + thêm vào `globals.css`

---

## PHASE 2 — Enhanced (sau khi Phase 1 live)

### Backend (Claude Code)

- [ ] **2.1** Schema: `blog_series`, `blog_post_products`, `blog_related_posts`
- [ ] **2.2** Server Actions: `createSeries`, `updateSeries`, `deleteSeries`, `updateRelatedPosts`
- [ ] **2.3** `public-api-blog.ts` thêm: `getSeriesBySlug()`, `getPostsByTag(tagSlug)`, `getBlogSeries()`
- [ ] **2.4** Admin CMS: `src/app/admin/(dashboard)/blog/series/`
- [ ] **2.5** Admin: Thêm section "Sản phẩm liên quan" vào `blog-post-form.tsx` — custom fetch theo `product_type`
- [ ] **2.6** Admin: Thêm section "Bài viết liên quan" vào `blog-post-form.tsx` — search + select

### Frontend (Antigravity)

- [ ] **2.A** Trang `/blog/series/[seriesSlug]/` — danh sách bài trong series + progress bar
- [ ] **2.B** Trang `/blog/tag/[tagSlug]/`
- [ ] **2.C** Component: Product cards trong bài viết (render từ `blog_post_products`)
- [ ] **2.D** Series navigation trong bài viết (Phần 1/5, Phần 2/5...)

---

## PHASE 3 — Advanced (optional, sau launch)

- [ ] **3.1** Scheduled publishing UI — date/time picker trong form
- [ ] **3.2** Draft auto-save
- [ ] **3.3** SEO preview (Google snippet preview)
- [ ] **3.4** Analytics dashboard (most viewed, by category)
- [ ] **3.5** Newsletter integration (optional)

---

## Lưu ý kỹ thuật cho Antigravity

### Render nội dung TipTap
```tsx
// Cần install: npm install @tailwindcss/typography
// Thêm vào globals.css: @plugin "@tailwindcss/typography";

<article
  className="prose prose-lg max-w-none
             prose-headings:font-bold prose-headings:text-foreground
             prose-a:text-primary prose-a:no-underline hover:prose-a:underline
             prose-img:rounded-xl prose-img:shadow-md"
  dangerouslySetInnerHTML={{ __html: post.content }}
/>
```

### Parse TOC từ HTML
```typescript
// src/components/blog/toc.tsx
function extractHeadings(html: string) {
  const matches = html.matchAll(/<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi)
  return Array.from(matches).map(([, level, id, text]) => ({
    level: parseInt(level),
    id,
    text: text.replace(/<[^>]+>/g, ''), // strip inner tags
  }))
}
```

### Increment view count
```typescript
// Gọi trong useEffect của post detail page
useEffect(() => {
  fetch(`/api/blog/view/${post.id}`, { method: 'POST' })
}, [post.id])
// Hoặc dùng Server Action trong layout wrapper
```

### generateMetadata cho SEO
```typescript
export async function generateMetadata({ params }) {
  const post = await getBlogPostBySlug(params.postSlug)
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt,
    openGraph: { images: [post.cover_image_url] },
  }
}
```

---

## Phân công tức thì

| Agent | Task tiếp theo |
|-------|----------------|
| **Claude Code** | Phase 1.1 → 1.13 (Backend + TipTap install + Admin CMS) |
| **Antigravity** | Chờ Claude xong 1.1–1.6, sau đó làm 1.A → 1.G (Frontend) song song với 1.7–1.13 |
