import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/admin/page-header'

const modules = [
    { href: '/admin/pim/brands', title: 'Brand Management', description: 'Canonical brands and Product brand relations.' },
    { href: '/admin/pim/taxonomy', title: 'Taxonomy Management', description: 'Normalized taxons, primary assignments and URL-safe paths.' },
    { href: '/admin/pim/types', title: 'Product Types', description: 'Normalized Product Type/Subtype references.' },
    { href: '/admin/pim/specifications', title: 'Specifications', description: 'Definitions, options and normalized Product values.' },
    { href: '/admin/pim/pilot', title: 'Pilot parity', description: 'Read-only cohort readiness and fallback reasons.' },
    { href: '/admin/products', title: 'Product Editor', description: 'Canonical Product facts and compatibility fields.' },
]

export default function PimFoundationPage() {
    return (
        <div className="space-y-6">
            <PageHeader title="CMS/PIM Foundation" description="Bounded canonical Product information management tools." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {modules.map((module) => (
                    <Link href={module.href} key={module.href}>
                        <Card className="h-full transition-colors hover:border-primary/50">
                            <CardHeader><CardTitle className="text-base">{module.title}</CardTitle></CardHeader>
                            <CardContent className="text-sm text-muted-foreground">{module.description}</CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
