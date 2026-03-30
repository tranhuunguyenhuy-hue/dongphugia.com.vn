# /deploy — Vercel Deploy Workflow

## Trigger
- PM yêu cầu deploy lên production
- Sau khi merge PR vào `main`
- ⚠️ KHÔNG tự ý chạy command này — phải có PM approval trước

---

## Preconditions

Tất cả phải pass trước khi tiếp tục:

```bash
□ npx tsc --noEmit          → 0 errors
□ npm run lint               → no errors
□ git status                 → working tree clean
□ git log origin/main..HEAD  → không có commit chưa push
□ PM đã xác nhận bằng văn bản (Linear comment / tin nhắn)
```

Nếu bất kỳ điều kiện nào fail → **DỪNG**, báo PM.

---

## Steps

### Step 1 — Verify local build
```bash
npx tsc --noEmit
# Expected: "Found 0 errors."

npm run lint
# Expected: no errors/warnings liên quan đến code đang deploy
```

### Step 2 — Verify git state
```bash
git status
# Expected: "nothing to commit, working tree clean"

git log --oneline origin/main..HEAD
# Expected: empty (hoặc chỉ commits đã được PM approve)
```

### Step 3 — Confirm env vars với PM
Hỏi PM xác nhận các env vars đã được set trên Vercel Dashboard:
```
□ DATABASE_URL       (Supabase pooler — ?pgbouncer=true)
□ DIRECT_URL         (Supabase direct)
□ AUTH_SECRET        (HMAC secret)
□ ADMIN_PASSWORD     (admin login)
□ NEXT_PUBLIC_SITE_URL
□ NEXT_PUBLIC_SUPABASE_URL
□ NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Step 4 — Push to main (nếu chưa)
```bash
git push origin main
```

### Step 5 — Deploy
```bash
npx vercel --prod
```

Nếu Vercel CI tự động từ GitHub push → bỏ qua step này, kiểm tra Vercel Dashboard.

### Step 6 — Verify production
```bash
# Sau khi deploy xong:
□ Mở https://dongphugia.com.vn → homepage load đúng
□ Mở /admin/login → form đăng nhập hiển thị
□ Test login với ADMIN_PASSWORD
□ Check 1-2 public pages: /gach-op-lat, /san-go
□ Check sitemap: /sitemap.xml trả về XML đúng
```

---

## Verify

```bash
# Deployment thành công khi:
✅ Vercel dashboard: "Deployment" status = "Ready"
✅ Production URL load không có 500 error
✅ /admin/login hoạt động
✅ Không có console errors nghiêm trọng trong browser
```

---

## Output Template

Sau khi deploy xong, comment lên Linear issue:

```
✅ [Claude] Deploy thành công

URL: https://dongphugia.com.vn
Vercel deployment: [deployment URL từ vercel CLI output]
Thời gian: [HH:MM DD/MM/YYYY]

Đã verify:
□ Homepage: ✅
□ /admin/login: ✅
□ /gach-op-lat: ✅
□ sitemap.xml: ✅

Không có lỗi phát hiện.
```

Nếu có lỗi:
```
❌ [Claude] Deploy failed

Lỗi: [mô tả lỗi]
Log: [paste relevant error lines]

Cần xử lý: [hành động tiếp theo]
```

---

## Rollback (nếu cần)
Báo PM ngay — Vercel hỗ trợ instant rollback từ Dashboard → Deployments → [previous deployment] → Promote to Production.
