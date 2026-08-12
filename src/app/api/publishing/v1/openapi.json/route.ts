import { publishingOpenApi } from '@/lib/publishing/openapi'

export const dynamic = 'force-static'

export async function GET() {
    return Response.json(publishingOpenApi, {
        headers: {
            'cache-control': 'public, max-age=300, s-maxage=300',
        },
    })
}
