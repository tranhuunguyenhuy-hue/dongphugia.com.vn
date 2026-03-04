# PLAN: Mega Menu Fix & Real Data Integration

## 1. Context & Objectives
**User Request:**
- Currently experiencing a UI error preventing testing.
- MegaMenuSidebar must use ACTUAL project data, not fake/extra data.
- The previous image was just a UI mockup; the integration must return the real data prepared previously.
- Synchronize data including images (if any).

**Current State & Issues:**
- `npm run dev` is running, but user reports a UI error. This could be a Next.js hydration error, an `Image` domain configuration error (if URLs are from external sources), or a runtime error in `mega-menu.tsx`.
- The data fetched in `mega-menu-actions.ts` might be missing relations or returning in a format that the UI doesn't correctly render, causing the "fake data" appearance or errors.

## 2. Agent Assignments (Phase 2 - Post Approval)

### Core Group
- **`debugger` (Agent 1):** 
  - **Task:** Analyze the UI Error. Check `mega-menu.tsx` for potential hydration mismatches, missing keys, or `next/image` domain issues.
- **`database-architect` / `backend-specialist` (Agent 2):** 
  - **Task:** Review `src/app/actions/mega-menu-actions.ts` and `prisma/schema.prisma` to ensure the queries exactly match the real project data (e.g., correctly fetching `thumbnail_url`, `hero_image_url`, `logo_url` from the database that was prepared).
- **`frontend-specialist` (Agent 3):** 
  - **Task:** Update `src/components/home/mega-menu.tsx` to handle the real data shapes perfectly, display images gracefully, and fix any layout/rendering bugs causing the UI error.

## 3. Implementation Steps
1. **Analyze:** Check `src/app/actions/mega-menu-actions.ts` to see what fields are ACTUALLY being queried. Verify if there's any hardcoded mock data left.
2. **Debug UI:** Check `mega-menu.tsx` for Next.js `Image` component usage. If images are external, we might need to use generic `<img>` tags or update `next.config.js`, but since we can't easily restart the server, using `img` or `unoptimized={true}` on `next/image` is safer if domains are unknown.
3. **Refactor Action & Component:** Rewrite the action to ensure 100% real data mapping, and update the component to render it safely without throwing runtime errors.
4. **Verification:** Run `lint_runner.py` or TypeScript checks to ensure no type errors.

# Kế hoạch Thiết kế UI & Phát triển Mega Menu cho Sidebar Trang Chủ

Dựa trên yêu cầu giao diện (UI BOLD theo hướng Frontend-design) nhằm đem đến trải nghiệm UX mượt mà, ấn tượng, tạo sự thuận tiện khi khách hàng tương tác với Sidebar Menu Trang Chủ. Dưới đây là kế hoạch kiến trúc và thiết kế:

## 1. Yêu Cầu Giao Diện (UI/UX Aesthetics)
*   **Typography:** Sử dụng font chữ sang trọng có độ tương phản cao cho tiêu đề (như các header của thương hiệu). Các menu con sử dụng body font mang cảm giác sạch sẽ, hiện đại (không dùng Arial/Inter mặc định, có thể là các font có thuộc tính hiển thị UI tốt). 
*   **Tone & Composition:** Thiết kế gọn gàng **Refined Minimalism / Clean Air** kết hợp bo góc mềm mại. Cảm giác nổi dốc tạo sự cao cấp qua `box-shadow` nhẹ nhàng. 
*   **Motion & Interaction (Micro-Animations):** 
    *   Sử dụng CSS transitions/animations mượt: Thay vì hiện `display: block` mất tự nhiên, popup cần được làm mờ fadeIn (`opacity-0` đến `opacity-100`) và trượt nhẹ từ trong ra ngoài (translate X) một khoảng rất nhỏ (Staggered reveals cho nội dung mượt).
    *   Responsive hover state: Khi hover vào dòng category, nó giữ được background active. 

## 2. Phân Rã Cấu Trúc Components (Component Tree)
Chúng ta sẽ nâng cấp file `src/components/home/category-sidebar.tsx` hoặc tách logic ra file mới.
*   `<CategorySidebar>`: Là Shell ngoài cùng.
    *   `<CategoryList>`: Danh sách các category chính (Sẽ theo dõi event `onMouseEnter` / `onMouseLeave` để mở rộng SubMenu).
*   **NEW** `<MegaMenuPanel>`: Một layout panel nổi (`absolute` so với parent relative là thanh wrapper, hoặc dùng [Radix UI Navigation Menu/Popover/HoverCard] để xử lý accessibility & vị trí, tránh bị che lấp z-index).
    *   *Grid Renderer*: Trình bày dưới dạng lưới (Grid template columns) tùy thuộc vào thuộc tính của category (Gạch dùng Card hình ảnh lớn, còn Thiết bị Vệ sinh/Bếp dùng dạng List Text hoặc Logo thương hiệu).

## 3. Cấu Trúc Dữ Liệu (Mô hình Model cần thiết)

