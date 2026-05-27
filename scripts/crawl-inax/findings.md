# INAX Crawl Pipeline - Findings & Discoveries

## 1. Naming Convention (Quy tắc đặt tên của INAX)
- Tiền tố thân bồn cầu thường là: `AC`, `C` (VD: `AC-4005VN`)
- Tiền tố nắp: `CW` (Nắp rửa điện tử), `CF` (Nắp đóng êm)
- Phụ kiện khác: Van chặn `LF`, Bộ xả `DTF`, Ống mềm `A-`...

## 2. DOM Structure & Selectors (Hita.com.vn)

**Khối Gallery Hình ảnh (CỰC KỲ QUAN TRỌNG):**
- Ảnh hiển thị trong các class: `.picture-wrapper img`, `.product-detail-left img`, `.slick-slide img`.
- **Phát hiện nghiêm trọng**: Hita chèn Thumbnail của Video YouTube trực tiếp vào Gallery (VD: `https://i.ytimg.com/vi/sEngsFME4uQ/maxresdefault.jpg`). 
- *Cách xử lý*: Bắt buộc phải viết logic **Filter chặn mọi URL chứa `ytimg.com`, `youtube.com`, `vimeo`**.

**Khối Thông số Kỹ thuật (Technical Specs):**
- Thông số kỹ thuật nằm trong thẻ `<table>` ở khu vực thông tin sản phẩm.
- *Cách xử lý*: Parse các thẻ `<tr>` thành cặp Key-Value (VD: `Thương hiệu: INAX`, `Nơi sản xuất: Việt Nam`) và lưu vào object JSON `specs` trong Database.

**Khối Giá (Pricing):**
- Giá giảm (`price`): `.product-new-price-land`
- Giá gốc (`original_price`): `.product-old-price-land`
- Giá giảm thêm online (`online_discount_amount`): Lọc từ `.deal-price` (nếu có).

**Khối Thông Tin (Info):**
- Tên sản phẩm: `h1`
- Breadcrumbs (Để lấy Danh mục cấp 3): Các thẻ `li` trong `.breadcrumb` (VD: "Bồn Cầu 1 Khối")

**Khối Mô tả (Description) & Nút "Xem thêm":**
- Nằm trong class `.content-desc` hoặc `.product-description`.
- Dù có nút "Xem thêm" (ẩn bớt text trên giao diện người dùng bằng CSS `max-height`), nhưng **TOÀN BỘ mã HTML đã được load sẵn trong DOM**. Ta chỉ cần trích xuất mã HTML của `.content-desc` là lấy được 100% nội dung (Khoảng >4000 ký tự HTML).
- **Loại bỏ Video**: Bắt buộc dùng `cheerio` để xóa sạch các thẻ `iframe`, `video` và ảnh thumbnail youtube bên trong khối HTML này trước khi lưu.

**Khối Tài Liệu & Phụ Kiện (Documents & Accessories):**
- Link PDF: Tìm thẻ `<a href="...">` có đuôi `.pdf` hoặc chứa từ khóa `tài liệu`. Tải về BunnyCDN.
- **Phát hiện quan trọng về Scope**: File PDF trên Hita thường nằm ở thẻ div `#package-attachments` hoàn toàn tách biệt khỏi khối mã HTML của description. Nếu chỉ lấy HTML của `.description-content` rồi tìm link PDF thì sẽ KHÔNG THẤY GÌ. Phải dùng Cheerio lấy DOM toàn trang (Global `$('a')`) để cào link PDF trước khi xóa rác.
- Phụ kiện (Nguyên hộp bao gồm): Tìm `<h2>Nguyên hộp bao gồm</h2>`, bóc mảng text từ thẻ `<div class="panel-body">` bên dưới nó. Lưu vào mảng `specs.accessories`.

## 3. Các Bài Học & Cạm Bẫy Cần Tránh (Critical Pitfalls)

**A. Bẫy Hình Ảnh Lazy Load (Lazy Load Trap)**
- Các hình ảnh bên trong bài viết mô tả (Description) thường sử dụng cơ chế Lazy Load. Thuộc tính `src` thực chất bị rỗng hoặc trỏ vào ảnh placeholder mờ, đường link ảnh THẬT nằm ở thuộc tính `data-src`.
- *Cách khắc phục*: Bắt buộc lặp qua tất cả thẻ `<img>` trong Description, lấy giá trị `data-src` đè lại vào `src`. Đồng thời phải xóa bỏ class `lazy` và thuộc tính `data-src` khỏi thẻ để tránh xung đột trên giao diện Frontend của ĐPG.

