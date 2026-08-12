export const publishingOpenApi = {
    openapi: '3.1.0',
    info: {
        title: 'Dongphugia Publishing API',
        version: '1.0.0',
        description:
            'Internal, vendor-neutral API for authorized Publishing Agents. All mutation requests require Idempotency-Key. External HTTPS citation hosts are runtime-reviewed configuration, not a fixed OpenAPI enum.',
    },
    servers: [{ url: '/api/publishing/v1' }],
    security: [{ bearerAuth: [] }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'opaque',
            },
        },
        headers: {
            RequestId: {
                description: 'Server-generated request correlation identifier.',
                schema: { type: 'string', format: 'uuid' },
            },
            ETag: {
                description: 'Current Post Version, formatted as "v<N>".',
                schema: { type: 'string', pattern: '^"v[1-9][0-9]*"$' },
            },
        },
        schemas: {
            Error: {
                type: 'object',
                required: ['code', 'message', 'request_id'],
                properties: {
                    code: { type: 'string', maxLength: 100 },
                    message: { type: 'string', maxLength: 300 },
                    request_id: { type: 'string', format: 'uuid' },
                    details: {
                        type: 'array',
                        maxItems: 20,
                        items: {
                            type: 'object',
                            required: ['code'],
                            properties: {
                                field: { type: 'string', maxLength: 100 },
                                code: { type: 'string', maxLength: 100 },
                                message: { type: 'string', maxLength: 300 },
                            },
                        },
                    },
                },
            },
            Publication: {
                oneOf: [
                    {
                        type: 'object',
                        additionalProperties: false,
                        required: ['mode'],
                        properties: { mode: { const: 'draft' } },
                    },
                    {
                        type: 'object',
                        additionalProperties: false,
                        required: ['mode'],
                        properties: { mode: { const: 'publish_now' } },
                    },
                    {
                        type: 'object',
                        additionalProperties: false,
                        required: [
                            'mode',
                            'publish_at',
                            'publication_timezone',
                        ],
                        properties: {
                            mode: { const: 'scheduled' },
                            publish_at: {
                                type: 'string',
                                description:
                                    'RFC 3339 timestamp with an explicit offset.',
                            },
                            publication_timezone: {
                                type: 'string',
                                description: 'IANA timezone, for example Asia/Ho_Chi_Minh.',
                            },
                        },
                    },
                ],
            },
            PostMutation: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'content_html', 'category_slug', 'publication'],
                properties: {
                    title: { type: 'string', minLength: 1, maxLength: 120 },
                    slug: { type: 'string', maxLength: 300 },
                    excerpt: { type: 'string', maxLength: 300 },
                    content_html: {
                        type: 'string',
                        description:
                            'Restricted HTML. Allowed tags: a, blockquote, br, code, em, figcaption, figure, h2-h6, hr, img, li, ol, p, pre, strong, table, tbody, td, th, thead, tr, ul. Unsupported tags/attributes and unsafe URLs return 422. Sanitized stored HTML is limited to 512 KiB.',
                    },
                    category_slug: { type: 'string', maxLength: 100 },
                    tag_slugs: {
                        type: 'array',
                        maxItems: 100,
                        items: { type: 'string', maxLength: 100 },
                    },
                    thumbnail_media_id: { type: ['string', 'null'], format: 'uuid' },
                    cover_media_id: { type: ['string', 'null'], format: 'uuid' },
                    seo_title: { type: ['string', 'null'], maxLength: 200 },
                    seo_description: { type: ['string', 'null'], maxLength: 500 },
                    publication: { $ref: '#/components/schemas/Publication' },
                },
            },
            Post: {
                type: 'object',
                required: [
                    'external_id',
                    'status',
                    'version',
                    'updated_at',
                    'content_html',
                ],
                properties: {
                    external_id: { type: 'string', maxLength: 200 },
                    status: {
                        enum: [
                            'draft',
                            'scheduled',
                            'published',
                            'schedule_blocked',
                        ],
                    },
                    version: { type: 'integer', minimum: 1 },
                    updated_at: { type: 'string', format: 'date-time' },
                    published_at: { type: ['string', 'null'], format: 'date-time' },
                    scheduled_for: { type: ['string', 'null'], format: 'date-time' },
                    scheduled_timezone: { type: ['string', 'null'] },
                    schedule_blocked_code: { type: ['string', 'null'] },
                    title: { type: 'string' },
                    slug: { type: 'string' },
                    excerpt: { type: 'string' },
                    content_html: { type: 'string' },
                    category: { type: 'object' },
                    tags: { type: 'array' },
                    thumbnail_url: { type: ['string', 'null'], format: 'uri' },
                    cover_image_url: { type: ['string', 'null'], format: 'uri' },
                    seo_title: { type: ['string', 'null'] },
                    seo_description: { type: ['string', 'null'] },
                    reading_time: { type: ['integer', 'null'] },
                    byline: { const: 'Ban Biên Tập Đông Phú Gia' },
                },
            },
            PostSummary: {
                type: 'object',
                required: ['external_id', 'status', 'version', 'updated_at'],
                properties: {
                    external_id: { type: 'string', maxLength: 200 },
                    status: { enum: ['draft', 'scheduled', 'published', 'schedule_blocked'] },
                    version: { type: 'integer', minimum: 1 },
                    updated_at: { type: 'string', format: 'date-time' },
                    published_at: { type: ['string', 'null'], format: 'date-time' },
                    scheduled_for: { type: ['string', 'null'], format: 'date-time' },
                    scheduled_timezone: { type: ['string', 'null'] },
                    schedule_blocked_code: { type: ['string', 'null'] },
                },
            },
            Taxonomy: {
                type: 'object',
                required: ['categories', 'tags'],
                properties: {
                    categories: { type: 'array', items: { type: 'object' } },
                    tags: { type: 'array', items: { type: 'object' } },
                },
            },
            PostPage: {
                type: 'object',
                required: ['items', 'next_cursor'],
                properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/PostSummary' } },
                    next_cursor: { type: ['string', 'null'] },
                },
            },
            ManagedMedia: {
                type: 'object',
                required: ['id', 'purpose', 'url', 'variants'],
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    purpose: { enum: ['thumbnail', 'cover', 'inline'] },
                    url: { type: 'string', format: 'uri' },
                    variants: { type: 'array' },
                },
            },
        },
    },
    paths: {
        '/taxonomy': {
            get: {
                summary: 'Read active Blog Categories and Blog Tags',
                responses: {
                    200: {
                        description: 'Active taxonomy',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Taxonomy' } } },
                    },
                    401: { description: 'Authentication failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/media': {
            post: {
                summary: 'Upload integration-owned Managed Media',
                parameters: [
                    {
                        name: 'Idempotency-Key',
                        in: 'header',
                        required: true,
                        schema: { type: 'string', minLength: 8, maxLength: 200 },
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                required: ['file', 'purpose'],
                                properties: {
                                    file: { type: 'string', format: 'binary' },
                                    purpose: { enum: ['thumbnail', 'cover', 'inline'] },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Managed Media accepted', content: { 'application/json': { schema: { $ref: '#/components/schemas/ManagedMedia' } } } },
                    200: { description: 'Idempotent replay', content: { 'application/json': { schema: { $ref: '#/components/schemas/ManagedMedia' } } } },
                    422: { description: 'Validation failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/posts': {
            get: {
                summary: 'List the calling Machine Identity’s Blog Posts',
                parameters: [
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
                    { name: 'cursor', in: 'query', schema: { type: 'string' } },
                    { name: 'status', in: 'query', schema: { type: 'string' } },
                    { name: 'updated_after', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'updated_before', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: { 200: { description: 'Page of owned posts', content: { 'application/json': { schema: { $ref: '#/components/schemas/PostPage' } } } } },
            },
        },
        '/posts/{external_id}': {
            parameters: [
                {
                    name: 'external_id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', maxLength: 200 },
                },
            ],
            get: {
                summary: 'Read one owned Blog Post',
                responses: { 200: { description: 'Current post state', content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } } }, 404: { description: 'Post not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
            },
            put: {
                summary: 'Create or conditionally update one Blog Post',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string' } },
                    { name: 'If-None-Match', in: 'header', schema: { const: '*' } },
                    { name: 'If-Match', in: 'header', schema: { type: 'string', pattern: '^"v[1-9][0-9]*"$' } },
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/PostMutation' } } },
                },
                responses: {
                    200: { description: 'Updated or idempotent replay', headers: { ETag: { $ref: '#/components/headers/ETag' } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostSummary' } } } },
                    201: { description: 'Created', headers: { ETag: { $ref: '#/components/headers/ETag' } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostSummary' } } } },
                    412: { description: 'Version stale or resource exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                    428: { description: 'Conditional header required', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
    },
} as const
