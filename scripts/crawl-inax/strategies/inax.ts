/**
 * INAX Crawl Strategy Configuration
 * Tệp cấu hình chứa các quy tắc (Selectors, Regex, Mapping) dành riêng cho hãng INAX.
 * Core Crawler sẽ sử dụng file này để bóc tách và làm sạch dữ liệu.
 */

export const INAX_STRATEGY = {
  brandId: 2, // Thay bằng ID thực tế của hãng INAX trong DB
  brandName: 'INAX',
  masterListingUrl: 'https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html',

  selectors: {
    // Info
    title: 'h1',
    breadcrumbs: '.breadcrumb li, .breadcrumbs li',

    // Pricing
    price: '.product-new-price-land, .product-price .price',
    originalPrice: '.product-old-price-land, .product-price .price-old',
    onlineDiscount: '.deal-price, .online-discount',

    // Gallery
    galleryImages: '.picture-wrapper img, .product-detail-left img, .slick-slide img',

    // Content
    description: '.content-desc, .product-description, #tab-description',
    techSpecsTable: '#tab-specification table, .product-specification table, .tech-specs table',
    
    // Accessories
    accessoriesWrapper: '.title-common-left:contains("Nguyên hộp bao gồm") + .panel-body',
    
    // Documents
    pdfLinks: 'a[href$=".pdf"]'
  },

  sanitization: {
    // Các từ khóa cần xóa khỏi tên hoặc mô tả
    removeKeywords: [
      /hita/gi,
      /khali/gi,
      /đại lý cấp 1/gi,
      /miễn phí giao hàng/gi,
      /hotline/gi,
      /0902\.\d{3}\.\d{3}/g // Regex ví dụ bắt SĐT
    ],
    // Các domain video cần lọc khỏi Gallery & Description
    forbiddenVideoDomains: [
      'ytimg.com',
      'youtube.com',
      'youtu.be',
      'vimeo.com'
    ],
    // Tên công ty chuẩn để thay thế
    companyName: 'Đồng Phú Gia'
  },

  // Hàm chuẩn hóa tên dành riêng cho INAX
  normalizeName: (rawName: string) => {
    let cleanName = rawName.replace(/Hita/gi, 'Đồng Phú Gia').trim();
    // TODO: Viết thêm logic tách mã sản phẩm INAX (AC, CW, CF) nếu cần
    return cleanName;
  }
};
