import { AsyncLocalStorage } from 'node:async_hooks'
import { PrismaClient } from '@prisma/client'
import { requireWritesAllowed } from '@/lib/write-freeze'

const WRITE_OPERATIONS = new Set([
    'create',
    'createMany',
    'createManyAndReturn',
    'delete',
    'deleteMany',
    'update',
    'updateMany',
    'updateManyAndReturn',
    'upsert',
])

const RAW_WRITE_OPERATIONS = new Set([
    '$executeRaw',
    '$executeRawUnsafe',
    '$runCommandRaw',
    'executeRaw',
    'executeRawUnsafe',
    'runCommandRaw',
])

export const createProtectedPrismaClient = (databaseUrl?: string) => {
    const client = databaseUrl
        ? new PrismaClient({ datasources: { db: { url: databaseUrl } } })
        : new PrismaClient()

    return client.$extends({
        query: {
            async $allOperations({ model, operation, query, args }) {
                if (
                    (model && WRITE_OPERATIONS.has(operation))
                    || RAW_WRITE_OPERATIONS.has(operation)
                ) {
                    requireWritesAllowed(`prisma.${operation}`)
                }

                return query(args)
            },
        },
    })
}

export type ProtectedPrismaClient = ReturnType<typeof createProtectedPrismaClient>
const requestPrismaContext = new AsyncLocalStorage<ProtectedPrismaClient>()

export function withRequestPrismaContext<T>(client: ProtectedPrismaClient, callback: () => T): T {
    return requestPrismaContext.run(client, callback)
}

declare const globalThis: {
    prismaGlobal?: ReturnType<typeof createProtectedPrismaClient>;
} & typeof global;

let defaultPrisma: ProtectedPrismaClient | undefined
function getDefaultPrisma(): ProtectedPrismaClient {
    if (process.env.PRISMA_REQUEST_SCOPE_REQUIRED === 'true' && !requestPrismaContext.getStore()) {
        throw new Error('REQUEST_DATABASE_CONTEXT_REQUIRED')
    }
    if (defaultPrisma) return defaultPrisma
    defaultPrisma = globalThis.prismaGlobal ?? createProtectedPrismaClient()
    if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = defaultPrisma
    return defaultPrisma
}

const prisma = new Proxy({} as ProtectedPrismaClient, {
    get(_target, property) {
        const client = requestPrismaContext.getStore() ?? getDefaultPrisma()
        const value = Reflect.get(client, property, client)
        return typeof value === 'function' ? value.bind(client) : value
    },
})

export default prisma
