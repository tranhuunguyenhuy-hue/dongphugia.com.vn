import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import { CustomerForm } from '../customer-form'

export default async function EditCustomerPage(props: {
    params: Promise<{ id: string }>
}) {
    const params = await props.params
    const customerId = parseInt(params.id)

    if (isNaN(customerId)) {
        notFound()
    }

    const customer = await prisma.customers.findUnique({
        where: { id: customerId },
    })

    if (!customer) {
        notFound()
    }

    return <CustomerForm initialData={customer} />
}
