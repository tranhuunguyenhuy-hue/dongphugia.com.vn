import { createProtectedPrismaClient } from '@/lib/prisma'

function publishingDatabaseUrl() {
    const configured = process.env.PUBLISHING_DATABASE_URL
    if (configured) return configured

    if (process.env.NODE_ENV === 'test') {
        return process.env.DATABASE_URL
            ?? 'postgresql://publishing_test:publishing_test@127.0.0.1:1/publishing_test'
    }

    throw new Error('PUBLISHING_DATABASE_URL is required for Publishing API runtime access')
}

type PublishingPrismaClient = ReturnType<typeof createProtectedPrismaClient>

let productionPublishingPrisma: PublishingPrismaClient | undefined

declare const globalThis: {
    publishingPrismaGlobal: PublishingPrismaClient | undefined
} & typeof global

function getPublishingPrisma() {
    if (process.env.NODE_ENV === 'production') {
        productionPublishingPrisma ??= createProtectedPrismaClient(publishingDatabaseUrl())
        return productionPublishingPrisma
    }

    const client = globalThis.publishingPrismaGlobal
        ?? createProtectedPrismaClient(publishingDatabaseUrl())

    globalThis.publishingPrismaGlobal = client
    return client
}

const publishingPrisma = new Proxy({} as PublishingPrismaClient, {
    get(_target, property) {
        const client = getPublishingPrisma()
        const value = Reflect.get(client, property)
        return typeof value === 'function' ? value.bind(client) : value
    },
})

export { getPublishingPrisma, publishingDatabaseUrl }
export default publishingPrisma
