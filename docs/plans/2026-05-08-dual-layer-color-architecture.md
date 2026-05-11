# Dual-Layer Color Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the Dual-Layer Color Architecture by normalizing product colors into the `colors` table (`color_id`) for filtering and variants, while retaining raw color strings in the `specs` JSON for technical display, and updating all related Admin and Frontend UIs.

**Architecture:** 
1. **Normalized Data (Layer 1):** A Node.js migration script will seed standard color categories (White, Black, Chrome, Gold, etc.) into the `colors` table and map ~3,000 existing products to their respective `color_id` based on rules derived from `specs`, `sku`, and `name`.
2. **Raw Display Data (Layer 2):** The frontend will continue to render the raw `specs` JSON on the Product Detail Page for technical accuracy.
3. **UI/UX Updates:** The Admin CMS will be updated to manage `color_id` during product entry. The Frontend will utilize `color_id` to build Sidebar Filters on category pages and Color Swatch Variant Selectors on the PDP.

**Tech Stack:** Next.js App Router, Prisma ORM, Node.js (for migration scripts), shadcn/ui.

---

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [Task 1: Seed Master Colors Table](./sub-skills/task-1-seed-master-colors-table.md)
- **Step 1:** Create a Node.js script `scripts/colors/seed-master-colors.mjs`.
- **Step 2:** Define a dictionary of standard sanitary colors with their Hex codes (e.g., Trắng `#FFFFFF`, Đen mờ `#1A1A1A`, Crom/Niken `#E0E4E5`, Vàng `#FFD700`, Đồng `#B87333`, Xám `#808080`).
- **Step 3:** Use Prisma to `upsert` these records into the `colors` table based on the `slug`.
- **Step 4:** Run the script and verify records are created in the database.
- **Step 5:** Commit the script.

### 2. [Task 2: Develop and Execute Color Mapping Script](./sub-skills/task-2-develop-execute-color-mapping.md)
- **Step 1:** Create a script `scripts/colors/apply-color-mapping.mjs`.
- **Step 2:** Fetch all seeded colors from the database into a memory map.
- **Step 3:** Fetch all products. Implement parsing logic matching:
  - `specs` ("màu sắc", "lớp mạ") keywords.
  - `sku` suffixes (e.g., `#NW1` -> Trắng, `#MBL` -> Đen).
  - `name` keywords (e.g., "mạ crom" -> Crom).
- **Step 4:** Batch update the `color_id` on the `products` table for all matched items.
- **Step 5:** Log results to `color-mapping-log.txt`.
- **Step 6:** Run the script locally and verify the DB updates via a quick SQL/Prisma query check.
- **Step 7:** Commit the script and logs.

### 3. [Task 3: Update Admin CMS - Product Form](./sub-skills/task-3-update-admin-cms-product-form.md)
- **Step 1:** Navigate to the admin product creation/edit form (`src/app/admin/(dashboard)/products/edit/[id]/page.tsx` or similar).
- **Step 2:** Fetch available colors from the `colors` table.
- **Step 3:** Add a dropdown/select UI component for "Màu sắc (Filter/Variant)" bound to `color_id`.
- **Step 4:** Ensure the form submission properly passes `color_id` to the Prisma update/create function.
- **Step 5:** Test saving a product with a modified color.
- **Step 6:** Commit the changes.

### 4. [Task 4: Update Frontend - Category Sidebar Filter](./sub-skills/task-4-update-frontend-category-filter.md)
- **Step 1:** Navigate to the Category Page logic (e.g., `src/app/(store)/category/[slug]/page.tsx` or its filter components).
- **Step 2:** Modify the filter aggregation logic to include `color_id` from the `products` belonging to the current category.
- **Step 3:** Render the Color Filter UI (using color swatches or text checkboxes).
- **Step 4:** Ensure URL search params correctly apply the Prisma `where: { color_id: { in: [...] } }` query.
- **Step 5:** Test filtering a category by a color (e.g., Vòi Chậu -> Đen mờ).
- **Step 6:** Commit the changes.

### 5. [Task 5: Update Frontend - PDP Variant Selector (Radio Card)](./sub-skills/task-5-update-frontend-pdp-variant-selector.md)
- **Step 1:** Navigate to the Product Detail Page (`src/app/(store)/product/[slug]/page.tsx`).
- **Step 2:** Fetch sibling products that share the same `variant_group` as the current product, including their `colors` relation.
- **Step 3:** If siblings exist, render a Variant Selector UI (Color Swatches) below the product title.
- **Step 4:** Ensure clicking a swatch navigates the user to the respective variant's `slug`.
- **Step 5:** Ensure `specs` still renders normally in the technical table.
- **Step 6:** Test navigation between variants.
- **Step 7:** Commit the changes.
