export const siteConfig = {
    name: "Đông Phú Gia",
    shortName: "DPG",
    description: "Vật liệu xây dựng cao cấp, uy tín, chính hãng. Đồng hành & Phát triển.",
    url: "https://dongphugia.com.vn",
    
    // Contact Info
    contact: {
        phone: "0855528688",
        phoneLabel: "0855 528 688", // formatted for display
        hotlineLabel: "085 552 8688", 
        email: "vlxd.dongphu@gmail.com",
        address: "273–275 Phan Đình Phùng",
        addressLine2: "Phường 2, Đà Lạt, Lâm Đồng",
        fullAddress: "273–275 Phan Đình Phùng, Phường 2, Đà Lạt, Lâm Đồng",
        workingHours: "Thứ 2 - CN: 07:30 - 17:00"
    },

    // Maps iframe URL
    mapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1m3!1d3903.220199043!2d108.435777715277!3d11.954605191530999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x317112d1b110ba2b%3A0xc3f8373b88ea2859!2zxJDDtG5nIFBow7ogR2lh!5e0!3m2!1svi!2s!4v1713421715423!5m2!1svi!2s",

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
    { label: "Điều khoản", href: "/dieu-khoan" },
    { label: "Quyền riêng tư", href: "/quyen-rieng-tu" },
];
