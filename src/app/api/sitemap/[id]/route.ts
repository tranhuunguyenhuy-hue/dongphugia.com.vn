import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCanonicalSiteUrl } from '@/lib/site';
import { buildPublicSitemapVisibilityWhere } from '@/lib/public-product-visibility';
import { getCanonicalProductPath, primaryTaxonAssignmentSelect } from '@/lib/taxonomy-paths';

export const revalidate = 86400; // 24 hours

const PAGE_SIZE = 2000;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    
    if (isNaN(id) || id < 1) {
        return new NextResponse('Invalid sitemap ID', { status: 400 });
    }

    const baseUrl = getCanonicalSiteUrl();
    const skip = (id - 1) * PAGE_SIZE;
    const where = buildPublicSitemapVisibilityWhere();

    const products = await prisma.products.findMany({
        where,
        skip: skip,
        take: PAGE_SIZE,
        select: {
            slug: true,
            updated_at: true,
            categories: { select: { slug: true } },
            subcategories: { select: { slug: true } },
            product_type: true,
            product_taxon_assignments: primaryTaxonAssignmentSelect,
        },
        orderBy: { id: 'asc' }
    });

    if (products.length === 0) {
        // Return an empty urlset instead of 404 to avoid GSC errors for out-of-bounds sitemaps
        return new NextResponse(
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
            {
                headers: {
                    'Content-Type': 'text/xml',
                    'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate'
                }
            }
        );
    }

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    products.forEach((product) => {
        const canonical = getCanonicalProductPath(product);

        // Escape special characters in XML
        const loc = `${baseUrl}${canonical.urlPath}`
            .replace(/&/g, '&amp;')
            .replace(/'/g, '&apos;')
            .replace(/"/g, '&quot;')
            .replace(/>/g, '&gt;')
            .replace(/</g, '&lt;');
        
        const lastMod = product.updated_at 
            ? product.updated_at.toISOString() 
            : new Date().toISOString();

        xml += `  <url>\n`;
        xml += `    <loc>${loc}</loc>\n`;
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'text/xml',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate'
        }
    });
}
