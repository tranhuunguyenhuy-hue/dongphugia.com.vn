import { getCanonicalSiteUrl } from "@/lib/site"

export const siteConfig = {
    name: "Đông Phú Gia",
    shortName: "DPG",
    description: "Vật liệu xây dựng cao cấp, uy tín, chính hãng. Đồng hành & Phát triển.",
    url: getCanonicalSiteUrl(),
    
    // Contact Info
    contact: {
        hotline: "0949349949",
        hotlineLabel: "094 9349 949 - 094 5343 494",
        businessRoom: "0855528688",
        businessRoomLabel: "0855 528 688",
        phone: "0855528688", // legacy field, kept for compatibility if needed, map to business room
        phoneLabel: "0855 528 688",
        email: "vlxd.dongphu@gmail.com",
        address: "273–275 Phan Đình Phùng",
        addressLine2: "Phường 2, Đà Lạt, Lâm Đồng",
        fullAddress: "273–275 Phan Đình Phùng, Phường 2, Đà Lạt, Lâm Đồng",
        workingHours: "Thứ 2 - CN: 07:30 - 17:00"
    },

    // Maps iframe URL
    // FIX LEO-438: Replaced invalid embed URL (expired 'pb' param) with stable
    // plain-text search embed — no API key required, no expiry risk.
    // Address: 273-275 Phan Dinh Phung, Phuong 2, Da Lat, Lam Dong
    mapUrl: "https://maps.google.com/maps?q=273+Phan+Dinh+Phung+Phuong+2+Da+Lat+Lam+Dong&output=embed",

    // Featured Settings
    featuredBrands: {
        tbvs: ['toto', 'inax', 'caesar', 'kohler']
    },

    // UI Labels
    ui: {
        topbarText: "Gọi điện nhận tư vấn ngay để nhận được giá ưu đãi nhất. • ",
        status: {
            in_stock: "Còn hàng",
            out_of_stock: "Hết hàng",
            contact: "Liên hệ báo giá"
        }
    }
};

export const siteLinks = {
    zalo: "https://zalo.me/0855528688",
    facebook: "https://facebook.com/dongphugia",
    messenger: "https://m.me/dongphugia"
};

// Navigation Links
export const NAV_PRODUCT_CATEGORIES = [
    { label: "Thiết bị vệ sinh", href: "/thiet-bi-ve-sinh", active: true },
    { label: "Thiết bị bếp", href: "/thiet-bi-bep", active: true },
    { label: "Gạch ốp lát", href: "/gach-op-lat", active: true },
    { label: "Vật liệu nước", href: "/vat-lieu-nuoc", active: true },
];

export const NAV_MAIN_LINKS = [
    { label: "Tin tức", href: "/tin-tuc" },
];

export const NAV_ABOUT_LINKS = [
    { label: "Về chúng tôi", href: "/ve-chung-toi" },
    { label: "Đối tác", href: "/doi-tac" },
    { label: "Dự án", href: "/du-an" },
];

export const NAV_FOOTER_ABOUT_LINKS = [
    { label: "Giới thiệu", href: "/ve-chung-toi" },
    { label: "Đối tác", href: "/doi-tac" },
    { label: "Dự án tiêu biểu", href: "/du-an" },
    { label: "Tin tức & Sự kiện", href: "/tin-tuc" },
];

export const NAV_FOOTER_LEGAL_LINKS = [
    { label: "Vận chuyển - Giao nhận", href: "/van-chuyen-giao-nhan" },
    { label: "Thông tin Hàng hóa", href: "/thong-tin-hang-hoa" },
    { label: "Thông tin Giá", href: "/thong-tin-gia" },
    { label: "Điều kiện Giao dịch", href: "/dieu-kien-giao-dich" },
    { label: "Kinh doanh có điều kiện", href: "/dieu-kien-kinh-doanh" },
    { label: "Chính sách Bảo mật", href: "/chinh-sach-bao-mat" },
];