Dựa trên hình ảnh bạn gửi, việc thiết kế không chỉ là UI mà còn là cách chúng ta đưa data vào. Tôi đã review cấu trúc hiện tại (`CATEGORIES`) nó mới chỉ có `{ label, href, active }`. Cần mở rộng hoặc call database. Đây là các trường bị thiếu mà bạn có thể yêu cầu Claude hoặc tôi bổ sung:

**A. Cho Nhóm Hiển Thị Hình Ảnh Cỡ Lớn (Ví dụ: Gạch ốp lát, Sàn Gỗ)**
```ts
type CategoryImageItem = {
    title: string;          // Ví dụ: "Gạch Vân đá Marble", "Vật liệu sàn gỗ"
    href: string;           // Link điều hướng (eg: /gach-op-lat?type=marble)
    image: string;          // URL Hình ảnh minh hoạ hiển thị trong menu
}
```

**B. Cho Nhóm Hiển Thị Phức Tạp: Branding & List Danh Mục Con (VD: Thiết bị vệ sinh, bếp)**
```ts
type BrandLabel = {
    name: string;   
    logoSrc?: string; // Tên hãng hoặc link hình Logo thương hiệu. (VD: "TOTO", "BOSCH"...). Dùng array
}

type MenuSection = {
    sectionTitle: string; // VD: "Bồn cầu", "Vòi lavabo", "Đèn sưởi"
    items: {
       label: string;     // VD: "Bồn cầu 1 khối", "Vòi nóng lạnh"
       href: string;
    }[]
}

// Mega Menu chính
type MegaMenuData = {
    menuType: "IMAGE_CARDS" | "COMPLEX_LIST"; // Loại giao diện Menu
    brands?: BrandLabel[];                    // Render danh sách thương hiệu 
    imageItems?: CategoryImageItem[];         // Render cho menuType: IMAGE_CARDS
    sections?: MenuSection[];                 // Render cho menuType: COMPLEX_LIST
}
```

## 4. Bạn (Người dùng) cần chuẩn bị
Để tôi hoặc Claude code có thể lập trình chính xác, **những thức bạn cần đưa ra / bổ sung thêm bao gồm:**
1.  **Dữ liệu thô (Fake Data / CMS / API):** Cần một bản nháp dữ liệu JSON hoặc data models theo format trên để chúng tôi loop qua, hoặc nếu có API Backend (nhấn `/api`) cấp sẵn thì phiền bạn share response.
2.  **Cung cấp Link Figma:** Nếu bạn muốn tôi sao chép pixel-perfect màu sắc (Mã HEX, box-shadow specs, độ bo góc radius chênh lệch chi tiết), hãy gửi Inspect CSS từ máy bạn hoạc chia sẻ DevMode Export. 
3.  **Third-party (Tùy chọn):** Website đã cài Radix-ui/HoverCard nên việc tích hợp Popover rất dễ dàng, hãy xác nhận có được dùng các Radix UI sẵn có trong `node_modules` hay muốn code thuần.

## 5. Xác Minh Và Kiểm Thử (Verification Plan)
- [x] **Phase 1:** Hiểu data flow từ Backend để truyền vào Client component MegaMenu.  
- [x] **Phase 2:** Update UI theo Backend real data thay vì Mock. 
- [x] **Phase 3:** Update Link URLs Filter Mapping & Default Fallbacks Image for categories.  
- [x] **Phase 4 [Frontend Design UI Flow]:** Refactor cực hạn giao diện Mega Menu, xử lý lỗi Horizontal Scroll (do Popups vượt quá width màn hình khi mở trên các viewport nhỏ ~1024px). Áp dụng pattern Mega Dropdown Panel cho Menu Header.

---
Vui lòng đánh giá kế hoạch và tiến hành kiểm tra trên code Base thực tế!Phân tích nguyên nhân:** Khoảng cách giữa Mega Menu và Cấu trúc Routing Trang Listing
*   URL để filter sản phẩm trong các trang con như Gạch, Thiết bị vệ sinh được điều hướng qua URL Query Parameters (`?pattern=...`, `?type=...`, `?brand=...`) thay vì React Dynamic Routes (`/[slug]`).
*   Database của "Pattern Types" không chứa `thumbnail_url`. Assets hình ảnh kiểu vân gạch đang được fix cứng trong các constant arrays ở Frontend (như `PATTERN_TYPE_ASSETS`).

**Giải pháp:**
1.  **Chỉnh sửa Frontend Mega Menu Component:** Sửa đổi logic thẻ Link `<Link href={...}>` dựa trên `cat.slug`. Mapping chính xác:
    *   `gach-op-lat` => `?pattern={slug}`
    *   `san-go` => `?type={slug}`
    *   `thiet-bi-...` => `?type={type}&subtype={subtype}`, `?brand={brand}`
2.  **Bơm Hình ảnh Khẩn cấp (Fallback Images):** Tạo 1 hằng số URL fallback tương tự Component Selector để Mega Menu vẫn lên hình trực quan nếu Backend trả về mảng NULL cho thumbnail.  rs.
