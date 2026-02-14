import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
    console.log('🌱 Seeding database...')

    // ========== 1. Admin User ==========
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.adminUser.upsert({
        where: { email: 'admin@dongphugia.com' },
        update: { passwordHash: hashedPassword },
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

    console.log('✅ Categories created: 5 parents')

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

    // ========== 4. Product Types (Sub-categories) ==========
    // --- Gạch ốp lát sub-cats (updated per Figma) ---
    const typeData = [
        { name: 'Gạch Vân đá Marble', slug: 'gach-van-da-marble', categoryId: gachOplatParent.id },
        { name: 'Gạch Vân đá tự nhiên', slug: 'gach-van-da-tu-nhien', categoryId: gachOplatParent.id },
        { name: 'Gạch Vân gỗ', slug: 'gach-van-go', categoryId: gachOplatParent.id },
        { name: 'Gạch Thiết kế xi măng', slug: 'gach-thiet-ke-xi-mang', categoryId: gachOplatParent.id },
        { name: 'Gạch Trang trí', slug: 'gach-trang-tri', categoryId: gachOplatParent.id },
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

    // ========== 5. Collections (for Gạch ốp lát) ==========
    const collectionData = [
        // Vân đá Marble collections
        { name: 'INSIDE ART', slug: 'inside-art', productTypeId: types['gach-van-da-marble'].id },
        { name: 'DANCING FLOWER', slug: 'dancing-flower', productTypeId: types['gach-van-da-marble'].id },
        { name: 'MARVEL TRAVERTINE', slug: 'marvel-travertine', productTypeId: types['gach-van-da-marble'].id },
        { name: 'MARMI CLASSICI', slug: 'marmi-classici', productTypeId: types['gach-van-da-marble'].id },
        // Vân đá tự nhiên collections
        { name: 'MYSTIC', slug: 'mystic', productTypeId: types['gach-van-da-tu-nhien'].id },
        { name: 'MOSAIC', slug: 'mosaic', productTypeId: types['gach-van-da-tu-nhien'].id },
        // Vân gỗ
        { name: 'MARMI CLASSICI WOOD', slug: 'marmi-classici-wood', productTypeId: types['gach-van-go'].id },
        { name: 'CHIC', slug: 'chic', productTypeId: types['gach-van-go'].id },
    ]

    const collections: Record<string, any> = {}
    for (const c of collectionData) {
        collections[c.slug] = await prisma.collection.upsert({
            where: { slug: c.slug },
            update: {},
            create: { name: c.name, slug: c.slug, productTypeId: c.productTypeId },
        })
    }
    console.log(`✅ Collections created: ${collectionData.length}`)

    // ========== 6. Products ==========
    const productsData = [
        // --- Gạch ốp lát: INSIDE ART collection (3 SP cùng collection) ---
        {
            name: 'Gạch 120278EN7Z',
            slug: 'gach-120278en7z',
            sku: '120278EN7Z',
            showPrice: false,
            description: '<p>Tele di Marmo Lumia là hành trình khám phá vẻ đẹp của đá quý dưới ánh sáng, lấy cảm hứng từ những mẫu đá quý tự nhiên độc đáo. Mã 120278EN7Z với tông màu xanh dương chủ đạo.</p>',
            images: '[]',
            specs: JSON.stringify({ surface: 'Bóng', dimensions: '120x278cm', simDimensions: '120x278cm', origin: 'Ý', antiSlip: 'Không', patternCount: 6, color: 'Xanh' }),
            dimensions: '120x278cm',
            simDimensions: '120x278cm',
            surface: 'Bóng',
            origin: 'Ý',
            antiSlip: 'Không',
            patternCount: 6,
            colorName: 'Xanh',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-marble'].id,
            collectionId: collections['inside-art'].id,
            isFeatured: true,
        },
        {
            name: 'Gạch 120278EN7Y',
            slug: 'gach-120278en7y',
            sku: '120278EN7Y',
            showPrice: false,
            description: '<p>Tele di Marmo Lumia - Mã 120278EN7Y với tông hồng pastel nhẹ nhàng, vân đá marble tinh tế.</p>',
            images: '[]',
            specs: JSON.stringify({ surface: 'Bóng', dimensions: '120x278cm', simDimensions: '120x278cm', origin: 'Ý', antiSlip: 'Không', patternCount: 6, color: 'Hồng' }),
            dimensions: '120x278cm',
            simDimensions: '120x278cm',
            surface: 'Bóng',
            origin: 'Ý',
            antiSlip: 'Không',
            patternCount: 6,
            colorName: 'Hồng',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-marble'].id,
            collectionId: collections['inside-art'].id,
        },
        {
            name: 'Gạch 120278EN7E',
            slug: 'gach-120278en7e',
            sku: '120278EN7E',
            showPrice: false,
            description: '<p>Tele di Marmo Lumia - Mã 120278EN7E với tông kem nhã nhặn, phù hợp không gian sang trọng.</p>',
            images: '[]',
            specs: JSON.stringify({ surface: 'Bóng', dimensions: '120x278cm', simDimensions: '120x278cm', origin: 'Ý', antiSlip: 'Không', patternCount: 6, color: 'Kem' }),
            dimensions: '120x278cm',
            simDimensions: '120x278cm',
            surface: 'Bóng',
            origin: 'Ý',
            antiSlip: 'Không',
            patternCount: 6,
            colorName: 'Kem',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-marble'].id,
            collectionId: collections['inside-art'].id,
        },
        // --- MARVEL TRAVERTINE collection ---
        {
            name: 'Gạch 612MTWHCRMT',
            slug: 'gach-612mtwhcrmt',
            sku: '612MTWHCRMT',
            showPrice: false,
            images: '[]',
            specs: JSON.stringify({ surface: 'Mờ', dimensions: '60x120cm', simDimensions: '60x120cm', origin: 'Ý', antiSlip: 'R9', patternCount: 4, color: 'Trắng' }),
            dimensions: '60x120cm',
            simDimensions: '60x120cm',
            surface: 'Mờ',
            origin: 'Ý',
            antiSlip: 'R9',
            patternCount: 4,
            colorName: 'Trắng',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-marble'].id,
            collectionId: collections['marvel-travertine'].id,
        },
        {
            name: 'Gạch 612MTSACRMT',
            slug: 'gach-612mtsacrmt',
            sku: '612MTSACRMT',
            showPrice: false,
            images: '[]',
            specs: JSON.stringify({ surface: 'Mờ', dimensions: '60x120cm', simDimensions: '60x120cm', origin: 'Ý', antiSlip: 'R9', patternCount: 4, color: 'Nâu' }),
            dimensions: '60x120cm',
            simDimensions: '60x120cm',
            surface: 'Mờ',
            origin: 'Ý',
            antiSlip: 'R9',
            patternCount: 4,
            colorName: 'Nâu',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-marble'].id,
            collectionId: collections['marvel-travertine'].id,
        },
        // --- MARMI CLASSICI collection ---
        {
            name: 'Gạch 612PK612547',
            slug: 'gach-612pk612547',
            sku: '612PK612547',
            showPrice: false,
            images: '[]',
            specs: JSON.stringify({ surface: 'Mờ', dimensions: '60x120cm', simDimensions: '60x120cm', origin: 'Ý', antiSlip: 'Không', patternCount: 3, color: 'Đen' }),
            dimensions: '60x120cm',
            simDimensions: '60x120cm',
            surface: 'Mờ',
            origin: 'Ý',
            antiSlip: 'Không',
            patternCount: 3,
            colorName: 'Đen',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-marble'].id,
            collectionId: collections['marmi-classici'].id,
        },
        // --- MYSTIC collection ---
        {
            name: 'Gạch 918MYIVKRY',
            slug: 'gach-918myivkry',
            sku: '918MYIVKRY',
            showPrice: false,
            images: '[]',
            specs: JSON.stringify({ surface: 'Bóng', dimensions: '90x180cm', simDimensions: '90x180cm', origin: 'Ý', antiSlip: 'Không', patternCount: 5, color: 'Kem' }),
            dimensions: '90x180cm',
            simDimensions: '90x180cm',
            surface: 'Bóng',
            origin: 'Ý',
            antiSlip: 'Không',
            patternCount: 5,
            colorName: 'Kem',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-tu-nhien'].id,
            collectionId: collections['mystic'].id,
        },
        {
            name: 'Gạch 918MYBKKRY',
            slug: 'gach-918mybkkry',
            sku: '918MYBKKRY',
            showPrice: false,
            images: '[]',
            specs: JSON.stringify({ surface: 'Bóng', dimensions: '90x180cm', simDimensions: '90x180cm', origin: 'Ý', antiSlip: 'Không', patternCount: 5, color: 'Đen' }),
            dimensions: '90x180cm',
            simDimensions: '90x180cm',
            surface: 'Bóng',
            origin: 'Ý',
            antiSlip: 'Không',
            patternCount: 5,
            colorName: 'Đen',
            categoryId: gachOplatParent.id,
            productTypeId: types['gach-van-da-tu-nhien'].id,
            collectionId: collections['mystic'].id,
        },

        // --- Thiết bị vệ sinh ---
        {
            name: 'Bồn cầu 1 khối TOTO MS887W',
            slug: 'bon-cau-toto-ms887w',
            sku: 'TOTO-MS887W',
            price: 8500000,
            originalPrice: 9200000,
            description: '<p>Bồn cầu 1 khối TOTO MS887W với công nghệ xả xoáy Tornado, nắp đóng êm.</p>',
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
            description: '<p>Bồn cầu 2 khối Inax AC-700VAN, xả nhấn kép tiết kiệm nước.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['inax'].id,
            productTypeId: types['bon-cau'].id,
            isFeatured: true,
        },
        {
            name: 'Sen cây nóng lạnh Grohe Euphoria 26128000',
            slug: 'sen-cay-grohe-euphoria-26128',
            sku: 'GROHE-26128',
            price: 12500000,
            originalPrice: 14000000,
            description: '<p>Sen cây nóng lạnh Grohe Euphoria với 3 chế độ phun, công nghệ DreamSpray.</p>',
            images: '[]',
            categoryId: tbVeSinhParent.id,
            brandId: brands['grohe'].id,
            productTypeId: types['sen-voi'].id,
            isFeatured: true,
        },

        // --- Thiết bị nhà bếp ---
        {
            name: 'Bếp từ đôi Hafele HC-I772A',
            slug: 'bep-tu-hafele-hc-i772a',
            sku: 'HAF-HCI772A',
            price: 15900000,
            originalPrice: 17500000,
            description: '<p>Bếp từ đôi Hafele HC-I772A, mặt kính Schott Ceran, 9 mức công suất.</p>',
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
            description: '<p>Máy hút mùi Malloca MC-9039T, công suất hút 850m³/h, kính cường lực.</p>',
            images: '[]',
            categoryId: tbBepParent.id,
            brandId: brands['malloca'].id,
            productTypeId: types['may-hut-mui'].id,
        },

        // --- Sàn gỗ ---
        {
            name: 'Sàn gỗ công nghiệp Kronoswiss D2025',
            slug: 'san-go-kronoswiss-d2025',
            sku: 'KRO-D2025',
            price: 450000,
            description: '<p>Sàn gỗ công nghiệp Kronoswiss D2025 xuất xứ Thụy Sĩ, độ dày 8mm, AC4.</p>',
            images: '[]',
            categoryId: sanGoParent.id,
            productTypeId: types['san-go-cong-nghiep'].id,
        },
        {
            name: 'Sàn nhựa SPC Galaxy Plus MSC5026',
            slug: 'san-nhua-spc-galaxy-msc5026',
            sku: 'GAL-MSC5026',
            price: 280000,
            description: '<p>Sàn nhựa SPC Galaxy Plus MSC5026, chống nước 100%, vân gỗ sồi, dày 4mm.</p>',
            images: '[]',
            categoryId: sanGoParent.id,
            productTypeId: types['san-nhua-spc'].id,
            isFeatured: true,
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
                price: product.price || null,
                originalPrice: product.originalPrice || null,
                showPrice: product.showPrice ?? true,
                description: product.description || null,
                images: product.images,
                specs: product.specs || null,
                categoryId: product.categoryId,
                brandId: product.brandId || null,
                productTypeId: product.productTypeId || null,
                collectionId: product.collectionId || null,
                isFeatured: product.isFeatured || false,
                dimensions: (product as any).dimensions || null,
                simDimensions: (product as any).simDimensions || null,
                surface: (product as any).surface || null,
                origin: (product as any).origin || null,
                antiSlip: (product as any).antiSlip || null,
                patternCount: (product as any).patternCount || null,
                colorName: (product as any).colorName || null,
            },
        })
    }
    console.log(`✅ Products created: ${productsData.length}`)

    // ========== 7. Banners ==========
    const bannersData = [
        {
            title: 'Khuyến mãi Thiết bị vệ sinh TOTO - Giảm đến 30%',
            image: '/banners/banner-toto.jpg',
            link: '/products?category=thiet-bi-ve-sinh&brand=toto',
            order: 1,
        },
        {
            title: 'Gạch ốp lát cao cấp - Đa dạng bộ sưu tập',
            image: '/banners/banner-gach.jpg',
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

    // clear existing banners
    await prisma.banner.deleteMany()
    for (const banner of bannersData) {
        await prisma.banner.create({ data: banner })
    }
    console.log(`✅ Banners created: ${bannersData.length}`)

    // ========== 8. Posts ==========
    const postsData = [
        {
            title: 'Cách chọn thiết bị vệ sinh phù hợp cho gia đình',
            slug: 'cach-chon-thiet-bi-ve-sinh-phu-hop',
            content: '<h2>1. Xác định ngân sách</h2><p>Trước khi mua thiết bị vệ sinh, bạn cần xác định ngân sách phù hợp.</p><h2>2. Chọn thương hiệu uy tín</h2><p>Nên chọn các thương hiệu có bảo hành chính hãng tại Việt Nam.</p>',
            thumbnail: '/blog/thiet-bi-ve-sinh.jpg',
        },
        {
            title: 'Xu hướng thiết kế nhà bếp hiện đại 2024',
            slug: 'xu-huong-thiet-ke-nha-bep-hien-dai-2024',
            content: '<h2>Phong cách tối giản</h2><p>Xu hướng nhà bếp 2024 thiên về phong cách tối giản với tông màu trắng, xám.</p>',
            thumbnail: '/blog/nha-bep-hien-dai.jpg',
        },
        {
            title: 'Hướng dẫn chọn gạch ốp lát cho ngôi nhà hiện đại',
            slug: 'huong-dan-chon-gach-op-lat',
            content: '<h2>Các loại gạch phổ biến</h2><p>Gạch vân đá Marble, vân đá tự nhiên, vân gỗ — mỗi loại phù hợp cho không gian khác nhau.</p>',
            thumbnail: '/blog/gach-op-lat.jpg',
        },
    ]

    for (const post of postsData) {
        await prisma.post.upsert({
            where: { slug: post.slug },
            update: {},
            create: post
        })
    }
    console.log(`✅ Posts created: ${postsData.length}`)

    // ========== 9. Partners ==========
    // clear existing partners to avoid duplicates (no unique slug)
    await prisma.partner.deleteMany()
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

    // ========== 10. Projects ==========
    const projectsData = [
        {
            name: 'Dự án chung cư Vinhomes Ocean Park',
            slug: 'du-an-vinhomes-ocean-park',
            description: 'Cung cấp toàn bộ thiết bị vệ sinh TOTO và gạch ốp lát cho 500 căn hộ.',
            images: '[]',
        },
        {
            name: 'Khách sạn Mường Thanh Luxury',
            slug: 'khach-san-muong-thanh-luxury',
            description: 'Lắp đặt hệ thống sen vòi Grohe và thiết bị bếp Hafele cho 200 phòng.',
            images: '[]',
        },
    ]

    for (const project of projectsData) {
        await prisma.project.upsert({
            where: { slug: project.slug },
            update: {},
            create: project
        })
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
