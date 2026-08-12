import { describe, expect, it } from 'vitest'

import { parsePostMutation } from './contracts'
import { publishingOpenApi } from './openapi'

describe('Publishing OpenAPI contract', () => {
    it('keeps optional mutation defaults and tag cardinality aligned with runtime parsing', () => {
        const mutation = parsePostMutation({
            title: 'Draft with runtime defaults',
            category_slug: 'kien-thuc',
            publication: { mode: 'draft' },
        })
        expect(mutation.content_html).toBe('')
        expect(mutation.tag_slugs).toEqual([])

        const schema = publishingOpenApi.components.schemas.PostMutation
        expect(schema.required).not.toContain('content_html')
        expect(schema.properties.tag_slugs).not.toHaveProperty('maxItems')
    })

    it('documents the error and retry surface implemented by every mutation', () => {
        const mediaResponses = publishingOpenApi.paths['/media'].post.responses
        const postResponses = publishingOpenApi.paths['/posts/{external_id}'].put.responses

        for (const status of [401, 403, 409, 413, 415, 422, 429, 500, 503]) {
            expect(mediaResponses).toHaveProperty(String(status))
        }
        for (const status of [401, 403, 404, 409, 412, 413, 415, 422, 428, 429, 500, 503]) {
            expect(postResponses).toHaveProperty(String(status))
        }
        expect(publishingOpenApi.components.responses.RateLimited.headers).toHaveProperty('Retry-After')
        expect(publishingOpenApi.paths['/posts/{external_id}'].put.parameters[0].schema).toMatchObject({
            minLength: 8,
            maxLength: 200,
            pattern: '^[\\x21-\\x7e]{8,200}$',
        })
    })

    it('describes every concrete public response item as required and typed', () => {
        const post = publishingOpenApi.components.schemas.Post
        expect(post.required).toEqual(expect.arrayContaining([
            'category', 'tags', 'thumbnail_url', 'cover_image_url', 'byline',
        ]))
        expect(post.properties.category).toEqual({ $ref: '#/components/schemas/TaxonomyItem' })
        expect(publishingOpenApi.components.schemas.TaxonomyItem.required).toEqual([
            'name', 'slug', 'description',
        ])
        expect(publishingOpenApi.components.schemas.ManagedMediaVariant.required).toEqual([
            'url', 'width', 'height', 'bytes', 'format',
        ])
    })
})
