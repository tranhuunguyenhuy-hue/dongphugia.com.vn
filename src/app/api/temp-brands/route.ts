import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    const tbvs = await prisma.tbvs_brands.findMany({ select: { slug: true, name: true }});
    const bep = await prisma.bep_brands.findMany({ select: { slug: true, name: true }});
    const nuoc = await prisma.nuoc_brands.findMany({ select: { slug: true, name: true }});
    
    return NextResponse.json({ tbvs, bep, nuoc });
}
