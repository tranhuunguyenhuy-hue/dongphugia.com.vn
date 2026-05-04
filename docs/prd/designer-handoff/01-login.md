# 01 — Trang Đăng nhập `/login`

---

## DB Contract
- Không có bảng `users` — dùng env var `ADMIN_PASSWORD`
- Auth: HMAC-SHA256 cookie, session 8 giờ
- Cookie name: `dpg-admin-session`

## API Contract
```typescript
// src/app/admin/login/actions.ts
loginAction(formData: FormData): Promise<{ success: boolean; message?: string }>
// Input: password (string)
// Output: Set cookie → redirect /admin
```

---

## Wireframe — Desktop

```
┌────────────────────────────────────────────────┐
│                                                │
│                                                │
│          ┌──────────────────────┐              │
│          │                      │              │
│          │    🏢 Đông Phú Gia   │              │
│          │    Hệ thống quản trị │              │
│          │                      │              │
│          │  ┌────────────────┐  │              │
│          │  │ Mật khẩu       │  │              │
│          │  │ ••••••••••     │  │              │
│          │  └────────────────┘  │              │
│          │                      │              │
│          │  [   Đăng nhập    ]  │  ← Button    │
│          │                      │  full-width  │
│          │   ⚠️ Error message   │  ← Nếu sai  │
│          │                      │              │
│          └──────────────────────┘              │
│                Card: 400px max                 │
│                Centered vertically             │
│                                                │
└────────────────────────────────────────────────┘
Background: zinc-50 (light) / zinc-950 (dark)
Card: border, shadow-sm, rounded-lg
```

## UI → Data Mapping

| Element | Field | Component | Validation |
|---------|-------|-----------|------------|
| Logo | Static | `Image` | — |
| Subtitle | Static text | `<p>` | — |
| Password input | `password` | `Input` type=password | min 1 char |
| Submit button | — | `Button` | Loading spinner |
| Error alert | server error | `Alert` destructive | — |

## States

| State | Hiển thị |
|-------|---------|
| Default | Form trống, button enabled |
| Loading | Button disabled + spinner, input disabled |
| Error | `Alert` variant destructive phía dưới button |
| Success | Redirect → `/admin` (không hiển thị gì) |
| Session expired | Redirect từ dashboard → login + toast "Phiên đăng nhập hết hạn" |

## Mobile (≥768px)
- Giữ nguyên layout centered
- Card width: 100% - 32px padding
