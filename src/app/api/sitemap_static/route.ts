import { NextResponse } from 'next/server';

export const revalidate = 86400; // 24 hours

export async function GET(request: Request) {
    return NextResponse.redirect(new URL('/sitemap_static.xml', request.url), 308);
}
