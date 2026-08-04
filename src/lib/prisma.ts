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

const prismaClientSingleton = () => {
    return new PrismaClient().$extends({
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

declare const globalThis: {
    prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
