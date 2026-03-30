# Git Workflow Rules — Đông Phú Gia

## Purpose
Chuẩn hóa git workflow: commit format, branching strategy. Áp dụng cho Claude Code + Antigravity.

---

## Workflow

**Dự án Đông Phú Gia dùng trunk-based development:**
- Commit thẳng lên `main` — không cần feature branch
- PM là sole reviewer — không cần PR
- Vercel CI tự deploy từ GitHub main (safety net)

---

## Quy tắc commit

- `npx tsc --noEmit` phải PASS trước khi commit
- Commit message format: `type: mô tả ngắn (LEO-XXX)`
- Types: `feat` | `fix` | `docs` | `chore` | `refactor`
- KHÔNG push lên remote khi build broken

---

## Conventional Commits
Format: `{type}: {description} ({issue})`

| Type | Khi nào dùng |
|------|-------------|
| `feat` | Tính năng mới |
| `fix` | Bug fix |
| `chore` | Cleanup, config, deps không ảnh hưởng behavior |
| `docs` | Chỉ thay đổi documentation |
| `refactor` | Refactor không thay đổi behavior |
| `style` | Formatting, CSS (không thay đổi logic) |
| `perf` | Performance improvement |

**Ví dụ:**
```bash
git commit -m "feat: add quote request admin CMS (LEO-288)"
git commit -m "fix: resolve redirect() error in server actions (LEO-295)"
git commit -m "chore: remove unused dien_* models (LEO-291)"
git commit -m "docs: update CLAUDE.md session checklist (LEO-318)"
```

**Rules:**
- Description viết Tiếng Anh, ngắn gọn (< 72 chars)
- Luôn có issue reference cuối dòng
- Không viết hoa chữ đầu sau type
- Không dấu chấm cuối dòng

---

## Staged changes
```bash
# Thêm files cụ thể — KHÔNG dùng git add -A hoặc git add .
git add src/lib/product-actions.ts src/app/admin/products/page.tsx

# Verify trước khi commit
git diff --staged
npx tsc --noEmit

# Commit
git commit -m "feat: add product server actions (LEO-XXX)"
```

## Commit message với heredoc (khi message dài)
```bash
git commit -m "$(cat <<'EOF'
feat: add rules layer for code standards (LEO-309)

- 8 rule files in .agents/rules/
- Updated CLAUDE.md session checklist
- Updated CLAUDE.md skills mapping
EOF
)"
```

---

## Examples

### ✅ Đúng
```bash
# Commit thẳng lên main (trunk-based)
git add .agents/rules/code-style.md
git commit -m "feat: add code-style rules (LEO-309)"

# Atomic commits
git add .agents/rules/database.md
git commit -m "feat: add database rules (LEO-309)"
```

### ❌ Sai
```bash
# Commit không có issue reference
git commit -m "fix some stuff"

# git add tất cả (có thể include .env hoặc files không mong muốn)
git add -A && git commit -m "feat: new stuff"

# Commit khi TypeScript chưa pass
npx tsc --noEmit  # có errors → vẫn commit
```

---

## Anti-patterns

- ❌ Force push lên `main` (`git push --force origin main`)
- ❌ Commit `.env` hoặc files chứa secrets
- ❌ Commit với message vague: "fix", "update", "changes", "wip"
- ❌ Bỏ qua git hooks (`--no-verify`)
- ❌ Commit code có TypeScript errors chưa được fix
- ❌ Amend commit đã push (gây diverge với remote)
