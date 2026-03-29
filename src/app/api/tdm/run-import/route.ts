import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  if (!type || !['bep', 'nuoc', 'khoacua', 'dien'].includes(type)) {
    return NextResponse.json({ error: 'Missing or invalid type (bep, nuoc, khoacua, dien)' }, { status: 400 });
  }

  // Find or create category
  let categoryId = type === 'bep' ? 3 : (type === 'nuoc' ? 5 : null);
  if (!categoryId) {
    const categoryName = type === 'khoacua' ? 'Khóa Cửa Thông Minh' : 'Thiết Bị Điện';
    const categorySlug = type === 'khoacua' ? 'khoa-cua-thong-minh' : 'thiet-bi-dien';
    // @ts-ignore
    let cat = await prisma.product_categories.findUnique({ where: { slug: categorySlug } });
    if (!cat) {
      // @ts-ignore
      cat = await prisma.product_categories.create({ data: { name: categoryName, slug: categorySlug, sort_order: type === 'khoacua' ? 6 : 7 } });
    }
    categoryId = cat.id;
  }

  const inputPath = `scripts/tdm-import/${type}.json`;
  
  try {
    const filePath = path.join(process.cwd(), inputPath);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found: ' + filePath }, { status: 404 });
    }
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const products = JSON.parse(rawData);

    // Dynamic Prisma delegates based on type
    let productModel, brandModel, typeModel, subtypeModel, imageModel;
    switch(type) {
      case 'bep':
        productModel = prisma.bep_products; brandModel = prisma.bep_brands; typeModel = prisma.bep_product_types;
        subtypeModel = prisma.bep_subtypes; imageModel = prisma.bep_product_images;
        break;
      case 'nuoc':
        productModel = prisma.nuoc_products; brandModel = prisma.nuoc_brands; typeModel = prisma.nuoc_product_types;
        subtypeModel = prisma.nuoc_subtypes; imageModel = prisma.nuoc_product_images;
        break;
      case 'khoacua':
        // @ts-ignore
        productModel = prisma.khoa_products; brandModel = prisma.khoa_brands; typeModel = prisma.khoa_product_types;
        // @ts-ignore
        subtypeModel = prisma.khoa_subtypes; imageModel = prisma.khoa_product_images;
        break;
      case 'dien':
        // @ts-ignore
        productModel = prisma.dien_products; brandModel = prisma.dien_brands; typeModel = prisma.dien_product_types;
        // @ts-ignore
        subtypeModel = prisma.dien_subtypes; imageModel = prisma.dien_product_images;
        break;
    }

    let createdCount = 0;
    let skippedCount = 0;
    let imagesCount = 0;

    // Cache lookup
    const brandCache = new Map<string, number>();
    const typeCache = new Map<string, number>();
    const subtypeCache = new Map<string, number>();

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.sku) continue;

      let cleanSku = p.sku;
      if (cleanSku.startsWith('TDM-')) {
        cleanSku = cleanSku.substring(4);
      }

      // Check existing
      // @ts-ignore
      const existing = await productModel.findUnique({ where: { sku: cleanSku } });
      if (existing) {
        skippedCount++;
        continue;
      }

      // Lookup brand
      let brandId = null;
      if (p.brand) {
        if (!brandCache.has(p.brand)) {
          // @ts-ignore
          let b = await brandModel.findFirst({ where: { slug: slugify(p.brand) } });
          if (!b) {
            // @ts-ignore
            b = await brandModel.create({ data: { name: p.brand, slug: slugify(p.brand) } });
          }
          brandCache.set(p.brand, b.id);
        }
        brandId = brandCache.get(p.brand);
      }

      // Lookup type
      let typeId = null;
      const typeName = p.type || p.typeName;
      if (typeName) {
        if (!typeCache.has(typeName)) {
          // @ts-ignore
          let t = await typeModel.findFirst({ where: { slug: slugify(typeName) } });
          if (!t) {
            // @ts-ignore
            t = await typeModel.create({ data: { name: typeName, slug: slugify(typeName), category_id: categoryId } });
          }
          typeCache.set(typeName, t.id);
        }
        typeId = typeCache.get(typeName);
      }
      
      if (!typeId) {
        throw new Error(`Missing product type for SKU ${cleanSku}`);
      }

      // Lookup subtype
      let subtypeId = null;
      if (p.subtype && p.subtype !== p.type) {
        const subtypeKey = `${typeId}-${p.subtype}`;
        if (!subtypeCache.has(subtypeKey)) {
          // @ts-ignore
          let st = await subtypeModel.findFirst({ where: { slug: slugify(p.subtype), product_type_id: typeId } });
          if (!st) {
            // @ts-ignore
            st = await subtypeModel.create({ data: { name: p.subtype, slug: slugify(p.subtype), product_type_id: typeId } });
          }
          subtypeCache.set(subtypeKey, st.id);
        }
        subtypeId = subtypeCache.get(subtypeKey);
      }

      // Create Product
      const productData = {
        sku: cleanSku,
        name: p.name,
        slug: p.slug,
        product_type_id: typeId,
        subtype_id: subtypeId,
        brand_id: brandId,
        price_display: p.price_display || 'Liên hệ báo giá',
        image_main_url: p.image_main_url,
        image_hover_url: p.image_hover_url,
        specifications: p.specifications || {},
        is_active: true
      };

      try {
        // @ts-ignore
        const product = await productModel.create({ data: productData });
        createdCount++;

        // Add secondary images
        if (p.images && p.images.length > 0) {
          const validImages = p.images.filter((img: string) => img !== p.image_main_url && img !== p.image_hover_url);
          if (validImages.length > 0) {
            // @ts-ignore
            await imageModel.createMany({
              data: validImages.map((img: string, idx: number) => ({
                product_id: product.id,
                image_url: img,
                sort_order: idx + 1
              }))
            });
            imagesCount += validImages.length;
          }
        }
      } catch (err) {
        console.error(`Error creating product ${cleanSku}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      type,
      total_in_file: products.length,
      created: createdCount,
      skipped: skippedCount,
      images_added: imagesCount
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}
