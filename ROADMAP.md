# ROADMAP — Đông Phú Gia

> **Cập nhật:** 14/06/2026 — Tech Lead (Claude Cowork)
> **Nguồn chân lý:** [Linear Initiative "Đông Phú Gia — Website VLXD"](https://linear.app/leonguyen/initiative/djong-phu-gia-website-vlxd-1c5cd0379e7a)
> File này là bản chiếu (mirror) của Linear để đọc nhanh trong repo. Khi lệch, **Linear là chuẩn**.

---

## Chiến lược hiện tại

Single-repo, incremental. `main` là canonical branch và production deploy từ `main`. Không còn chiến lược 2-track staging trước đây — chúng ta nâng cấp trực tiếp trên `main` theo từng project ưu tiên, mỗi feature đi qua Vercel Preview → production.

```
main (canonical) ──push──▶ Vercel Preview ──approve──▶ Production (dongphugia.com.vn)
```

---

## Cấu trúc quản lý: Initiative → Project → Milestone → Issue

| Tầng | Vai trò |
|------|---------|
| **Initiative** | Đông Phú Gia — Website VLXD (umbrella, target 31/10/2026) |
| **Project (P0–P5)** | Khối việc theo chủ đề, có priority + timeline |
| **Milestone** | Checkpoint có target date bên trong project |
| **Issue** | Task đơn lẻ giao Antigravity (LEO-xxx) |

---

## Roadmap P0–P5

### P0 — Stabilization & Production Safety · `Urgent` · 04/06 → 31/07
Giữ production ổn định sau khi hợp nhất về `main`. **Bug P0 đã xử lý xong** (search crash, 404, Google Maps, cart images, title duplication — LEO-436→440). Không còn issue mở.

### P1 — Frontend Core Experience · `High` · 04/06 → 31/08
Nâng trải nghiệm 4 trang chuyển đổi mạnh nhất.

| Milestone | Target | Issues |
|-----------|--------|--------|
| M1 · Trang lõi (Home · Category · PDP) | **31/07** | LEO-441, LEO-442, LEO-443 |
| M2 · Conversion & Design System | **31/08** | LEO-444, LEO-445, LEO-433 |

### P2 — SEO, Content & Discovery · `High` · 04/06 → 30/09
Tăng organic traffic — structured data, sitemap, internal linking.

| Milestone | Target | Issues |
|-----------|--------|--------|
| M1 · Technical SEO | **30/09** | LEO-429, LEO-430 |

### P3 — Admin CMS & Operations · `Medium` · 01/07 → 30/09
Để team vận hành tự xử lý không cần kỹ thuật.

| Milestone | Target | Issues |
|-----------|--------|--------|
| M1 · Admin Operations | **30/09** | LEO-434, LEO-432 |

### P4 — Commercial Features · `Medium` · 01/08 → 31/10
Catalog đủ hàng + thanh toán + chốt đơn. (Bao gồm cả Data/Catalog expansion.)

| Milestone | Target | Issues |
|-----------|--------|--------|
| M1 · Mở rộng Catalog | **30/09** | LEO-426, LEO-427 |
| M2 · Thanh toán & Chốt đơn | **31/10** | LEO-431 |

### P5 — Technical Debt & Performance · `Low` · 04/06 → 31/10
Giảm nợ kỹ thuật, đạt Lighthouse mobile ≥90.

| Milestone | Target | Issues |
|-----------|--------|--------|
| M1 · Hiệu năng ≥90 | **31/10** | LEO-428 |

---

## Timeline tổng (2026)

```
        Jun     Jul     Aug     Sep     Oct
P0      ███████████                              (done)
P1      ████████████████████████
          └M1 31/07      └M2 31/08
P2      ████████████████████████████████████
                                  └M1 30/09
P3            ██████████████████████████
                                  └M1 30/09
P4                  ████████████████████████████
                                  └M1 30/09 └M2 31/10
P5      ██████████████████████████████████████████
                                          └M1 31/10
```

---

## Lịch sử

**Sprint 1 — Foundation (đã hoàn thành)** — archived trong Linear (project `📦 Sprint 1`). Gồm: security hardening (upload auth, rate limiting), unify order number format, image optimization investigation, variant system upgrade (TOTO→multi-brand), và toàn bộ bug P0 production. 12 issue done.

---

> **Tech Lead:** Khi đổi scope/timeline, sửa trong Linear trước rồi mirror lại file này.
> **PM:** Review tiến độ ở Initiative Roadmap view cuối mỗi tuần.
