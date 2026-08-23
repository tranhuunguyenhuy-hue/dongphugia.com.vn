import prisma from '@/lib/prisma'
import { PageHeader } from '@/components/admin/page-header'
import { BrandManager } from './brand-manager'

export const dynamic = 'force-dynamic'

export default async function PimBrandsPage() {
    const brands = await prisma.brands.findMany({ orderBy: [{ sort_order: 'asc' }, { name: 'asc' }], take: 200 })
    return (
        <div className="space-y-6">
            <PageHeader title="Brand Management" description="Quản lý Brand canonical cho Product Editor." />
            <BrandManager brands={brands} />
        </div>
    )
}
