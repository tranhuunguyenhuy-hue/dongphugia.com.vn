# Progress Log: Admin Subdomain Separation
> Session bắt đầu: 2026-04-29

---

## SESSION 2026-04-29

### Đã hoàn thành
- [x] Phân tích coupling giữa admin và main site (findings F-001)
- [x] Phân tích cache architecture (findings F-002)
- [x] Multi-agent brainstorming — 5 agents đã review, quyết định được ghi lại
- [x] Tạo `task_plan.md`, `findings.md`, `progress.md`

### Quyết định đã log
1. Tách admin sang `admin.dongphugia.com.vn` — CONFIRMED
2. Cache bridge qua `/api/revalidate` — CONFIRMED
3. Neutral color (không brand green) — CONFIRMED
4. Không dùng shadcn Sidebar primitive — CONFIRMED
5. TanStack DataTable — CONFIRMED
6. React Hook Form + Zod — CONFIRMED

### Kết quả Test / Build
- (Chưa có — chưa bắt đầu implementation)

---

## Bắt đầu session tiếp theo từ đâu?

```
→ PHASE 0, Task 0.1: Xây /api/revalidate endpoint trên main site
```

Đây là bước UNBLOCK cho toàn bộ project. Không làm bước này thì
không thể tách admin mà vẫn đảm bảo cache consistency.

---

## Lịch sử lỗi

| Ngày | Lỗi | Đã fix? |
|------|-----|--------|
| (Chưa có) | | |

---

## Checklist trước khi Cutover (Production)

- [ ] `/api/revalidate` endpoint hoạt động và đã test
- [ ] `admin.dongphugia.com.vn` staging smoke tests PASS
- [ ] Image upload Bunny CDN hoạt động từ admin subdomain
- [ ] Cookie auth hoạt động (domain `.dongphugia.com.vn`)
- [ ] Cache invalidation verified: edit product → main site cập nhật < 3s
- [ ] `ADMIN_MAINTENANCE = false` trên layout.tsx main site (nếu muốn giữ fallback)
- [ ] DNS propagated: `admin.dongphugia.com.vn` → Vercel
- [ ] Vercel custom domain verified
