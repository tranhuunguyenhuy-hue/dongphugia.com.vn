import prisma from '@/lib/prisma'
import { PageHeader } from '@/components/admin/page-header'
import { TaxonomyManager } from './taxonomy-manager'

export const dynamic = 'force-dynamic'

export default async function PimTaxonomyPage() {
    const taxons = await prisma.catalog_taxons.findMany({ orderBy: [{ depth: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }], take: 500 })
    return <div className="space-y-6"><PageHeader title="Taxonomy Management" description="Normalized catalog taxons với primary URL governance." /><TaxonomyManager taxons={taxons} /></div>
}
