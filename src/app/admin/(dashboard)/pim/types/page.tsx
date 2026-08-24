import prisma from '@/lib/prisma'
import { PageHeader } from '@/components/admin/page-header'
import { TypeManager } from './type-manager'

export const dynamic = 'force-dynamic'

export default async function PimTypesPage() {
    const [types, subcategories] = await Promise.all([
        prisma.product_types.findMany({ include: { product_sub_types: true }, orderBy: [{ sort_order: 'asc' }, { name: 'asc' }], take: 300 }),
        prisma.subcategories.findMany({ where: { is_active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ])
    return <div className="space-y-6"><PageHeader title="Product Type/Subtype" description="Normalized classification references; Product Type is not Product Family." /><TypeManager types={types} subcategories={subcategories} /></div>
}
