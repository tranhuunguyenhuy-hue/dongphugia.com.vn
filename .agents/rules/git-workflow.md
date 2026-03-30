# Git Workflow Rules — Đông Phú Gia

## Purpose
Chuẩn hóa git workflow: branch naming, commit format, PR rules. Áp dụng cho Claude Code + Antigravity.

---

## Rules

### 1. Branch Naming
```
feat/LEO-{number}-{short-desc}     # Feature mới
fix/LEO-{number}-{short-desc}      # Bug fix
chore/LEO-{number}-{short-desc}    # Cleanup, config, deps
docs/LEO-{number}-{short-desc}     # Documentation only
```

**Ví dụ:**
```
feat/LEO-309-rules-layer
fix/LEO-279-crawler-hotlink
chore/LEO-307-cleanup-unused-files
```

**Rules:**
- Dùng kebab-case cho description
- Luôn có Linear issue number
- Không dùng Vietnamese characters trong branch name

### 2. Conventional Commits
Format: `{type}({scope}): {description} ({issue})`

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
git commit -m "docs: update CLAUDE.md session checklist (LEO-309)"
```

**Rules:**
- Description viết Tiếng Anh, ngắn gọn (< 72 chars)
- Luôn có issue reference cuối dòng
- Không viết hoa chữ đầu sau type
- Không dấu chấm cuối dòng

### 3. Không push trực tiếp lên `main`
- `main` là production branch — chỉ PM mới merge/push trực tiếp
- Tất cả changes phải qua branch riêng
- Sau khi xong → báo PM để review + merge

### 4. Commit nhỏ, atomic
- 1 commit = 1 logical change
- Không batch nhiều unrelated changes vào 1 commit
- `npx tsc --noEmit` PASS trước khi commit (xem testing.md)

### 5. Staged changes
```bash
# Thêm files cụ thể — KHÔNG dùng git add -A hoặc git add .
git add src/lib/product-actions.ts src/app/admin/products/page.tsx

# Verify trước khi commit
git diff --staged
npx tsc --noEmit

# Commit
git commit -m "feat: add product server actions (LEO-XXX)"
```

### 6. Commit message với heredoc (khi message dài)
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
# Branch
git checkout -b feat/LEO-309-rules-layer

# Atomic commits
git add .agents/rules/code-style.md
git commit -m "feat: add code-style rules (LEO-309)"

git add .agents/rules/database.md
git commit -m "feat: add database rules (LEO-309)"
```

### ❌ Sai
```bash
# Commit lên main trực tiếp
git checkout main && git commit -m "changes"

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
