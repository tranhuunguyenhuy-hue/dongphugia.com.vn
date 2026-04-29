# PLAN: Codebase Cleanup — Bàn Giao Khách Hàng
> **Dự án:** Đông Phú Gia V2  
> **Deadline bàn giao:** 31/05/2026  
> **Ngày lập kế hoạch:** 29/04/2026  
> **Mục tiêu:** Codebase sạch 100% — không có rác, debug script, hay file tạm

---

## 🔴 TÓM TẮT VẤN ĐỀ PHÁT HIỆN

Sau khi scan toàn bộ project, phát hiện **5 nhóm vấn đề chính**:

| Nhóm | Số lượng vấn đề | Mức độ ưu tiên |
|------|----------------|---------------|
| A. File debug/test nằm ở root | ~13 files | 🔴 Xóa ngay |
| B. Thư mục AI tools chưa gitignore | ~20 folders | 🟡 Thêm vào .gitignore |
| C. Routes/API đã bị cancel khỏi scope | 2 routes | 🟠 Xóa |
| D. Script, CSV, data dump trong `/scripts` | ~10 files | 🟠 Dọn dẹp |
| E. Docs Antigravity nội bộ trong `/docs` | ~21 files | 🟡 Xóa |

---

## 📋 PHASE 1 — Snapshot & Kiểm Tra

```bash
git add -A && git commit -m "chore: snapshot before cleanup"
npm run build
npx tsc --noEmit 2>&1 | tail -20
```

---

## 🗑️ PHASE 2 — Dọn Root Directory

### 2A. XÓA: Debug/Test scripts ở root

| File | Lý do xóa |
|------|-----------|
| `check_product.ts` | Debug script tạm |
| `check_quotes.ts` | Debug script tạm |
| `debug_slugs.ts` | Debug script tạm |
| `get_slugs.ts` | Debug script tạm |
| `get_slugs2.ts` | Debug script tạm |
| `get_slugs3.ts` | Debug script tạm |
| `test-products.mts` | Test script tạm |
| `test_action.ts` | Test script tạm |
| `progress.md` | Ghi chú nội bộ |
| `task_plan.md` | Kế hoạch nội bộ |
| `findings.md` | Ghi chú nội bộ |
| `0` | File rỗng vô nghĩa |
| `.DS_Store` | macOS metadata |
| `.figma-mcp.md` | Config Figma MCP nội bộ (19KB) |

### 2B. .gitignore: Thêm AI Tool Folders

Các thư mục sau CHƯA có trong `.gitignore`:
`.adal/`, `.agents/`, `.augment/`, `.bob/`, `.commandcode/`, `.continue/`, `.cortex/`, `.crush/`, `.factory/`, `.goose/`, `.iflow/`, `.junie/`, `.kilocode/`, `.kiro/`, `.kode/`, `.mcpjam/`, `.mux/`, `.neovate/`, `.openhands/`, `.pi/`, `.pochi/`, `.qoder/`, `.qwen/`, `.roo/`, `.trae/`, `.vibe/`, `.windsurf/`, `.zencoder/`

Đồng thời thêm: `CLAUDE.md`, `GEMINI.md`

### 2C. Root Docs — Di chuyển vào /docs/internal/

`DB-AUDIT-REPORT.md`, `ERRORS.md`, `UI-UX-Audit-Report-DongPhuGia.docx`

---

## 🔧 PHASE 3 — Dọn Routes & API Cancelled

| Route | Lý do |
|-------|-------|
| `src/app/api/search/` | Search cancelled (LEO-346, 347) |
| `src/app/api/dev-check/` | Debug route, không dùng production |

---

## 📁 PHASE 4 — Dọn /scripts Directory

### XÓA: CSV export files

`bon-cau-variant-export*.csv`, `lavabo-unclassified-review.csv`, `nap-bon-cau-classification.csv`, `nap-bon-cau-variant-export*.csv`, `sen-tam-classified.csv`, `sen-tam-variant-export*.csv`

### REVIEW & XÓA: Scripts cũ

`sen-tam-classify.ts`, `test-data-flow.mjs`, `fix-blog-images.mts` (nếu blog đã OK)

---

## 📝 PHASE 5 — Dọn /docs Directory

### XÓA: 21 files Antigravity internal

`AGENTS_GUIDE.vi.md`, `AGENT_FLOW.md`, `CONTRIBUTING.md/vi`, `COPYRIGHT.md`, `FAQ.vi.md`, `GEMINI_GUIDE.md`, `GLOSSARY.md/vi`, `HOW_ANTIGRAVITY_THINKS.vi.md`, `INSTALL_NPX_GUIDE.md/vi`, `MASTER_GUIDE.md`, `MASTER_OPERATIONS.md/vi`, `OPERATIONAL_FLOW.md/vi`, `PUBLISHING.md`, `RULES_GUIDE.vi.md`, `SHARED_LIBRARY_GUIDE.vi.md`, `SKILLS.md` (169KB!), `SKILLS_GUIDE.vi.md`, `TROUBLESHOOTING.md/vi`, `UNINSTALL_GUIDE.vi.md`, `UPDATE_GUIDE.vi.md`, `WORKFLOW_GUIDE.vi.md`, `findings.md`, `progress.md`, `task_plan.md`, `PLAN-upgrade-core-architecture.md`

### GIỮ LẠI

`dpg-v2-readme.md`, `dpg-v2-colors.css`, `dpg-v2-components/`, `prd/`, `DEPLOYMENT.md`

---

## 🔍 PHASE 6 — Code Quality Audit

```bash
npx tsc --noEmit
npx next lint
npm run build
grep -rn "console\.log" src/ --include="*.ts" --include="*.tsx"
grep -rn "TODO\|FIXME\|HACK" src/ --include="*.ts" --include="*.tsx"
```

---

## 📋 PHASE 7 — Viết README.md mới cho Client

---

## ✅ CHECKLIST CUỐI

- [ ] Xóa 14 debug files ở root
- [ ] .gitignore cập nhật đầy đủ
- [ ] git rm --cached các thư mục AI tools
- [ ] Xóa /api/search và /api/dev-check
- [ ] Xóa 7 CSV files trong /scripts
- [ ] Xóa 25+ Antigravity docs trong /docs
- [ ] npm run build → PASS
- [ ] npx tsc --noEmit → PASS
- [ ] npx next lint → PASS
- [ ] README.md viết lại cho client
- [ ] git commit "chore: codebase cleanup for client handover"
