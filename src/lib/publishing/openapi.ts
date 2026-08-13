const requestIdHeaders = {
    'x-request-id': { $ref: '#/components/headers/RequestId' },
} as const

const retryableHeaders = {
    ...requestIdHeaders,
    'Retry-After': { $ref: '#/components/headers/RetryAfter' },
} as const

const postResponseHeaders = {
    ETag: { $ref: '#/components/headers/ETag' },
    ...requestIdHeaders,
} as const

export const publishingOpenApi = {
    openapi: '3.1.0',
    info: {
        title: 'Dongphugia Publishing API',
        version: '1.0.0',
        description:
            'Internal, vendor-neutral API for authorized Publishing Agents in a restricted Đông Phú Gia pilot. All mutation requests require Idempotency-Key. Retrying the same key with the same payload for 30 days returns the stored safe response; a changed payload or an in-progress operation returns 409, and a stale Post Version returns 412. External HTTPS citation hosts are runtime-reviewed configuration, not a fixed OpenAPI enum. External customer access and self-service onboarding are outside v1.',
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
            RetryAfter: {
                description: 'Seconds to wait before retrying the request.',
                schema: { type: 'integer', minimum: 1 },
            },
        },
        responses: {
            Unauthorized: { description: 'Credential missing, invalid, expired, or revoked', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            Forbidden: { description: 'HTTPS, IP policy, identity, or capability denied', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            Conflict: { description: 'Idempotency key is reused, still in progress, or a slug conflict occurs', headers: retryableHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            NotFound: { description: 'The owned resource was not found', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            PayloadTooLarge: { description: 'Request body exceeds its endpoint limit', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            UnsupportedMediaType: { description: 'Content-Type is unsupported', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            ValidationFailed: { description: 'Payload, safety, taxonomy, media, or readiness validation failed', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            PreconditionFailed: { description: 'Post version is stale or External Post ID already exists', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            PreconditionRequired: { description: 'Required If-Match or If-None-Match header is absent', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            RateLimited: { description: 'Per-Machine-Identity rate limit exceeded; retry after the Retry-After seconds', headers: retryableHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            ServiceUnavailable: { description: 'Publishing configuration, Gate, write freeze, or storage is unavailable', headers: retryableHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            InternalError: { description: 'Unexpected internal failure', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
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
                required: ['title', 'category_slug', 'publication'],
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
                    'published_at',
                    'scheduled_for',
                    'scheduled_timezone',
                    'schedule_blocked_code',
                    'title',
                    'slug',
                    'excerpt',
                    'category',
                    'tags',
                    'thumbnail_url',
                    'cover_image_url',
                    'seo_title',
                    'seo_description',
                    'reading_time',
                    'byline',
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
                    category: { $ref: '#/components/schemas/TaxonomyItem' },
                    tags: { type: 'array', items: { $ref: '#/components/schemas/TaxonomyItem' } },
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
                required: ['external_id', 'status', 'version', 'updated_at', 'published_at', 'scheduled_for', 'scheduled_timezone', 'schedule_blocked_code'],
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
                    categories: { type: 'array', items: { $ref: '#/components/schemas/TaxonomyItem' } },
                    tags: { type: 'array', items: { $ref: '#/components/schemas/TaxonomyItem' } },
                },
            },
            TaxonomyItem: {
                type: 'object',
                required: ['name', 'slug', 'description'],
                properties: {
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    description: { type: ['string', 'null'] },
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
                    variants: { type: 'array', items: { $ref: '#/components/schemas/ManagedMediaVariant' } },
                },
            },
            ManagedMediaVariant: {
                type: 'object',
                required: ['url', 'width', 'height', 'bytes', 'format'],
                properties: {
                    url: { type: 'string', format: 'uri' },
                    width: { type: 'integer', minimum: 1 },
                    height: { type: 'integer', minimum: 1 },
                    bytes: { type: 'integer', minimum: 1 },
                    format: { const: 'webp' },
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
                        headers: requestIdHeaders,
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Taxonomy' } } },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    429: { $ref: '#/components/responses/RateLimited' },
                    503: { $ref: '#/components/responses/ServiceUnavailable' },
                    500: { $ref: '#/components/responses/InternalError' },
                },
            },
        },
        '/media': {
            post: {
                summary: 'Upload integration-owned Managed Media',
                description: 'The request must include a valid Content-Length no greater than 5 MiB plus multipart overhead. Source files must be JPEG, PNG, or WebP and no larger than 40 megapixels. Missing, malformed, or oversized lengths return 413 before multipart parsing.',
                parameters: [
                    {
                        name: 'Idempotency-Key',
                        in: 'header',
                        required: true,
                        schema: { type: 'string', minLength: 8, maxLength: 200, pattern: '^[\\x21-\\x7e]{8,200}$' },
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
                    201: { description: 'Managed Media accepted', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/ManagedMedia' } } } },
                    200: { description: 'Idempotent replay', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/ManagedMedia' } } } },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    409: { $ref: '#/components/responses/Conflict' },
                    413: { $ref: '#/components/responses/PayloadTooLarge' },
                    415: { $ref: '#/components/responses/UnsupportedMediaType' },
                    422: { $ref: '#/components/responses/ValidationFailed' },
                    429: { $ref: '#/components/responses/RateLimited' },
                    502: { $ref: '#/components/responses/ServiceUnavailable' },
                    503: { $ref: '#/components/responses/ServiceUnavailable' },
                    500: { $ref: '#/components/responses/InternalError' },
                },
            },
        },
        '/posts': {
            get: {
                summary: 'List the calling Machine Identity’s Blog Posts',
                parameters: [
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 } },
                    { name: 'cursor', in: 'query', schema: { type: 'string' } },
                    { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'scheduled', 'published', 'schedule_blocked'] } },
                    { name: 'updated_after', in: 'query', schema: { type: 'string', format: 'date-time' } },
                    { name: 'updated_before', in: 'query', schema: { type: 'string', format: 'date-time' } },
                ],
                responses: {
                    200: { description: 'Page of owned posts', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostPage' } } } },
                    401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' }, 422: { $ref: '#/components/responses/ValidationFailed' }, 429: { $ref: '#/components/responses/RateLimited' }, 503: { $ref: '#/components/responses/ServiceUnavailable' }, 500: { $ref: '#/components/responses/InternalError' },
                },
            },
        },
        '/posts/{external_id}': {
            parameters: [
                {
                    name: 'external_id',
                    in: 'path',
                    required: true,
                    schema: { type: 'string', maxLength: 200, pattern: '^[A-Za-z0-9][A-Za-z0-9._~-]{0,199}$' },
                },
            ],
            get: {
                summary: 'Read one owned Blog Post',
                responses: { 200: { description: 'Current post state', headers: postResponseHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Post' } } } }, 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' }, 404: { description: 'Post not found', headers: requestIdHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } }, 422: { $ref: '#/components/responses/ValidationFailed' }, 429: { $ref: '#/components/responses/RateLimited' }, 503: { $ref: '#/components/responses/ServiceUnavailable' }, 500: { $ref: '#/components/responses/InternalError' } },
            },
            put: {
                summary: 'Create or conditionally update one Blog Post',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 8, maxLength: 200, pattern: '^[\\x21-\\x7e]{8,200}$' } },
                    { name: 'If-None-Match', in: 'header', description: 'Required as `*` for creation; must not be combined with If-Match.', schema: { const: '*' } },
                    { name: 'If-Match', in: 'header', description: 'Required with the current ETag for update; must not be combined with If-None-Match.', schema: { type: 'string', pattern: '^"v[1-9][0-9]*"$' } },
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/PostMutation' } } },
                },
                responses: {
                    200: { description: 'Updated or idempotent replay', headers: postResponseHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostSummary' } } } },
                    201: { description: 'Created', headers: postResponseHeaders, content: { 'application/json': { schema: { $ref: '#/components/schemas/PostSummary' } } } },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                    409: { $ref: '#/components/responses/Conflict' },
                    412: { $ref: '#/components/responses/PreconditionFailed' },
                    413: { $ref: '#/components/responses/PayloadTooLarge' },
                    415: { $ref: '#/components/responses/UnsupportedMediaType' },
                    422: { $ref: '#/components/responses/ValidationFailed' },
                    428: { $ref: '#/components/responses/PreconditionRequired' },
                    429: { $ref: '#/components/responses/RateLimited' },
                    503: { $ref: '#/components/responses/ServiceUnavailable' },
                    500: { $ref: '#/components/responses/InternalError' },
                },
            },
        },
    },
} as const
