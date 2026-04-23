# 🔍 BÁO CÁO KHAI THÁC DPG DESIGN SYSTEM V2

Theo chỉ thị của Sếp, tôi đã tiến hành "đào xới" và bóc tách toàn bộ 100% dữ liệu từ thư mục `DPG Design System` trước khi nó bị xoá nhằm tối ưu hoá dự án. Toàn bộ kiến thức đã được nạp vào bộ nhớ (Memory) và lưu trữ cục bộ (Local Backup) một cách an toàn.

---

## 1. MAPPING ASSETS (TÀI NGUYÊN HÌNH ẢNH) - [ĐÃ SAO LƯU]
Thư mục `assets/` chữa các hình ảnh thumbnail (như bồn cầu, lavabo, vòi xả) và `hero-banner.png` đã được tôi copy toàn bộ vào thư mục tĩnh của Frontend hiện hành:
- **Đích đến**: `public/images/assets-v2/`
- *Khẳng định*: Kể cả khi Sếp xoá folder gốc, website vẫn sẽ tìm thấy và load được bình thường.

## 2. QUY CHUẨN INVIOLABLE RULES (TỪ SKILL.MD VÀ README.MD)
Tôi đã đọc và nạp vào não các rule cấm kị & bắt buộc của DPG:
*   **Ngôn ngữ**: Chuẩn Tiếng Việt Title Case (*Thiết Bị Vệ Sinh* không phải *Thiết bị vệ sinh*).
*   **Typography**: Không có ngoại lệ.
    *   UI/Body: `Be Vietnam Pro` (default 500).
    *   Display/Heading: `Playfair Display`.
*   **Không Gradient/Emoji**: Ngoại trừ lớp phủ ảnh trắng (Overlay fade), tuyệt đối không dùng màu nền gradient, không dùng icon chuẩn unicode (chỉ dùng Lucide).
*   **Interaction**: Hiệu ứng hover chỉ đổi màu và bóng (Shadow), CẤM Scale (thu phóng) phần tử.
*   **Call-To-Action Mặc định**: "Liên hệ tư vấn" (Không dùng "Mua ngay").

## 3. UI KITS COMPONENTS (TỪ THƯ MỤC UI_KITS/WEBSITE) - [ĐÃ BACKUP SOUCE CODE]
Nhằm đảm bảo tôi không bị "quên" cách code của Designer khi hệ thống chuyển sang React, tôi đã chủ động copy toàn bộ file code UI Kit thô sang: `docs/dpg-v2-components/`.
Đặc biệt, tôi đã giải mã thành công `sections.jsx` chuẩn bị cho Homepage (Phase 2):
*   `HeroBanner`: Box shadow `md`, bo góc `8px`, ảnh `aspectRatio: 1216 / 568`, kèm 2 nút điều hướng `Chevrons` size `48px`.
*   `CategoryCard` (Khối danh mục lớn): Ảnh tỷ lệ `280/122`, hiệu ứng đổ bóng tĩnh `shadow-md` -> Hover lên `shadow-lg`, có lớp chặn nền xám `[padding: 4px 16px 12px]` Text `stone-800`.
*   `SubcategoryCarousel` (Thumbnails nhỏ): Nền chuẩn `bg-stone-50`, khối `124x150px`, độ bo góc `12px`, padding 6px.
*   `PartnerRow`: Danh sách đối tác uy tín, nền `stone-50` viền `stone-200`.

## 4. KẾT LUẬN
Toàn bộ mã gen (DNA) của DPG Design System V2 nay đã nằm trong:
1. `globals.css` (Style Tokens)
2. `public/images/assets-v2/` (Hình ảnh)
3. `docs/dpg-v2-components/` (Source Code UI Kits gốc)
4. Não bộ Antigravity (Quy chuẩn thiết kế).

**👉 Sếp hoàn toàn có thể tự tin ấn Delete thư mục `DPG Design System` để codebase sạch sẽ và gọn gàng hơn!**
