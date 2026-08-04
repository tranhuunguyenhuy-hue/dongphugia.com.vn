import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanupProductHtml } from './cleanup'
import { generateContentReviewProposal } from './proposal'
import { createReviewImage, normalizeImageUrl } from './images'
import { createContentChangePlan, CONTENT_APPLY_ALLOWLIST } from './planner'
import { nextReviewState } from './state-machine'
import type { ProductContentInput } from './types'

describe('hita_cleanup_v1 proposal core', () => {
    it('cleans HTML deterministically and removes Hita attribution links and executable markup', () => {
        const input = '<div class="hita" style="color:red"><script>alert(1)</script><a href="https://hita.com.vn/p/1">Thông số</a><p data-owner="hita">Bền đẹp</p></div>'
        const first = cleanupProductHtml(input)

        expect(first).toBe(cleanupProductHtml(input))
        expect(first).toContain('Thông số')
        expect(first).not.toContain('<script')
        expect(first).not.toContain('hita.com.vn')
        expect(first).not.toContain('data-owner')
        expect(first).not.toContain('style=')
        expect(first).not.toContain('class=')
    })

    it('normalizes URLs, preserves approved Bunny assets and gates Hita assets for review', () => {
        expect(normalizeImageUrl('HTTPS://CDN.HITA.COM.VN/a.jpg?utm_source=x&v=2#hero'))
            .toBe('https://cdn.hita.com.vn/a.jpg?v=2')
        expect(createReviewImage('main', 'https://cdn.dongphugia.com.vn/a.jpg').decision).toBe('KEEP')
        const hita = createReviewImage('gallery', 'https://cdn.hita.com.vn/a.jpg')
        expect(hita.policy).toBe('HITA_HOSTED_REVIEW')
        expect(hita.decision).toBe('HUMAN_REVIEW')
    })

    it('runs a representative dry-run fixture pilot of at least 20 products without a provider call', async () => {
        const fixturePath = path.join(process.cwd(), 'scripts/content-review/fixtures/pilot-products.json')
        const inputs = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as ProductContentInput[]
        const proposals = await Promise.all(inputs.map(input => generateContentReviewProposal(input)))

        expect(inputs.length).toBeGreaterThanOrEqual(20)
        expect(proposals).toHaveLength(inputs.length)
        expect(proposals.every(item => item.source === 'hita_cleanup_v1')).toBe(true)
        expect(proposals.every(item => item.generation.mode === 'mock')).toBe(true)
        expect(proposals.flatMap(item => item.after.images).some(image => image.decision === 'KEEP')).toBe(true)
        expect(proposals.flatMap(item => item.after.images).some(image => image.decision === 'HUMAN_REVIEW')).toBe(true)
    })

    it('requires every image decision before approval', async () => {
        const proposal = await generateContentReviewProposal({
            id: 1,
            sku: 'HITA-1',
            name: 'Hita image',
            sourceUrl: 'https://hita.com.vn/p/1',
            descriptionHtml: '<p>Content</p>',
            imageMainUrl: 'https://cdn.hita.com.vn/a.jpg',
        })
        expect(() => nextReviewState('needs_review', 'approve', proposal)).toThrow('Every image')
    })

    it('creates allowlist-only non-executable apply and rollback plans', async () => {
        const proposal = await generateContentReviewProposal({
            id: 1,
            sku: 'BUNNY-1',
            name: 'Bunny image',
            sourceUrl: 'https://hita.com.vn/p/1',
            descriptionHtml: '<p>Content</p>',
            imageMainUrl: 'https://cdn.dongphugia.com.vn/a.jpg',
        })
        const apply = createContentChangePlan(proposal, 'ready_to_apply')
        const rollback = createContentChangePlan(proposal, 'approved', 'rollback')

        expect(apply).toMatchObject({ mode: 'dry-run', executable: false, direction: 'apply' })
        expect(rollback).toMatchObject({ mode: 'dry-run', executable: false, direction: 'rollback' })
        expect(apply.operations.filter(operation => operation.table === 'product_images')).toHaveLength(0)
        for (const operation of [...apply.operations, ...rollback.operations]) {
            expect(CONTENT_APPLY_ALLOWLIST).toContain(`${operation.table}.${operation.field}`)
        }
    })
})
