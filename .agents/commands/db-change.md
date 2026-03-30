# /db-change — Schema Migration Procedure

## Trigger
- Thêm column mới vào bảng hiện có
- Thêm bảng mới (xem /new-entity nếu cần full CRUD)
- Thêm/xóa index
- Thay đổi constraint (NOT NULL, UNIQUE, FK)
- Workflow 7.6 trong CLAUDE.md

---

## Preconditions

```bash
□ Đã đọc database.md trong .agents/rules/
□ Đã xác nhận scope thay đổi với PM (đặc biệt nếu xóa/rename)
□ Biết rõ: thêm / sửa / xóa column/table/index/constraint?
□ Đã check code nào đang dùng bảng/column sắp thay đổi
```

⚠️ **DỪNG & HỎI PM trước khi:**
- Xóa column hoặc bảng (mất production data)
- Rename column (breaking change với code hiện tại)
- Thay đổi kiểu dữ liệu column có data

---

## Steps

### Step 1 — Viết SQL Migration
```bash
# Tạo file SQL trong scripts/db/
# Naming: migration-{YYYY-MM-DD}-{description}.sql
# Ví dụ: scripts/db/migration-2026-03-30-add-product-weight.sql
```

**Templates theo loại thay đổi:**

```sql
-- A. Thêm column (nullable → an toàn, không break existing data)
ALTER TABLE {table} ADD COLUMN {column} {type};
COMMENT ON COLUMN {table}.{column} IS '{mô tả}';

-- A'. Thêm column NOT NULL → cần DEFAULT để không break existing rows
ALTER TABLE {table} ADD COLUMN {column} {type} NOT NULL DEFAULT '{default}';

-- B. Thêm index
CREATE INDEX idx_{table}_{column} ON {table}({column});
-- Composite:
CREATE INDEX idx_{table}_{col1}_{col2} ON {table}({col1}, {col2});

-- C. Thêm unique constraint
ALTER TABLE {table} ADD CONSTRAINT {table}_{column}_unique UNIQUE ({column});

-- D. Thêm foreign key
ALTER TABLE {table} ADD COLUMN {fk_column} INTEGER REFERENCES {ref_table}(id);
CREATE INDEX idx_{table}_{fk_column} ON {table}({fk_column});

-- E. Xóa index (ít rủi ro)
DROP INDEX IF EXISTS idx_{table}_{column};

-- F. XÓA COLUMN — ⚠️ PHẢI CÓ PM APPROVAL
-- Backup data trước khi xóa:
-- SELECT * INTO OUTFILE hoặc export từ Supabase Dashboard
ALTER TABLE {table} DROP COLUMN {column};

-- G. Reset sequence sau khi seed
SELECT setval('{table}_id_seq', (SELECT MAX(id) FROM {table}));
```

### Step 2 — Test SQL trong Supabase Dashboard
```bash
# 1. Mở Supabase Dashboard → SQL Editor
# 2. Paste SQL → Run
# 3. Verify trong Table Editor:
#    - Column mới xuất hiện đúng type
#    - Existing data không bị ảnh hưởng
#    - Không có error

# Safety check — xem affected rows trước khi UPDATE:
SELECT COUNT(*) FROM {table} WHERE {condition};
```

### Step 3 — Sync Prisma
```bash
npx prisma db pull
# Verify schema.prisma đã update:
# - Column mới có trong model
# - Type mapping đúng (Int, String, DateTime, etc.)

npx prisma generate
# Restart dev server (clear Turbopack cache)
```

Kiểm tra `prisma/schema.prisma` sau pull:
```
□ Field mới xuất hiện với @map("snake_case")
□ Type đúng (Int?, String, DateTime, etc.)
□ Relations vẫn còn nguyên
□ Back-relations không bị mất
```

### Step 4 — Update Code
```bash
# Tìm tất cả code cần update:
grep -r "{oldColumnName}" src/
grep -r "{modelName}" src/lib/ src/app/admin/

# Cần update:
□ Zod schemas trong src/lib/{entity}-actions.ts
   → Thêm field mới với validation
□ Form components nếu field cần hiển thị trong admin
   → src/app/admin/(dashboard)/{entity}/{entity}-form.tsx
□ Public API nếu field cần expose ra frontend
   → src/lib/public-api-{entities}.ts (include field trong query)
□ TypeScript types nếu có custom type definitions
```

### Step 5 — Verify
```bash
npx tsc --noEmit       # 0 errors sau khi update code

# Manual test:
□ Dev server khởi động không có lỗi
□ Admin form: field mới hiển thị đúng (nếu có UI)
□ Create/Update: field mới được save vào DB
□ List/Detail: field mới hiển thị đúng giá trị
```

### Step 6 — Commit
```bash
# Commit SQL file + code changes cùng nhau
git add scripts/db/migration-{date}-{desc}.sql
git add src/lib/{entity}-actions.ts
git add src/app/admin/... # nếu có form update
git commit -m "feat: add {column} to {table} (LEO-XXX)"

# Ví dụ:
# feat: add weight_kg column to products (LEO-311)
# feat: add idx_products_brand_id index for brand filter (LEO-312)
```

---

## Safety Checklist

### Trước khi chạy SQL:
```bash
□ SQL đã test trên staging/local trước? (nếu có)
□ Không có DROP TABLE / TRUNCATE trong script
□ Không có DELETE không có WHERE clause
□ NOT NULL column có DEFAULT value
□ Foreign key column có index tương ứng
```

### Các thay đổi RỦI RO CAO — phải hỏi PM:
```bash
□ DROP COLUMN / DROP TABLE
□ ALTER COLUMN TYPE (thay đổi kiểu dữ liệu)
□ RENAME COLUMN / RENAME TABLE
□ Xóa UNIQUE constraint (có thể tạo duplicate data)
□ Thêm NOT NULL không có DEFAULT vào bảng có data
```

---

## Verify

```bash
✅ SQL đã chạy thành công trong Supabase (không có error)
✅ npx prisma db pull → schema.prisma đã reflect thay đổi
✅ npx tsc --noEmit → 0 errors
✅ Dev server khởi động bình thường
✅ Manual test: thay đổi hoạt động đúng
✅ Không có data loss trong existing records
```

---

## Output Template

```
✅ [Claude] DB Schema change hoàn thành — LEO-XXX

Thay đổi:
- Bảng: {table}
- Loại: [thêm column / thêm index / thêm constraint]
- Chi tiết: {column} {type} [nullable/not null] [default: X]

Migration file: scripts/db/migration-{date}-{desc}.sql
Code update:
  - src/lib/{entity}-actions.ts: thêm {field} vào Zod schema
  - [other files]

npx tsc --noEmit: ✅ (0 errors)
Verify: [kết quả manual test]

Notes: [gotcha hoặc thông tin cho team]
```

Nếu có breaking change cần Antigravity update frontend:
```
⚠️ [Claude] Breaking change trong schema — LEO-XXX

Đã đổi: {old} → {new}
Ảnh hưởng: Antigravity cần update [component/query nào]
Action required: [mô tả cụ thể cần làm]
```