**B. Bẫy Regex Replace Domain (URL Corruption Trap)**
- Khi dùng string replace để đổi tên thương hiệu đối thủ (VD: `/hita/gi` -> `Đồng Phú Gia`), Regex sẽ vô tình biến đổi luôn các đường dẫn URL nội bộ của hình ảnh và hyperlink. (VD: `https://cdn.hita.com.vn` biến thành `https://cdn.Đồng Phú Gia.com.vn` làm gãy link ảnh hoàn toàn 404).
- *Cách khắc phục*: 
  - Bước 1: Dùng Regex tạm thời mã hóa (encode) chữ "hita" bên trong thuộc tính `src` của ảnh và `href` của thẻ `a` thành một chuỗi an toàn (VD: `h_i_t_a`).
  - Bước 2: Thực hiện replace toàn bộ nội dung HTML (text) từ `hita` sang `Đồng Phú Gia`.
  - Bước 3: Đổi chuỗi `h_i_t_a` trở lại thành `hita` để khôi phục URL chuẩn.

**C. Bẫy Frontend Sanitizer**
- Giao diện Frontend có thể có các file cấu hình `dangerouslySetInnerHTML` để tự động xóa rác của đối thủ (VD: `product-detail-tabs.tsx` chứa code chặn `<img src="*hita*">`). 
- *Bài học*: Luôn kiểm tra song song Component hiển thị trên Frontend để đảm bảo chúng ta không tự bắn vào chân mình bằng các logic whitelist/blacklist cũ.

**D. Bẫy Prisma OR Conflict & Scope Trap (Frontend)**
- Nếu Frontend sử dụng Prisma với tham số loại trừ dạng `NOT: { product_type: { contains: 'phu-kien' } }`, Prisma sẽ tự động loại bỏ (tàng hình) toàn bộ sản phẩm có giá trị `product_type = NULL`. Hậu quả là hàng trăm sản phẩm chưa phân loại cấp 3 bị biến mất khỏi website. Cần sửa thành `{ OR: [ { product_type: null }, { NOT: { ... } } ] }`.
- **Lỗi ghi đè OR**: Trong một Object query của Prisma, nếu sử dụng cú pháp spread `...obj` có chứa nhiều keys `{ OR: [...] }` ở level root, Prisma (và Javascript) sẽ ghi đè OR cuối cùng lên OR đầu tiên. Điều này khiến bộ lọc gốc `is_master` / `is_featured` bị vô hiệu hóa hoàn toàn bởi bộ lọc Category. Cần chuyển mọi lệnh `OR` gom vào trong mảng `AND: []`.

**E. Bẫy Hotlink Ảnh Trong Bài Viết (Description Image Trap)**
- Khi cào mã HTML của Description, nếu chỉ replace chuỗi `hita` thành `h_i_t_a` để bảo vệ URL ảnh thì vô tình chúng ta vẫn đang giữ lại link ảnh gốc trỏ về server của đối thủ.
- Điều này dẫn đến tình trạng "Hotlink": Web của chúng ta dùng ké băng thông của đối thủ. Nếu đối thủ đổi tên miền, chặn truy cập hoặc xóa ảnh, toàn bộ bài viết của chúng ta sẽ bị lỗi hiển thị ảnh.
- *Cách khắc phục*: Bắt buộc phải viết một script "Deep Image Downloader" để phân tích HTML (bằng Cheerio), lấy toàn bộ thuộc tính `src` của thẻ `<img>`, download ảnh đó về BunnyCDN, lấy URL CDN mới và ghi đè lại vào chuỗi HTML trước khi lưu vào Database. Mọi Crawler từ nay về sau phải được tích hợp tính năng này vào thẳng Phase 2.

**F. Bẫy SKU Rác (Dirty SKU Trap)**
- Các đại lý (như Hita) thường tự ý ghép thêm từ khóa SEO tiếng Việt và thương hiệu vào ngay trường SKU sản phẩm để tối ưu tìm kiếm (Ví dụ: `BON-CAU-1-KHOI-INAX-AC-939VN` thay vì mã gốc là `AC-939VN`, `PHEU-THOAT-SAN-INAX-PBFV-120` thay vì `PBFV-120`).
- Điều này phá vỡ cấu trúc "Alphanumeric" đồng bộ của thương hiệu, làm hệ thống không thể map được biến thể (Variants) bằng prefix, và cũng gây ra tình trạng tạo bản sao trùng lặp (Duplicate Records) nếu sản phẩm đó đã được nhập tay đúng mã gốc.
- *Cách khắc phục*: Bắt buộc chạy Data Cleansing. Viết script regex dò tìm cụm `-(INAX|inax)-` hoặc các tiền tố rác (VD: `BON-CAU-`) để trích xuất ngược lại phần đuôi SKU nguyên bản. Catch lỗi `P2002` (Unique Constraint) để chủ động xóa bỏ bản record rác nếu SKU gốc đã tồn tại.

