import prisma from '@/lib/prisma'
import { PageHeader } from '@/components/admin/page-header'
import { SpecificationManager } from './specification-manager'

export const dynamic = 'force-dynamic'

export default async function PimSpecificationsPage() {
    const definitions = await prisma.spec_definitions.findMany({ include: { spec_options: true }, orderBy: [{ sort_order: 'asc' }, { label: 'asc' }], take: 300 })
    return <div className="space-y-6"><PageHeader title="Specification Management" description="Normalized definitions/options cho Product Editor và filters." /><SpecificationManager definitions={definitions} /></div>
}
