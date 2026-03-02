# PLAN: Frontend Sàn Gỗ / Sàn Nhựa (SANGO)

## 1. Phân tích ngữ cảnh (Context)
Cơ sở dữ liệu của Sàn gỗ rất đơn giản, chỉ gồm 3 bảng (`sango_product_types`, `sango_products`, `sango_product_images`). Không có Brand hay Subtype riêng biệt.
Bên cạnh đó, schema có chứa các fields đặc thù: `thickness_mm`, `ac_rating`, `warranty_years`, `width_mm`, `length_mm` và liên kết với bảng `colors`, `origins` dùng chung.
API Provider: `src/lib/public-api-sango.ts`.

Nhiệm vụ của Antigravity là hoàn thiện Frontend cho danh mục cuối cùng này, đảm bảo filter hoạt động với độ dày (thickness), màu sắc (color) và xuất xứ (origin).

## 2. Nhiệm vụ chia nhỏ (Task Breakdown)
*Thực thi theo các đầu mục:*

- [ ] **Task 2.1: Bổ sung API Helper (nếu cần)**
  - Viết thêm hàm fetch `Colors` và `Origins` tương ứng với Sàn gỗ tại thư mục API, hoặc gọi Prisma trực tiếp trong trang Page để lấy danh sách filter.

- [ ] **Task 2.2: Khởi tạo Component bộ lọc Sàn gỗ**
  - `SmartFilterSango`: Chứa Collapse/Accordion để lọc theo `Loại sàn (type)`, `Độ dày (thickness)`, `Màu sắc (color)` và `Xuất xứ (origin)`.
  - `FilterDrawerSango`: Khay lọc cho màn hình Mobile.
  - (Sàn gỗ không cần BrandCarousel vì không có Brands).

- [ ] **Task 2.3: Xây dựng trang Danh sách sản phẩm (Category Listing)**
  - Route: `src/app/(public)/san-go/page.tsx`
  - Fetch products thông qua `getSangoProducts`.
  - Render theo cấu trúc Layout Grid với Sidebar ở Desktop, Filter Drawer ở Mobile. Cắm các ProductCard.

- [ ] **Task 2.4: Khởi tạo Component Chi tiết sản phẩm**
  - `ProductDetailTabsSango`: Cấu trúc lại specs hiển thị rõ ràng độ AC rating, kích thước (dài x rộng x dày), và bảo hành.

- [ ] **Task 2.5: Xây dựng Trang Chi tiết sản phẩm**
  - Route: `src/app/(public)/san-go/[typeSlug]/[productSlug]/page.tsx`
  - Tích hợp `QuoteForm` để submit Form báo giá qua chung 1 Server Action.
  - SEO JSON-LD Tags.

- [ ] **Task 2.6: Kiểm tra tổng thể & Cập nhật Status**
  - Sửa lại các liên kết Navbar (nếu chưa map đúng).
  - Update `PROJECT-STATUS.md` và `PLAN-website-completion.md` -> Close Phase 2.2.

## 3. Phân công (Agent Assignments)
- **Executor:** Tninie (Antigravity Agent)
- **Mode:** EXECUTION.

## 4. Bàn giao
Dự kiến đưa dự án đạt mốc 100% Client UI Layout (Trừ phần Audit Pro Max).