## 4. Category Mapping Logic & Hotfixes (Logic Phân Loại Cấp 3)

Quy trình tự động hóa ánh xạ danh mục cấp 3 (slug `product_type`) cho thương hiệu INAX dựa trên Breadcrumbs Hita và Regex Tên sản phẩm đã bộc lộ nhiều điểm mập mờ từ dữ liệu nguồn. Dưới đây là các phát hiện và giải pháp tối ưu được đúc kết:

### A. Sự ưu tiên kết cấu vật lý so với tính năng thông minh (Physical Structure vs Smart Features)
- **Vấn đề**: Nhiều sản phẩm "Bồn cầu treo tường thông minh" (vừa treo tường, vừa dùng nắp rửa điện tử) bị gộp vào mục "Bồn cầu thông minh" (`bon-cau-thong-minh`). Tuy nhiên, người dùng tìm kiếm bồn cầu treo tường thường tìm theo đặc tính kết cấu vật lý và đường nước âm tường trước.
- **Giải pháp**: **Luôn ưu tiên đặc tính kết cấu vật lý (`bon-cau-treo-tuong`) lên trước tính năng thông minh**. Quy tắc kiểm tra Regex `"treo tường"` được đặt ở mức ưu tiên cao hơn `"thông minh"` hay `"điện tử"`.

### B. Nhầm lẫn giữa Tay Sen Tắm và Tay Gạt Điều Khiển (Handshowers vs Lever Handles)
- **Vấn đề**: Hita đặt tên "Tay sen" cho cả bộ phận phun mưa cầm tay và các tay gạt nước/núm vặn gạt của củ sen (VD: "Tay gạt sen tắm", "Tay sen tắm"). Điều này khiến hàng chục sản phẩm phụ kiện kim loại bị map sai vào mục `tay-sen` (vốn chỉ dành cho vòi phun sen cầm tay).
- **Giải pháp**: Thiết lập bộ lọc nghiêm ngặt cho `tay-sen`. Chỉ chấp nhận các sản phẩm chứa chính xác từ khóa "Tay sen" hoặc "Tay sen tắm" đi kèm với thương hiệu INAX và SKU tương ứng. Mọi sản phẩm có chứa chữ "tay gạt", "tay gạt củ sen", "tay vặn", "nắp chụp" đều bị quét và chuyển cư sang danh mục `phu-kien-sen-tam`.

### C. Phân biệt Củ Sen Độc Lập và Bộ Sen Tắm (Mixing Valves vs Full Sets)
- **Vấn đề**: Cách đặt tên của Hita rất lập lờ: "Sen tắm nhiệt độ", "Bộ vòi sen tắm nóng lạnh". Cả hai đều chứa từ khóa "sen tắm", nhưng một cái chỉ là củ sen rời (valve), cái còn lại là trọn bộ (củ + dây + tay sen).
- **Giải pháp**: Áp dụng quy tắc phủ định:
  - Nếu tên chứa "sen tắm", "vòi sen tắm" nhưng **KHÔNG** chứa từ khóa "Bộ" -> Phân loại vào `cu-sen` (Củ sen).
  - Nếu tên chứa "Bộ sen tắm", "Bộ vòi sen" hoặc có chữ "Cây", "Đứng" -> Phân loại vào `sen-tam` hoặc `sen-dung` tương ứng.

### D. Thân Vòi và Các Linh Kiện Rời (Spouts & Component Parts)
- **Vấn đề**: Các sản phẩm như "Thân vòi xả bồn", "Núm chuyển hướng", "Nắp trang trí củ sen" dễ bị Regex nhận nhầm thành củ sen hoặc vòi lavabo hoàn chỉnh.
- **Giải pháp**: Tất cả các sản phẩm có tiền tố "Thân vòi", "Núm vặn", "Nắp chụp", "Ốc", "Đế", "Co nối" phải được đẩy thẳng về các danh mục phụ kiện chuyên biệt (`phu-kien-voi` hoặc `phu-kien-sen-tam`) thay vì cho vào danh mục thiết bị chính.

