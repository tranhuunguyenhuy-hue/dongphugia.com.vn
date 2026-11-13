import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { requireWritesAllowed } from '../../src/lib/write-freeze'
import { withRequestPrismaContext, type ProtectedPrismaClient } from '../../src/lib/prisma'

interface AdminWorkerEnvironment {
  HYPERDRIVE_ADMIN_NO_CACHE: { connectionString: string }
  RUNTIME_ROLE: 'production'
  WRITE_FREEZE_MODE: 'false'
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void
}

type ProtectedPrisma = ProtectedPrismaClient
type FetchHandler = typeof import('vinext/server/fetch-handler').default

const WRITE_OPERATIONS = new Set([
  'create', 'createMany', 'createManyAndReturn', 'delete', 'deleteMany',
  'update', 'updateMany', 'updateManyAndReturn', 'upsert',
])
const RAW_WRITE_OPERATIONS = new Set([
  '$executeRaw', '$executeRawUnsafe', '$runCommandRaw',
  'executeRaw', 'executeRawUnsafe', 'runCommandRaw',
])

let fetchHandler: Promise<FetchHandler> | undefined

function createRequestPrisma(connectionString: string): {
  client: ProtectedPrisma
  close(): Promise<void>
} {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    query_timeout: 7_000,
  })
  const client = new PrismaClient({ adapter: new PrismaPg(pool) })
  const guarded = client.$extends({
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

  let closePromise: Promise<void> | undefined
  return {
    client: guarded as ProtectedPrisma,
    close() {
      closePromise ??= (async () => {
        await guarded.$disconnect()
        await pool.end()
      })()
      return closePromise
    },
  }
}

async function keepPrismaForResponse(
  response: Response,
  client: ProtectedPrisma,
  close: () => Promise<void>,
  context: ExecutionContextLike,
): Promise<Response> {
  let closePromise: Promise<void> | undefined
  const closeOnce = () => closePromise ??= close()
  const scheduleClose = () => context.waitUntil(closeOnce())

  if (!response.body) {
    await closeOnce()
    return response
  }

  const reader = response.body.getReader()
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await withRequestPrismaContext(client, () => reader.read())
        if (result.done) {
          controller.close()
          scheduleClose()
        } else {
          controller.enqueue(result.value)
        }
      } catch (error) {
        controller.error(error)
        scheduleClose()
      }
    },
    async cancel(reason) {
      try {
        await withRequestPrismaContext(client, () => reader.cancel(reason))
      } finally {
        scheduleClose()
      }
    },
  })

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
}

function isAdminRequestPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function isFrameworkAssetPath(pathname: string): boolean {
  return pathname.startsWith('/_next/')
    || pathname.startsWith('/_vinext/')
    || pathname.startsWith('/@vite/')
    || pathname.startsWith('/@id/')
    || pathname.startsWith('/@fs/')
    || pathname.startsWith('/src/')
    || pathname.startsWith('/node_modules/')
    || pathname === '/favicon.ico'
}

export default {
  async fetch(request: Request, environment: AdminWorkerEnvironment, context: ExecutionContextLike) {
    const { pathname } = new URL(request.url)
    if (pathname === '/') {
      return Response.redirect(new URL('/admin/login', request.url), 302)
    }
    if (!isAdminRequestPath(pathname) && !isFrameworkAssetPath(pathname)) {
      return new Response('Not found', { status: 404 })
    }

    Reflect.set(process.env, 'NODE_ENV', 'production')
    process.env.RUNTIME_ROLE = environment.RUNTIME_ROLE
    process.env.WRITE_FREEZE_MODE = environment.WRITE_FREEZE_MODE
    process.env.PRISMA_REQUEST_SCOPE_REQUIRED = 'true'

    fetchHandler ??= import('vinext/server/fetch-handler').then(module => module.default)
    const requestPrisma = createRequestPrisma(environment.HYPERDRIVE_ADMIN_NO_CACHE.connectionString)

    try {
      const response = await withRequestPrismaContext(requestPrisma.client, () =>
        fetchHandler!.then(handler => handler.fetch(request, environment, context as never)),
      )
      return keepPrismaForResponse(response, requestPrisma.client, requestPrisma.close, context)
    } catch (error) {
      await requestPrisma.close()
      throw error
    }
  },
}
