import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { QuoteBuilderClient } from './quote-builder-client'

export const dynamic = 'force-dynamic'

export default async function QuoteBuilderPage(props: {
    params: Promise<{ id: string }>
}) {
    const params = await props.params
    const quoteId = parseInt(params.id)

    if (isNaN(quoteId)) {
        notFound()
    }

    const quote = await prisma.quote_requests.findUnique({
        where: { id: quoteId },
        include: {
            quote_items: {
                include: {
                    products: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            image_main_url: true,
                            sku: true,
                            price: true,
                            original_price: true,
                        }
                    }
                }
            }
        }
    })

    if (!quote) {
        notFound()
    }

    return (
        <div className="h-[calc(100vh-theme(spacing.16))] -m-4 md:-m-6 flex flex-col">
            <QuoteBuilderClient quote={JSON.parse(JSON.stringify(quote))} />
        </div>
    )
}
