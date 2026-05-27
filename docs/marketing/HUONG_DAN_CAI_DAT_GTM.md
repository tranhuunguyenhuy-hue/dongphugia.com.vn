# 📖 Hướng Dẫn Cài Đặt Google Tag Manager (GTM)
## Đồng Bộ GA4 & Facebook Pixel Cho Website Đông Phú Gia

> **Phiên bản:** 1.0  
> **Ngày tạo:** 21/05/2026  
> **Dành cho:** Team Marketing / Performance Ads  
> **GTM Container ID:** `GTM-KBXLMS2X`

---

## Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Điều Kiện Tiên Quyết](#2-điều-kiện-tiên-quyết)
3. [Bước 1: Tạo Biến DataLayer (Variables)](#3-bước-1-tạo-biến-datalayer-variables)
4. [Bước 2: Tạo Trình Kích Hoạt (Triggers)](#4-bước-2-tạo-trình-kích-hoạt-triggers)
5. [Bước 3: Cài Đặt Thẻ GA4 (Tags)](#5-bước-3-cài-đặt-thẻ-ga4-tags)
6. [Bước 4: Cài Đặt Thẻ Facebook Pixel (Tags)](#6-bước-4-cài-đặt-thẻ-facebook-pixel-tags)
7. [Bước 5: Kiểm Tra & Xuất Bản (Preview & Publish)](#7-bước-5-kiểm-tra--xuất-bản-preview--publish)
8. [Bảng Tra Cứu Nhanh](#8-bảng-tra-cứu-nhanh)
9. [Câu Hỏi Thường Gặp (FAQ)](#9-câu-hỏi-thường-gặp-faq)

---

## 1. Tổng Quan Kiến Trúc

Website Đông Phú Gia đã được tích hợp sẵn một hệ thống **DataLayer** (tầng dữ liệu) bên trong mã nguồn. Khi người dùng thực hiện hành động trên website, hệ thống sẽ tự động đẩy dữ liệu vào `window.dataLayer` theo chuẩn GA4 E-commerce.

**Nhiệm vụ của Team Marketing:** Tạo các Thẻ (Tags) và Trình kích hoạt (Triggers) trên GTM để "hứng" dữ liệu từ DataLayer và chuyển tiếp tới GA4 / Facebook Pixel.

```
┌─────────────────────────────────────────────────────────┐
│                    WEBSITE (Next.js)                     │
│                                                         │
│  Khách xem SP ──► dataLayer.push({ event: 'view_item'}) │
│  Khách bỏ giỏ ──► dataLayer.push({ event:'add_to_cart'})│
│  Khách mua    ──► dataLayer.push({ event: 'purchase' }) │
│  Khách báo giá──► dataLayer.push({event:'generate_lead'})│
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │ (tự động)
                         ▼
┌─────────────────────────────────────────────────────────┐
│              GOOGLE TAG MANAGER (GTM)                   │
│                                                         │
│  Trigger: view_item    ──► Tag GA4: view_item           │
│                        ──► Tag FB:  ViewContent         │
│  Trigger: add_to_cart  ──► Tag GA4: add_to_cart         │
│                        ──► Tag FB:  AddToCart            │
│  Trigger: purchase     ──► Tag GA4: purchase            │
│                        ──► Tag FB:  Purchase             │
│  Trigger: generate_lead──► Tag GA4: generate_lead       │
│                        ──► Tag FB:  Lead                 │
│                                                         │
└────────────────────────┬────────────────────────────────┘
                         │ (GTM chuyển tiếp)
                         ▼
              ┌──────────────────────┐
              │  GA4    │  FB Pixel  │
              │ (Báo cáo & Tối ưu)  │
              └──────────────────────┘
```

---

## 2. Điều Kiện Tiên Quyết

Trước khi bắt đầu, hãy đảm bảo bạn đã có sẵn:

| Hạng mục | Giá trị | Nơi lấy |
|----------|---------|---------|
| **GTM Container ID** | `GTM-KBXLMS2X` | ✅ Đã tích hợp vào website |
| **GA4 Measurement ID** | `G-XXXXXXXXXX` | Google Analytics → Admin → Data Streams |
| **Facebook Pixel ID** | `123456789012345` | Facebook Events Manager → Data Sources |

> ⚠️ **LƯU Ý QUAN TRỌNG:** GTM Container ID đã được đội kỹ thuật nhúng sẵn vào mã nguồn website. Bạn **KHÔNG CẦN** copy/paste bất kỳ đoạn mã `<script>` nào vào website. Chỉ cần thao tác 100% trên giao diện GTM.

---

## 3. Bước 1: Tạo Biến DataLayer (Variables)

Truy cập GTM → **Variables (Biến)** → **New (Tạo mới)** → Chọn loại **Data Layer Variable**.

Tạo lần lượt **5 biến** sau đây:

### 3.1. Biến `ecommerce.value`
- **Tên biến:** `DLV - ecommerce.value`
- **Loại biến:** Data Layer Variable
- **Data Layer Variable Name:** `ecommerce.value`
- **Data Layer Version:** Version 2
- **Mục đích:** Lấy tổng giá trị đơn hàng (VND)

### 3.2. Biến `ecommerce.currency`
- **Tên biến:** `DLV - ecommerce.currency`
- **Loại biến:** Data Layer Variable
- **Data Layer Variable Name:** `ecommerce.currency`
- **Data Layer Version:** Version 2
- **Mục đích:** Lấy đơn vị tiền tệ (luôn là `VND`)

### 3.3. Biến `ecommerce.transaction_id`
- **Tên biến:** `DLV - ecommerce.transaction_id`
- **Loại biến:** Data Layer Variable
- **Data Layer Variable Name:** `ecommerce.transaction_id`
- **Data Layer Version:** Version 2
- **Mục đích:** Lấy mã đơn hàng duy nhất

### 3.4. Biến `ecommerce.items`
- **Tên biến:** `DLV - ecommerce.items`
- **Loại biến:** Data Layer Variable
- **Data Layer Variable Name:** `ecommerce.items`
- **Data Layer Version:** Version 2
- **Mục đích:** Lấy danh sách sản phẩm (tên, giá, số lượng, danh mục)

### 3.5. Biến `lead_source`
- **Tên biến:** `DLV - lead_source`
- **Loại biến:** Data Layer Variable
- **Data Layer Variable Name:** `lead_source`
- **Data Layer Version:** Version 2
- **Mục đích:** Phân biệt nguồn Lead (hotline, form báo giá, chatbot,...)

---

## 4. Bước 2: Tạo Trình Kích Hoạt (Triggers)

Truy cập GTM → **Triggers** → **New** → Chọn loại **Custom Event**.

Tạo lần lượt **4 Trigger** sau đây:

### 4.1. Trigger `view_item`
- **Tên Trigger:** `CE - view_item`
- **Loại:** Custom Event
- **Event Name:** `view_item`
- **Kích hoạt khi:** Khách vào trang chi tiết sản phẩm

### 4.2. Trigger `add_to_cart`
- **Tên Trigger:** `CE - add_to_cart`
- **Loại:** Custom Event
- **Event Name:** `add_to_cart`
- **Kích hoạt khi:** Khách bấm nút "Thêm vào giỏ hàng"

### 4.3. Trigger `purchase`
- **Tên Trigger:** `CE - purchase`
- **Loại:** Custom Event
- **Event Name:** `purchase`
- **Kích hoạt khi:** Khách đặt hàng thành công, chuyển sang trang cảm ơn

### 4.4. Trigger `generate_lead`
- **Tên Trigger:** `CE - generate_lead`
- **Loại:** Custom Event
- **Event Name:** `generate_lead`
- **Kích hoạt khi:** Khách bấm Hotline, gửi form Báo giá, hoặc liên hệ qua Chatbox

> ⚠️ **QUAN TRỌNG:** Tên Event Name phải viết **chính xác, chữ thường, có dấu gạch dưới** như trên. Nếu sai 1 ký tự, GTM sẽ không bắt được sự kiện từ website.

---

## 5. Bước 3: Cài Đặt Thẻ GA4 (Tags)

### 5.0. Thẻ GA4 Configuration (Bắt buộc tạo đầu tiên)
- **Tên Tag:** `GA4 - Configuration`
- **Loại Tag:** Google Tag
- **Tag ID:** `G-XXXXXXXXXX` *(thay bằng Measurement ID thật của bạn)*
- **Trigger:** `All Pages`

> Đây là thẻ nền tảng. Nó tự động bắt `page_view` cho mọi trang trên website.

---

### 5.1. Thẻ GA4 - View Item
- **Tên Tag:** `GA4 - view_item`
- **Loại Tag:** Google Analytics: GA4 Event
- **Measurement ID:** `G-XXXXXXXXXX`
- **Event Name:** `view_item`
- **Event Parameters:**

| Tên tham số | Giá trị |
|-------------|---------|
| `currency`  | `{{DLV - ecommerce.currency}}` |
| `value`     | `{{DLV - ecommerce.value}}` |
| `items`     | `{{DLV - ecommerce.items}}` |

- **Trigger:** `CE - view_item`

---

### 5.2. Thẻ GA4 - Add to Cart
- **Tên Tag:** `GA4 - add_to_cart`
- **Loại Tag:** Google Analytics: GA4 Event
- **Measurement ID:** `G-XXXXXXXXXX`
- **Event Name:** `add_to_cart`
- **Event Parameters:**

| Tên tham số | Giá trị |
|-------------|---------|
| `currency`  | `{{DLV - ecommerce.currency}}` |
| `value`     | `{{DLV - ecommerce.value}}` |
| `items`     | `{{DLV - ecommerce.items}}` |

- **Trigger:** `CE - add_to_cart`

---

### 5.3. Thẻ GA4 - Purchase
- **Tên Tag:** `GA4 - purchase`
- **Loại Tag:** Google Analytics: GA4 Event
- **Measurement ID:** `G-XXXXXXXXXX`
- **Event Name:** `purchase`
- **Event Parameters:**

| Tên tham số | Giá trị |
|-------------|---------|
| `transaction_id` | `{{DLV - ecommerce.transaction_id}}` |
| `currency`       | `{{DLV - ecommerce.currency}}` |
| `value`          | `{{DLV - ecommerce.value}}` |
| `items`          | `{{DLV - ecommerce.items}}` |

- **Trigger:** `CE - purchase`

---

### 5.4. Thẻ GA4 - Generate Lead
- **Tên Tag:** `GA4 - generate_lead`
- **Loại Tag:** Google Analytics: GA4 Event
- **Measurement ID:** `G-XXXXXXXXXX`
- **Event Name:** `generate_lead`
- **Event Parameters:**

| Tên tham số | Giá trị |
|-------------|---------|
| `lead_source` | `{{DLV - lead_source}}` |

- **Trigger:** `CE - generate_lead`

---

## 6. Bước 4: Cài Đặt Thẻ Facebook Pixel (Tags)

### 6.0. Thẻ FB Pixel - Base Code (Bắt buộc tạo đầu tiên)
- **Tên Tag:** `FB Pixel - Base Code`
- **Loại Tag:** Custom HTML
- **HTML:**
```html
<script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', 'YOUR_PIXEL_ID_HERE');
  fbq('track', 'PageView');
</script>
```
> ⚠️ Thay `YOUR_PIXEL_ID_HERE` bằng Pixel ID thật (ví dụ: `123456789012345`).

- **Trigger:** `All Pages`

---

### 6.1. Thẻ FB Pixel - ViewContent
- **Tên Tag:** `FB Pixel - ViewContent`
- **Loại Tag:** Custom HTML
- **HTML:**
```html
<script>
  fbq('track', 'ViewContent', {
    content_ids: {{DLV - ecommerce.items}}.map(function(i){ return i.item_id; }),
    content_type: 'product',
    value: {{DLV - ecommerce.value}},
    currency: {{DLV - ecommerce.currency}}
  });
</script>
```
- **Trigger:** `CE - view_item`

---

### 6.2. Thẻ FB Pixel - AddToCart
- **Tên Tag:** `FB Pixel - AddToCart`
- **Loại Tag:** Custom HTML
- **HTML:**
```html
<script>
  fbq('track', 'AddToCart', {
    content_ids: {{DLV - ecommerce.items}}.map(function(i){ return i.item_id; }),
    content_type: 'product',
    value: {{DLV - ecommerce.value}},
    currency: {{DLV - ecommerce.currency}}
  });
</script>
```
- **Trigger:** `CE - add_to_cart`

---

### 6.3. Thẻ FB Pixel - Purchase
- **Tên Tag:** `FB Pixel - Purchase`
- **Loại Tag:** Custom HTML
- **HTML:**
```html
<script>
  fbq('track', 'Purchase', {
    content_ids: {{DLV - ecommerce.items}}.map(function(i){ return i.item_id; }),
    content_type: 'product',
    value: {{DLV - ecommerce.value}},
    currency: {{DLV - ecommerce.currency}},
    order_id: {{DLV - ecommerce.transaction_id}}
  });
</script>
```
- **Trigger:** `CE - purchase`

---

### 6.4. Thẻ FB Pixel - Lead
- **Tên Tag:** `FB Pixel - Lead`
- **Loại Tag:** Custom HTML
- **HTML:**
```html
<script>
  fbq('track', 'Lead', {
    content_name: {{DLV - lead_source}}
  });
</script>
```
- **Trigger:** `CE - generate_lead`

---

## 7. Bước 5: Kiểm Tra & Xuất Bản (Preview & Publish)

### 7.1. Chế độ Preview (Xem trước)
1. Trong GTM, bấm nút **Preview** (góc trên bên phải).
2. Nhập URL website: `https://dongphugia.com.vn`
3. Một cửa sổ Tag Assistant mới sẽ mở ra.
4. Thực hiện lần lượt các hành động sau trên website và kiểm tra trên Tag Assistant:

| Hành động trên Website | Event phải xuất hiện | Tags phải bắn |
|------------------------|---------------------|---------------|
| Truy cập trang chủ | `Page View` | GA4 Config, FB Base Code |
| Vào trang chi tiết sản phẩm | `view_item` | GA4 view_item, FB ViewContent |
| Bấm "Thêm vào giỏ" | `add_to_cart` | GA4 add_to_cart, FB AddToCart |
| Hoàn tất đặt hàng | `purchase` | GA4 purchase, FB Purchase |
| Bấm Hotline / Gửi form | `generate_lead` | GA4 generate_lead, FB Lead |

### 7.2. Xuất bản (Publish)
Khi tất cả Tags đều bắn đúng ở chế độ Preview:
1. Bấm **Submit** (góc trên bên phải).
2. Đặt tên phiên bản: `v1.0 - Core Four Tracking (GA4 + FB Pixel)`
3. Bấm **Publish**.

---

## 8. Bảng Tra Cứu Nhanh

### 8.1. Bảng ánh xạ Event Website ↔ GA4 ↔ FB Pixel

| # | Hành động Khách hàng | DataLayer Event | GA4 Event | FB Pixel Event |
|---|---------------------|----------------|-----------|----------------|
| 1 | Xem bất kỳ trang nào | *(tự động)* | `page_view` | `PageView` |
| 2 | Xem chi tiết sản phẩm | `view_item` | `view_item` | `ViewContent` |
| 3 | Thêm vào giỏ hàng | `add_to_cart` | `add_to_cart` | `AddToCart` |
| 4A | Đặt hàng thành công | `purchase` | `purchase` | `Purchase` |
| 4B | Báo giá / Gọi Hotline | `generate_lead` | `generate_lead` | `Lead` |

### 8.2. Bảng giá trị `lead_source` (Phân biệt nguồn Lead)

Khi sự kiện `generate_lead` được kích hoạt, biến `lead_source` sẽ cho biết chính xác khách hàng bấm vào nút nào:

| Giá trị `lead_source` | Ý nghĩa | Vị trí trên Website |
|-----------------------|---------|---------------------|
| `hotline` | Bấm nút Gọi Hotline | Chatbox Widget (góc phải dưới) |
| `quote_quick` | Bấm "Xin báo giá" | Chatbox Widget (góc phải dưới) |
| `chat_message` | Gửi tin nhắn qua Chat | Chatbox Widget (góc phải dưới) |
| `quote_cta` | Mở popup Yêu cầu Báo Giá | Trang chi tiết sản phẩm (Desktop) |
| `quote_cta_mobile` | Mở popup Yêu cầu Báo Giá | Trang chi tiết sản phẩm (Mobile) |
| `quote_form_submit` | Gửi thành công form Báo Giá | Popup Báo Giá trong trang sản phẩm |
| `business_room_hotline` | Bấm SĐT Phòng Kinh Doanh | Trang chi tiết sản phẩm |
| `navbar_contact` | Bấm "Liên hệ" trên thanh điều hướng | Header (Desktop) |
| `mobile_menu_contact` | Bấm "Liên hệ tư vấn" trên menu | Menu Mobile (Hamburger) |
| `contact_form` | Gửi thành công form Liên hệ | Trang /lien-he |

---

## 9. Câu Hỏi Thường Gặp (FAQ)

### Q: Tôi có cần chèn code vào website không?
**A:** Không. Toàn bộ mã DataLayer đã được đội kỹ thuật nhúng sẵn vào mã nguồn website. Bạn chỉ cần thao tác trên giao diện GTM.

### Q: Tại sao tôi không thấy event `page_view` trong DataLayer?
**A:** Event `page_view` được GA4 tự động thu thập thông qua thẻ GA4 Configuration + trigger All Pages. Không cần tạo Custom Event riêng cho nó.

### Q: Website dùng Next.js, có ảnh hưởng gì đến GTM không?
**A:** Có. Next.js sử dụng chuyển trang mượt (Client-side Navigation). Nếu bạn muốn đếm chính xác số lượt xem trang cho GA4, hãy bật tính năng **"History Change"** trong trigger `All Pages` của GA4 Configuration Tag. Cách làm: Vào Tag GA4 Configuration → Configuration Settings → tick ☑ `Send a page view event when the browser history state changes`.

### Q: Làm sao để biết tracking đang hoạt động đúng?
**A:** Sử dụng **Google Tag Assistant** (bấm Preview trong GTM) hoặc cài tiện ích trình duyệt **Facebook Pixel Helper** để xem realtime các event đang bắn ra.

### Q: Sự kiện `generate_lead` bắn ra quá nhiều, làm sao lọc?
**A:** Dùng biến `lead_source` để phân tích. Ví dụ: nếu muốn chỉ đếm Lead từ Form Báo Giá (chất lượng cao), tạo thêm 1 Trigger riêng với điều kiện: `Event = generate_lead` AND `lead_source = quote_form_submit`.

---

> 📧 **Hỗ trợ kỹ thuật:** Nếu gặp khó khăn trong quá trình cài đặt, vui lòng liên hệ đội phát triển để được hỗ trợ kiểm tra DataLayer.

---
*Tài liệu được tạo bởi Antigravity Agent System — Đông Phú Gia © 2026*
