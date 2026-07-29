import { describe, expect, it } from 'vitest'
import { sanitizeRichHtml } from './html-sanitizer'

describe('sanitizeRichHtml', () => {
    it('removes executable HTML while keeping safe editorial markup', () => {
        const result = sanitizeRichHtml(`
            <h2>Tiêu đề</h2>
            <p onclick="alert(1)">Nội dung <strong>quan trọng</strong></p>
            <img src="https://cdn.dongphugia.com.vn/a.jpg" onerror="alert(1)" />
            <script>alert(1)</script>
        `)

        expect(result).toContain('<h2>Tiêu đề</h2>')
        expect(result).toContain('<strong>quan trọng</strong>')
        expect(result).toContain('src="https://cdn.dongphugia.com.vn/a.jpg"')
        expect(result).not.toContain('onclick')
        expect(result).not.toContain('onerror')
        expect(result).not.toContain('<script')
        expect(result).not.toContain('alert(1)')
    })

    it('strips javascript URLs from rich links and images', () => {
        const result = sanitizeRichHtml(`
            <a href="javascript:alert(1)">bad link</a>
            <img src="javascript:alert(1)" alt="bad image" />
        `)

        expect(result).toContain('bad link')
        expect(result).not.toContain('javascript:')
    })
})
