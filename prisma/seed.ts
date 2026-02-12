import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
    console.log('🌱 Seeding database...')

    // ========== 1. Admin User ==========
    const hashedPassword = await bcrypt.hash('adminpassword123', 10)
    const admin = await prisma.adminUser.upsert({
        where: { email: 'admin@dongphugia.com' },
        update: {},
        create: {
            email: 'admin@dongphugia.com',
            passwordHash: hashedPassword,
            role: 'ADMIN',
        },
    })
    console.log('✅ Admin user created:', admin.email)

    // ========== 2. Categories (Parent + Children) ==========
    const gachOplatParent = await prisma.category.upsert({
        where: { slug: 'gach-op-lat' },
        update: {},
        create: { name: 'Gạch ốp lát', slug: 'gach-op-lat', isFeatured: true },
    })

    const tbVeSinhParent = await prisma.category.upsert({
        where: { slug: 'thiet-bi-ve-sinh' },
        update: {},
        create: { name: 'Thiết bị vệ sinh', slug: 'thiet-bi-ve-sinh', isFeatured: true },
    })

    const tbBepParent = await prisma.category.upsert({
        where: { slug: 'thiet-bi-nha-bep' },
        update: {},
        create: { name: 'Thiết bị nhà bếp', slug: 'thiet-bi-nha-bep', isFeatured: true },
    })

    const tbNuocParent = await prisma.category.upsert({
        where: { slug: 'thiet-bi-nghanh-nuoc' },
        update: {},
        create: { name: 'Thiết bị ngành nước', slug: 'thiet-bi-nghanh-nuoc', isFeatured: true },
    })

    const sanGoParent = await prisma.category.upsert({
        where: { slug: 'san-go-san-nhua' },
        update: {},
        create: { name: 'Sàn gỗ, sàn nhựa', slug: 'san-go-san-nhua', isFeatured: true },
    })

    // Sub-categories for Gạch ốp lát
    const gachGranite = await prisma.category.upsert({
        where: { slug: 'gach-granite' },
        update: {},
        create: { name: 'Gạch Granite', slug: 'gach-granite', parentId: gachOplatParent.id },
    })
    const gachCeramic = await prisma.category.upsert({
        where: { slug: 'gach-ceramic' },
        update: {},
        create: { name: 'Gạch Ceramic', slug: 'gach-ceramic', parentId: gachOplatParent.id },
    })
    const gachMen = await prisma.category.upsert({
        where: { slug: 'gach-men' },
        update: {},
        create: { name: 'Gạch men', slug: 'gach-men', parentId: gachOplatParent.id },
    })

    console.log('✅ Categories created: 5 parents + 3 sub-categories')

    // ========== 3. Brands ==========
    const brandData = [
        { name: 'Toto', slug: 'toto' },
        { name: 'Inax', slug: 'inax' },
        { name: 'Viglacera', slug: 'viglacera' },
        { name: 'American Standard', slug: 'american-standard' },
        { name: 'Grohe', slug: 'grohe' },
        { name: 'Hafele', slug: 'hafele' },
        { name: 'Malloca', slug: 'malloca' },
        { name: 'Taicera', slug: 'taicera' },
    ]

    const brands: Record<string, any> = {}
    for (const b of brandData) {
        brands[b.slug] = await prisma.brand.upsert({
            where: { slug: b.slug },
            update: {},
            create: { name: b.name, slug: b.slug },
        })
    }
    console.log(`✅ Brands created: ${brandData.length}`)

    // ========== 4. Product Types ==========
    const typeData = [
        // Thiết bị vệ sinh
        { name: 'Bồn cầu', slug: 'bon-cau', categoryId: tbVeSinhParent.id },
        { name: 'Lavabo', slug: 'lavabo', categoryId: tbVeSinhParent.id },
        { name: 'Sen vòi', slug: 'sen-voi', categoryId: tbVeSinhParent.id },
        { name: 'Bồn tắm', slug: 'bon-tam', categoryId: tbVeSinhParent.id },
        { name: 'Phụ kiện phòng tắm', slug: 'phu-kien-phong-tam', categoryId: tbVeSinhParent.id },
        // Thiết bị nhà bếp
        { name: 'Bếp gas', slug: 'bep-gas', categoryId: tbBepParent.id },
        { name: 'Bếp từ', slug: 'bep-tu', categoryId: tbBepParent.id },
        { name: 'Máy hút mùi', slug: 'may-hut-mui', categoryId: tbBepParent.id },
        { name: 'Chậu rửa bát', slug: 'chau-rua-bat', categoryId: tbBepParent.id },
        // Thiết bị ngành nước
        { name: 'Ống nước', slug: 'ong-nuoc', categoryId: tbNuocParent.id },
        { name: 'Van khóa', slug: 'van-khoa', categoryId: tbNuocParent.id },
        { name: 'Máy bơm', slug: 'may-bom', categoryId: tbNuocParent.id },
        // Sàn gỗ
        { name: 'Sàn gỗ công nghiệp', slug: 'san-go-cong-nghiep', categoryId: sanGoParent.id },
        { name: 'Sàn nhựa SPC', slug: 'san-nhua-spc', categoryId: sanGoParent.id },
        { name: 'Sàn gỗ tự nhiên', slug: 'san-go-tu-nhien', categoryId: sanGoParent.id },
    ]

    const types: Record<string, any> = {}
    for (const t of typeData) {
        types[t.slug] = await prisma.productType.upsert({
            where: { slug: t.slug },
            update: {},
            create: { name: t.name, slug: t.slug, categoryId: t.categoryId },
        })
    }
    console.log(`✅ Product types created: ${typeData.length}`)

    // ========== 5. Products (15 sản phẩm mẫu) ==========
    const productsData = [
        // --- Thiết bị vệ sinh ---
        {
            name: 'Bồn cầu 1 khối TOTO MS887W',
            slug: 'bon-cau-toto-ms887w',
            sku: 'TOTO-MS887W',
            price: 8500000,
            originalPrice: 9200000,
            description: '<p>Bồn cầu 1 khối TOTO MS887W với công nghệ xả xoáy Tornado, nắp đóng êm. Thiết kế hiện đại, tiết kiệm nước.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['toto'].id,
            productTypeId: types['bon-cau'].id,
            isFeatured: true,
        },
        {
            name: 'Bồn cầu Inax AC-700VAN',
            slug: 'bon-cau-inax-ac700van',
            sku: 'INAX-AC700VAN',
            price: 4200000,
            description: '<p>Bồn cầu 2 khối Inax AC-700VAN, kiểu dáng thanh lịch, xả nhấn kép tiết kiệm nước.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['inax'].id,
            productTypeId: types['bon-cau'].id,
            isFeatured: true,
        },
        {
            name: 'Lavabo đặt bàn TOTO LW991A',
            slug: 'lavabo-toto-lw991a',
            sku: 'TOTO-LW991A',
            price: 3800000,
            description: '<p>Lavabo đặt bàn TOTO LW991A, men sứ CEFIONTECT chống bám bẩn. Kích thước 500x450mm.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['toto'].id,
            productTypeId: types['lavabo'].id,
        },
        {
            name: 'Sen cây nóng lạnh Grohe Euphoria 26128000',
            slug: 'sen-cay-grohe-euphoria-26128',
            sku: 'GROHE-26128',
            price: 12500000,
            originalPrice: 14000000,
            description: '<p>Sen cây nóng lạnh Grohe Euphoria với 3 chế độ phun, công nghệ DreamSpray cho luồng nước đều.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['grohe'].id,
            productTypeId: types['sen-voi'].id,
            isFeatured: true,
        },
        {
            name: 'Bồn tắm ngâm American Standard 70270',
            slug: 'bon-tam-american-standard-70270',
            sku: 'AS-70270',
            price: 6800000,
            description: '<p>Bồn tắm ngâm American Standard, chất liệu Acrylic cao cấp, kích thước 1500x750mm.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['american-standard'].id,
            productTypeId: types['bon-tam'].id,
        },
        // --- Gạch ốp lát ---
        {
            name: 'Gạch Granite Viglacera TS1-615',
            slug: 'gach-granite-viglacera-ts1-615',
            sku: 'VIG-TS1-615',
            price: 185000,
            description: '<p>Gạch Granite Viglacera TS1-615, kích thước 600x600mm, bề mặt nhám chống trơn, phù hợp lát sàn.</p>',
            images: '[]',
            categoryId: gachGranite.id,
            brandId: brands['viglacera'].id,
        },
        {
            name: 'Gạch men ốp tường Taicera G63938',
            slug: 'gach-men-taicera-g63938',
            sku: 'TAI-G63938',
            price: 210000,
            description: '<p>Gạch men ốp tường Taicera G63938, kích thước 300x600mm, vân đá marble sang trọng.</p>',
            images: '[]',
            categoryId: gachMen.id,
            brandId: brands['taicera'].id,
        },
        {
            name: 'Gạch Ceramic lát nền Viglacera KT-3673',
            slug: 'gach-ceramic-viglacera-kt3673',
            sku: 'VIG-KT3673',
            price: 145000,
            description: '<p>Gạch Ceramic lát nền Viglacera KT-3673, kích thước 300x300mm, chống trơn cho nhà tắm.</p>',
            images: '[]',
            categoryId: gachCeramic.id,
            brandId: brands['viglacera'].id,
        },
        // --- Thiết bị nhà bếp ---
        {
            name: 'Bếp từ đôi Hafele HC-I772A',
            slug: 'bep-tu-hafele-hc-i772a',
            sku: 'HAF-HCI772A',
            price: 15900000,
            originalPrice: 17500000,
            description: '<p>Bếp từ đôi Hafele HC-I772A, mặt kính Schott Ceran, 9 mức công suất, chức năng hẹn giờ.</p>',
            images: '[]',
            categoryId: tbBepParent.id,
            brandId: brands['hafele'].id,
            productTypeId: types['bep-tu'].id,
            isFeatured: true,
        },
        {
            name: 'Máy hút mùi Malloca MC-9039T',
            slug: 'may-hut-mui-malloca-mc9039t',
            sku: 'MAL-MC9039T',
            price: 5600000,
            description: '<p>Máy hút mùi Malloca MC-9039T, công suất hút 850m³/h, lọc than hoạt tính, kính cường lực.</p>',
            images: '[]',
            categoryId: tbBepParent.id,
            brandId: brands['malloca'].id,
            productTypeId: types['may-hut-mui'].id,
        },
        {
            name: 'Chậu rửa bát Hafele HS-SSD8248',
            slug: 'chau-rua-bat-hafele-hs-ssd8248',
            sku: 'HAF-SSD8248',
            price: 4200000,
            description: '<p>Chậu rửa bát Hafele HS-SSD8248 đôi, inox SUS304 dày 1.2mm, có kệ để đồ.</p>',
            images: '[]',
            categoryId: tbBepParent.id,
            brandId: brands['hafele'].id,
            productTypeId: types['chau-rua-bat'].id,
        },
        // --- Sàn gỗ ---
        {
            name: 'Sàn gỗ công nghiệp Kronoswiss D2025',
            slug: 'san-go-kronoswiss-d2025',
            sku: 'KRO-D2025',
            price: 450000,
            description: '<p>Sàn gỗ công nghiệp Kronoswiss D2025 xuất xứ Thụy Sĩ, độ dày 8mm, chống ẩm AC4.</p>',
            images: '[]',
            categoryId: sanGoParent.id,
            productTypeId: types['san-go-cong-nghiep'].id,
        },
        {
            name: 'Sàn nhựa SPC hèm khóa Galaxy Plus MSC5026',
            slug: 'san-nhua-spc-galaxy-msc5026',
            sku: 'GAL-MSC5026',
            price: 280000,
            description: '<p>Sàn nhựa SPC Galaxy Plus MSC5026, chống nước 100%, vân gỗ sồi tự nhiên, dày 4mm.</p>',
            images: '[]',
            categoryId: sanGoParent.id,
            productTypeId: types['san-nhua-spc'].id,
            isFeatured: true,
        },
        // --- Thiết bị ngành nước ---
        {
            name: 'Máy bơm tăng áp Grundfos CM Booster',
            slug: 'may-bom-tang-ap-grundfos-cm',
            sku: 'GRU-CMB',
            price: 7800000,
            description: '<p>Máy bơm tăng áp Grundfos CM Booster, lưu lượng 45 lít/phút, hoạt động êm ái.</p>',
            images: '[]',
            categoryId: tbNuocParent.id,
            productTypeId: types['may-bom'].id,
        },
        {
            name: 'Van khóa đồng Đài Loan phi 21',
            slug: 'van-khoa-dong-dai-loan-phi-21',
            sku: 'VKD-21',
            price: 85000,
            description: '<p>Van khóa đồng Đài Loan phi 21, thân đồng nguyên chất, chịu áp lực 16 bar.</p>',
            images: '[]',
            categoryId: tbNuocParent.id,
            productTypeId: types['van-khoa'].id,
        },
    ]

    for (const product of productsData) {
        await prisma.product.upsert({
            where: { slug: product.slug },
            update: {},
            create: {
                name: product.name,
                slug: product.slug,
                sku: product.sku,
                price: product.price,
                originalPrice: product.originalPrice || null,
                description: product.description,
                images: product.images,
                categoryId: product.categoryId,
                brandId: product.brandId || null,
                productTypeId: product.productTypeId || null,
                isFeatured: product.isFeatured || false,
            },
        })
    }
    console.log(`✅ Products created: ${productsData.length}`)

    // ========== 6. Banners ==========
    const bannersData = [
        {
            title: 'Khuyến mãi Thiết bị vệ sinh TOTO - Giảm đến 30%',
            image: '/banners/banner-toto.jpg',
            link: '/products?category=thiet-bi-ve-sinh&brand=toto',
            order: 1,
        },
        {
            title: 'Gạch ốp lát Viglacera - Bền đẹp theo thời gian',
            image: '/banners/banner-viglacera.jpg',
            link: '/products?category=gach-op-lat',
            order: 2,
        },
        {
            title: 'Thiết bị bếp Hafele - Nhập khẩu chính hãng',
            image: '/banners/banner-hafele.jpg',
            link: '/products?category=thiet-bi-nha-bep&brand=hafele',
            order: 3,
        },
    ]

    for (const banner of bannersData) {
        await prisma.banner.create({ data: banner })
    }
    console.log(`✅ Banners created: ${bannersData.length}`)

    // ========== 7. Posts ==========
    const postsData = [
        {
            title: 'Cách chọn thiết bị vệ sinh phù hợp cho gia đình',
            slug: 'cach-chon-thiet-bi-ve-sinh-phu-hop',
            content: `<h2>1. Xác định ngân sách</h2>
<p>Trước khi mua thiết bị vệ sinh, bạn cần xác định ngân sách phù hợp. Các thương hiệu cao cấp như TOTO, Grohe thường có giá từ 5-20 triệu cho một bộ sản phẩm.</p>
<h2>2. Chọn thương hiệu uy tín</h2>
<p>Nên chọn các thương hiệu có bảo hành chính hãng tại Việt Nam như TOTO, Inax, American Standard, Grohe.</p>
<h2>3. Đo đạc không gian</h2>
<p>Đo kích thước phòng tắm trước khi chọn mua để đảm bảo sản phẩm phù hợp với không gian.</p>`,
            thumbnail: '/blog/thiet-bi-ve-sinh.jpg',
        },
        {
            title: 'Xu hướng thiết kế nhà bếp hiện đại 2024',
            slug: 'xu-huong-thiet-ke-nha-bep-hien-dai-2024',
            content: `<h2>Phong cách tối giản</h2>
<p>Xu hướng nhà bếp 2024 thiên về phong cách tối giản với tông màu trắng, xám và gỗ tự nhiên.</p>
<h2>Bếp từ thay thế bếp gas</h2>
<p>Ngày càng nhiều gia đình chuyển sang sử dụng bếp từ vì tính an toàn và thẩm mỹ cao.</p>
<h2>Chậu rửa bát đa năng</h2>
<p>Chậu rửa bát kết hợp kệ để đồ, máy rửa bát giúp tối ưu không gian bếp.</p>`,
            thumbnail: '/blog/nha-bep-hien-dai.jpg',
        },
        {
            title: 'Hướng dẫn chọn sàn gỗ cho ngôi nhà của bạn',
            slug: 'huong-dan-chon-san-go-cho-ngoi-nha',
            content: `<h2>Sàn gỗ công nghiệp vs Sàn gỗ tự nhiên</h2>
<p>Sàn gỗ công nghiệp có giá thành rẻ hơn, đa dạng mẫu mã. Sàn gỗ tự nhiên sang trọng hơn nhưng đắt và cần bảo dưỡng nhiều.</p>
<h2>Sàn nhựa SPC - Lựa chọn mới</h2>
<p>Sàn nhựa SPC chống nước 100%, phù hợp cho phòng tắm, bếp. Giá thành hợp lý từ 200-400k/m².</p>`,
            thumbnail: '/blog/san-go.jpg',
        },
    ]

    for (const post of postsData) {
        await prisma.post.create({ data: post })
    }
    console.log(`✅ Posts created: ${postsData.length}`)

    // ========== 8. Partners ==========
    const partnersData = [
        { name: 'TOTO Vietnam', logo: '/partners/toto.png', websiteUrl: 'https://www.toto.com.vn' },
        { name: 'Inax Vietnam', logo: '/partners/inax.png', websiteUrl: 'https://www.inax.com.vn' },
        { name: 'Viglacera', logo: '/partners/viglacera.png', websiteUrl: 'https://www.viglacera.com.vn' },
        { name: 'Hafele', logo: '/partners/hafele.png', websiteUrl: 'https://www.hafele.com.vn' },
        { name: 'Grohe', logo: '/partners/grohe.png', websiteUrl: 'https://www.grohe.com.vn' },
    ]

    for (const partner of partnersData) {
        await prisma.partner.create({ data: partner })
    }
    console.log(`✅ Partners created: ${partnersData.length}`)

    // ========== 9. Projects ==========
    const projectsData = [
        {
            name: 'Dự án chung cư Vinhomes Ocean Park',
            slug: 'du-an-vinhomes-ocean-park',
            description: 'Cung cấp toàn bộ thiết bị vệ sinh TOTO và gạch ốp lát Viglacera cho 500 căn hộ.',
            images: '[]',
        },
        {
            name: 'Khách sạn Mường Thanh Luxury',
            slug: 'khach-san-muong-thanh-luxury',
            description: 'Lắp đặt hệ thống sen vòi Grohe và thiết bị bếp Hafele cho toàn bộ 200 phòng.',
            images: '[]',
        },
    ]

    for (const project of projectsData) {
        await prisma.project.create({ data: project })
    }
    console.log(`✅ Projects created: ${projectsData.length}`)

    console.log('🎉 Seeding complete!')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
