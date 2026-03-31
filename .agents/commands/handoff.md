# /handoff — Tạo Handoff Comment

## Trigger
- Claude Code xong backend → cần Antigravity làm frontend
- Antigravity cần backend support từ Claude Code
- Kết thúc session, có work-in-progress cần chuyển giao
- Update `.ai/shared/HANDOFF.md` trước khi end session

---

## Preconditions

```bash
□ Task hiện tại đã hoàn thành (hoặc xác định rõ phần đã làm / chưa làm)
□ npx tsc --noEmit → 0 errors (nếu handoff code)
□ Code đã commit (không handoff uncommitted work)
□ Biết rõ ai nhận handoff: Antigravity hay Claude Code
```

---

## Scope — HANDOFF.md vs Linear comments

> **Hai nơi này có vai trò khác nhau — không duplicate:**

| | `.ai/shared/HANDOFF.md` | Linear comment |
|---|---|---|
| **Dùng khi** | Session bị interrupt, có WIP chưa xong | Agent handoff hoặc cần báo cáo |
| **Nội dung** | Trạng thái WIP + context để tiếp tục | Template A/B/C (xem Output Template) |
| **Ai đọc** | Agent session sau (để resume) | Agent nhận handoff + PM |
| **Update khi nào** | Chỉ khi có WIP chưa hoàn thành | Mọi loại handoff |

**Rule quan trọng:** Nếu session kết thúc mà tất cả tasks đã Done → **KHÔNG cần update HANDOFF.md**.

---

## Steps

### Step 1 — Xác định loại handoff
```
A. Claude Code → Antigravity: Backend xong, cần frontend
B. Antigravity → Claude Code: Cần thêm backend support
C. End-of-session với WIP: Session bị interrupt, task chưa xong → cần session sau tiếp tục
   (Nếu session kết thúc không có WIP → dùng Template C nhẹ, KHÔNG update HANDOFF.md)
```

### Step 2 — Tạo handoff comment trên Linear

Xem template tương ứng ở mục **Output Template** bên dưới.

### Step 3 — Update HANDOFF.md (chỉ khi có WIP)

> ⚠️ **Bỏ qua step này nếu session kết thúc không có WIP.**
> HANDOFF.md = WIP state only. Không dùng làm session log.

```bash
# File: .ai/shared/HANDOFF.md
# Chỉ update khi có task đang dở dang cần session sau tiếp tục
```

Format entry trong HANDOFF.md:
```markdown
## [LEO-XXX] {Issue title}
**Date:** YYYY-MM-DD
**From:** Claude Code / Antigravity
**To:** Antigravity / Claude Code / PM
**Status:** In Progress / Blocked / Ready for pickup

### Đã làm:
- [x] Item 1
- [x] Item 2

### Chưa làm:
- [ ] Item 3 (blocker: ...)
- [ ] Item 4

### Context quan trọng:
- [Thông tin cần biết để tiếp tục]
- [Gotchas phát hiện]

### Files liên quan:
- src/lib/{entity}-actions.ts
- src/app/admin/(dashboard)/{entity}/page.tsx
```

### Step 4 — Commit HANDOFF.md update (nếu có thay đổi)
```bash
git add .ai/shared/HANDOFF.md
git commit -m "docs: update handoff notes for LEO-XXX"
```

---

## Output Template

### A. Claude Code → Antigravity (Backend ready)

```
✅ [Claude] Backend ready cho Antigravity — LEO-XXX

## Server Actions
File: src/lib/{entity}-actions.ts

create{Entity}(data: FormData): Promise<ActionResult>
  Input: name, slug, description?, imageUrl?, status
  Output: { success: true, id: number } | { success: false, error: string }

update{Entity}(id: number, data: FormData): Promise<ActionResult>
  Input: same as create
  Output: { success: true } | { success: false, error: string }

delete{Entity}(id: number): Promise<ActionResult>
  Output: { success: true } | { success: false, error: string }

## Public API
File: src/lib/public-api-{entities}.ts

get{Entity}List(filters?: FilterParams): Promise<{Entity}[]>
  Filters: { status?, collection?, color? }

get{Entity}BySlug(slug: string): Promise<{Entity} | null>

## Types
import type { {Entity} } from '@prisma/client'

// Với relations:
type {Entity}WithRelations = {Entity} & {
  collection: Collection
  color: Color | null
}

## URL Pattern
/{category}/{typeSlug}/{productSlug}
Query params: ?collection=&color=&size=&origin=

## Notes
- revalidatePath đã handle trong actions — public pages auto-update
- ISR: 3600s (1 giờ)
- Image URL pattern: https://tygjmrhandbffjllxveu.supabase.co/storage/v1/object/public/images/{path}
- [Gotcha cụ thể nếu có]
```

---

### Bước tiếp theo sau khi post Template A comment

Sau khi comment handoff lên Linear, Claude Code phải:

1. Re-assign Linear issue sang Antigravity:
   ```
   # Dùng Linear MCP tool: save_issue
   id: [LEO-XXX]
   assignee: "[ANTIGRAVITY_USER]"  # Placeholder — confirm với PM khi Antigravity join
   ```

2. Update TASK-QUEUE.md trong `.ai/shared/`:
   ```markdown
   | LEO-XXX | Claude Code | Antigravity | [mô tả ngắn] | Pending |
   ```

3. Report lên PM: "Backend LEO-XXX ready, đã re-assign sang Antigravity."

> ⚠️ `[ANTIGRAVITY_USER]` = placeholder cho đến khi Antigravity có Linear account.
> Khi có account: PM update placeholder này thành username/email thật.

---

### B. Antigravity → Claude Code (Cần backend support)

```
❓ [Antigravity] Cần backend support — LEO-XXX

## Component cần data
File: src/components/{feature}/{ComponentName}.tsx

## Cần thêm:
1. API function mới:
   get{Entity}By{Condition}(params: {...}): Promise<{Entity}[]>
   → Vị trí: src/lib/public-api-{entities}.ts

2. Field mới trong bảng {table}:
   {field_name}: {type} — nullable / default: {value}
   → Cần SQL migration + prisma db pull + generate

3. Server action mới:
   bulk{Entity}Update(ids: number[], data: Partial<{Entity}>)
   → Vị trí: src/lib/{entity}-actions.ts

## Context
[Mô tả tại sao cần — user story hoặc UI behavior]

## Priority
[Urgent / High / Normal] — ảnh hưởng đến [deadline / feature]
```

---

### C. End-of-session Handoff

```
📋 [Claude] End-of-session handoff — {date}

## Session này đã làm:
- ✅ [LEO-XXX]: [mô tả]
- ✅ [LEO-YYY]: [mô tả]
- 🔄 [LEO-ZZZ]: Đang làm — 60% — cần tiếp tục

## WIP cần tiếp tục:
Issue: LEO-ZZZ
Đã xong: [step 1-3]
Còn lại: [step 4-6]
Context: [thông tin quan trọng để không mất context]
Files đang sửa: [list]
Blockers: [nếu có]

## Phát hiện trong session:
- [Bug/issue mới] → đã tạo Linear issue [LEO-NNN] hoặc cần PM tạo
- [Gotcha mới] → đã thêm vào CLAUDE.md mục 10? Y/N

## Next session nên làm trước:
1. git pull origin main
2. npx tsc --noEmit để verify state
3. Tiếp tục LEO-ZZZ từ step 4
```

---

## Verify

```bash
□ Comment đã post lên Linear issue (không chỉ ghi trong chat)
□ HANDOFF.md đã update và commit
□ Linear status cập nhật đúng (In Progress / Blocked / Done)
□ PM được tag nếu cần approval
```
