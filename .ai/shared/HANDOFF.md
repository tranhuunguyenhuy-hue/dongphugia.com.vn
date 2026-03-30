# Handoff Notes — Claude Code ↔ Antigravity

> Ghi chú handoff đang active giữa agents.
> **Xóa entry sau khi handoff hoàn thành.**
> Cập nhật: 30/03/2026

---

## Active Handoffs

> Hiện tại không có handoff đang pending.

<!-- Template Claude → Antigravity:
### [LEO-XXX] {Tên feature}
**Status:** Waiting for Antigravity
**Date:** DD/MM/YYYY

**Backend done:**
- Server Actions: `src/lib/{entity}-actions.ts`
  - `createXxx(data)` → `{ success: true, id }`
  - `updateXxx(id, data)` → `{ success: true }`
  - `deleteXxx(id)` → `{ success: true }`
- Public API: `src/lib/public-api-{entity}.ts`
  - `getXxxList(filters)` → `Xxx[]`
  - `getXxxBySlug(slug)` → `Xxx | null`
- Prisma types: `import { Xxx } from '@prisma/client'`

**Notes cho Antigravity:**
- URL pattern: /[category]/[typeSlug]/[productSlug]
- Filter params: ?collection=&color=&size=
- [Ghi chú đặc biệt]
-->

<!-- Template Antigravity → Claude:
### [LEO-XXX] {Tên feature}
**Status:** Waiting for Claude
**Date:** DD/MM/YYYY

**Cần backend support:**
- Component: `src/components/xxx/XxxComponent.tsx`
- Cần API: `getXxxByCondition(params: { field: string })`
- Cần field mới: `{table}.{field}` (type: string, nullable)
- Cần action: `bulkUpdateXxx(ids[])`

**Context:**
- [Tại sao cần]
-->

---

## Archived Handoffs

| Date | Issue | Direction | Summary |
|------|-------|-----------|---------|
| 01/03 | Phase 1 | Claude→Antigravity | 5 category backends (gach, tbvs, bep, nuoc, sango) |
| 01/03 | Phase 1 | Claude→Antigravity | Blog backend (posts, categories, tags) |
| 15/03 | Phase 2 | Claude→Antigravity | Partners + Projects backend |
